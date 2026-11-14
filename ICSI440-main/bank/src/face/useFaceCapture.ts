import { useCallback, useEffect, useRef, useState } from 'react'
import type { FaceLandmarker } from '@mediapipe/tasks-vision'
import type { CapturedFrame, StepId } from '../api'
import { loadTracker, readSignal, type FaceSignal } from './tracker'

// ------------------------------------------------------------------ camera
export function useCamera(active: boolean) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [ready, setReady] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!active) return
    let stream: MediaStream | null = null
    let cancelled = false
    setError(null)
    setReady(false)
    ;(async () => {
      if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
        // Plain http:// on a network address: browsers hide the camera API entirely.
        const port = window.location.port ? `:${window.location.port}` : ''
        setError(`Камер ашиглахын тулд https://${window.location.hostname}${port} хаягаар нээнэ үү.`)
        return
      }
      try {
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } },
            audio: false,
          })
        } catch (err) {
          if (!(err instanceof DOMException && err.name === 'OverconstrainedError')) throw err
          stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false })
        }
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop()) // effect already cleaned up (React StrictMode)
          return
        }
        const video = videoRef.current
        if (!video) return
        video.srcObject = stream
        await video.play().catch(() => undefined)
        setReady(true)
      } catch (err) {
        const name = err instanceof DOMException ? err.name : ''
        const text = err instanceof Error ? err.message : String(err)
        setError(
          name === 'NotAllowedError'
            ? /system/i.test(text)
              ? 'Компьютерийн тохиргоонд камер хаалттай: System Settings → Privacy & Security → Camera → хөтчөө асаана уу.'
              : 'Камер ашиглах зөвшөөрөл олгоно уу (хаягийн мөрөн дэх камерын тэмдэг → Allow).'
            : name === 'NotFoundError'
              ? 'Камер олдсонгүй.'
              : name === 'NotReadableError' || name === 'AbortError'
                ? 'Камерыг өөр программ (Zoom, FaceTime, Teams…) ашиглаж байна. Түүнийг хаагаад дахин оролдоно уу.'
                : `Камер нээж чадсангүй (${name || text}).`,
        )
      }
    })()
    return () => {
      cancelled = true
      stream?.getTracks().forEach((t) => t.stop())
      setReady(false)
    }
  }, [active])

  return { videoRef, ready, error }
}

// ------------------------------------------------------- step thresholds
// Client thresholds are stricter than the server's (12° yaw, 8° pitch) so a
// frame captured here comfortably passes the server's own measurement.
const TURN_DEG = 22
const NOD_RATIO = 0.09
const BLINK_CLOSED = 0.6
const HOLD_MS: Record<StepId, number> = {
  center: 450,
  turn_left: 120,
  turn_right: 120,
  look_up: 120,
  look_down: 120,
  blink: 0,
}
const MANUAL_SECONDS = 3

interface Baseline {
  yaw: number
  pitchRatio: number
}

interface Evaluation {
  ok: boolean
  progress: number
  hint: string | null
}

function evaluate(step: StepId, s: FaceSignal | null, base: Baseline | null): Evaluation {
  if (!s || s.count === 0) return { ok: false, progress: 0, hint: 'Нүүрээ дугуй хүрээнд оруулна уу' }
  if (s.count > 1) return { ok: false, progress: 0, hint: 'Кадрт зөвхөн та байх ёстой' }
  if (s.size < 0.16) return { ok: false, progress: 0, hint: 'Камерт ойртоно уу' }
  if (s.size > 0.7) return { ok: false, progress: 0, hint: 'Арай холдоно уу' }
  const clamp = (n: number) => Math.max(0, Math.min(1, n))
  const b = base ?? { yaw: 0, pitchRatio: s.pitchRatio }
  switch (step) {
    case 'center': {
      if (Math.abs(s.cx - 0.5) > 0.16 || Math.abs(s.cy - 0.5) > 0.2)
        return { ok: false, progress: 0, hint: 'Хүрээний голд байрлана уу' }
      if (Math.abs(s.yaw) > 12) return { ok: false, progress: 0, hint: 'Камер руу эгц харна уу' }
      if (s.blink > 0.4) return { ok: false, progress: 0, hint: 'Нүдээ нээнэ үү' }
      return { ok: true, progress: 1, hint: null }
    }
    case 'turn_left': {
      const d = b.yaw - s.yaw
      return { ok: d >= TURN_DEG, progress: clamp(d / TURN_DEG), hint: null }
    }
    case 'turn_right': {
      const d = s.yaw - b.yaw
      return { ok: d >= TURN_DEG, progress: clamp(d / TURN_DEG), hint: null }
    }
    case 'look_up': {
      const d = b.pitchRatio - s.pitchRatio
      return { ok: d >= NOD_RATIO, progress: clamp(d / NOD_RATIO), hint: null }
    }
    case 'look_down': {
      const d = s.pitchRatio - b.pitchRatio
      return { ok: d >= NOD_RATIO, progress: clamp(d / NOD_RATIO), hint: null }
    }
    case 'blink': {
      if (Math.abs(s.yaw - b.yaw) > 15) return { ok: false, progress: 0, hint: 'Камер руу эгц харна уу' }
      return { ok: s.blink >= BLINK_CLOSED, progress: clamp(s.blink / BLINK_CLOSED), hint: null }
    }
  }
}

function beep() {
  try {
    const ctx = new AudioContext()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.frequency.value = 880
    gain.gain.value = 0.08
    osc.connect(gain).connect(ctx.destination)
    osc.start()
    osc.stop(ctx.currentTime + 0.12)
    osc.onended = () => void ctx.close()
  } catch {
    /* audio is optional */
  }
}

// ----------------------------------------------------- capture controller
export type TrackerMode = 'loading' | 'tracker' | 'manual'

interface CaptureOptions {
  videoRef: React.RefObject<HTMLVideoElement | null>
  cameraReady: boolean
  steps: StepId[] | null
  onComplete: (frames: CapturedFrame[]) => void
  overlayRef?: React.RefObject<HTMLCanvasElement | null>
  showMesh?: boolean
}

/**
 * Walks the user through the server's liveness steps. For each step it waits
 * until the on-device tracker sees the requested pose, then grabs *that exact*
 * frame as a JPEG. If MediaPipe cannot load (offline, old browser) it falls back
 * to a countdown per step - the server still verifies every frame either way.
 */
export function useFaceCapture({ videoRef, cameraReady, steps, onComplete, overlayRef, showMesh }: CaptureOptions) {
  const [mode, setMode] = useState<TrackerMode>('loading')
  const [stepIndex, setStepIndex] = useState(0)
  const [progress, setProgress] = useState(0)
  const [hint, setHint] = useState<string | null>(null)
  const [countdown, setCountdown] = useState<number | null>(null)
  const [flash, setFlash] = useState(0)

  const landmarkerRef = useRef<FaceLandmarker | null>(null)
  const onCompleteRef = useRef(onComplete)
  onCompleteRef.current = onComplete
  const showMeshRef = useRef(showMesh)
  showMeshRef.current = showMesh

  // Load the tracker once; fall back to manual mode after a failure or 12 s.
  useEffect(() => {
    let done = false
    const timer = window.setTimeout(() => {
      if (!done) setMode('manual')
    }, 12000)
    loadTracker()
      .then((lm) => {
        done = true
        landmarkerRef.current = lm
        setMode((m) => (m === 'manual' ? m : 'tracker'))
      })
      .catch((err) => {
        console.warn('MediaPipe Face Landmarker unavailable, using manual capture', err)
        done = true
        setMode('manual')
      })
    return () => window.clearTimeout(timer)
  }, [])

  const grab = useCallback(
    (canvas: HTMLCanvasElement) => {
      const video = videoRef.current
      if (!video || !video.videoWidth) return false
      const scale = Math.min(1, 960 / video.videoWidth)
      const w = Math.round(video.videoWidth * scale)
      const h = Math.round(video.videoHeight * scale)
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w
        canvas.height = h
      }
      canvas.getContext('2d', { willReadFrequently: false })?.drawImage(video, 0, 0, w, h)
      return true
    },
    [videoRef],
  )

  const drawMesh = useCallback(
    (signal: FaceSignal | null) => {
      const overlay = overlayRef?.current
      const video = videoRef.current
      if (!overlay || !video) return
      const w = overlay.clientWidth
      const h = overlay.clientHeight
      if (overlay.width !== w * 2) {
        overlay.width = w * 2
        overlay.height = h * 2
      }
      const ctx = overlay.getContext('2d')
      if (!ctx) return
      ctx.setTransform(2, 0, 0, 2, 0, 0)
      ctx.clearRect(0, 0, w, h)
      if (!showMeshRef.current || !signal?.points.length || !video.videoWidth) return
      // Map frame coordinates to the object-cover video box.
      const va = video.videoWidth / video.videoHeight
      const sw = w / h > va ? w : h * va
      const sh = w / h > va ? w / va : h
      const ox = (w - sw) / 2
      const oy = (h - sh) / 2
      ctx.fillStyle = 'rgba(120, 220, 255, .85)'
      for (const p of signal.points) {
        ctx.beginPath()
        ctx.arc(ox + p.x * sw, oy + p.y * sh, 1.1, 0, Math.PI * 2)
        ctx.fill()
      }
    },
    [overlayRef, videoRef],
  )

  // Main loop: one run per challenge.
  useEffect(() => {
    if (!steps || !cameraReady || mode === 'loading') return
    let cancelled = false
    let raf = 0
    let timer = 0
    const frames: CapturedFrame[] = []
    const canvas = document.createElement('canvas')
    let index = 0
    let base: Baseline | null = null
    let okSince: number | null = null
    let lastTick = 0
    let lastUi = 0
    setStepIndex(0)
    setProgress(0)
    setHint(null)

    const capture = () => {
      frames.push({ step: steps[index]!, image: canvas.toDataURL('image/jpeg', 0.9) })
      setFlash((f) => f + 1)
      index += 1
      okSince = null
      if (index >= steps.length) {
        setStepIndex(steps.length)
        setProgress(1)
        setHint(null)
        onCompleteRef.current(frames)
        return true
      }
      setStepIndex(index)
      setProgress(0)
      return false
    }

    if (mode === 'tracker' && landmarkerRef.current) {
      const landmarker = landmarkerRef.current
      const tick = (now: number) => {
        if (cancelled) return
        raf = requestAnimationFrame(tick)
        if (now - lastTick < 45) return // ~20 detections per second is plenty
        lastTick = now
        if (!grab(canvas)) return
        let signal: FaceSignal | null = null
        try {
          signal = readSignal(landmarker, canvas, now)
        } catch {
          return
        }
        drawMesh(signal)
        const step = steps[index]!
        const ev = evaluate(step, signal, base)
        if (ev.ok) {
          okSince ??= now
          if (now - okSince >= HOLD_MS[step]) {
            if (step === 'center' && signal) base = { yaw: signal.yaw, pitchRatio: signal.pitchRatio }
            if (capture()) {
              cancelAnimationFrame(raf)
              drawMesh(null)
              return
            }
          }
        } else {
          okSince = null
        }
        if (now - lastUi > 90) {
          lastUi = now
          setProgress(step === 'center' && ev.ok ? Math.min(1, (now - (okSince ?? now)) / HOLD_MS.center) : ev.progress)
          setHint(ev.hint)
        }
      }
      raf = requestAnimationFrame(tick)
    } else {
      // Manual fallback: countdown, beep, capture.
      const runStep = (secondsLeft: number) => {
        if (cancelled) return
        setCountdown(secondsLeft)
        setProgress(1 - secondsLeft / MANUAL_SECONDS)
        if (secondsLeft > 0) {
          timer = window.setTimeout(() => runStep(secondsLeft - 1), 1000)
          return
        }
        beep()
        if (!grab(canvas)) {
          timer = window.setTimeout(() => runStep(0), 300)
          return
        }
        if (!capture()) timer = window.setTimeout(() => runStep(MANUAL_SECONDS), 600)
        else setCountdown(null)
      }
      timer = window.setTimeout(() => runStep(MANUAL_SECONDS), 400)
    }

    return () => {
      cancelled = true
      cancelAnimationFrame(raf)
      window.clearTimeout(timer)
      setCountdown(null)
    }
  }, [steps, cameraReady, mode, grab, drawMesh])

  return { mode, stepIndex, progress, hint, countdown, flash }
}
