import { useMemo, useRef, type CSSProperties } from 'react'
import type { CapturedFrame, StepId } from '../api'
import { useCamera, useFaceCapture } from './useFaceCapture'

export interface ScannerStep {
  id: StepId
  label: string
}

interface FaceScannerProps {
  /** Steps of the current server challenge; null while waiting for one. */
  steps: ScannerStep[] | null
  onComplete: (frames: CapturedFrame[]) => void
  /** Overlay text while the server is checking the frames. */
  busy?: string | null
  variant?: 'phone' | 'pos'
  showMesh?: boolean
  /** Diameter of the circular viewfinder in px. */
  size?: number
}

const ARROWS: Partial<Record<StepId, string>> = {
  turn_left: 'left',
  turn_right: 'right',
  look_up: 'up',
  look_down: 'down',
}

function Arrow({ dir, color }: { dir: string; color: string }) {
  const rotate = { left: 180, right: 0, up: -90, down: 90 }[dir] ?? 0
  return (
    <svg width="34" height="34" viewBox="0 0 24 24" style={{ transform: `rotate(${rotate}deg)` }} aria-hidden="true">
      <path
        d="m9 5 7 7-7 7"
        fill="none"
        stroke={color}
        strokeWidth="2.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

/**
 * Circular selfie viewfinder with a segmented progress ring (one segment per
 * liveness step), like the Face ID enrolment ring. Used by the bank's Face Pay
 * setup and by the POS terminal.
 */
export default function FaceScanner({
  steps,
  onComplete,
  busy,
  variant = 'phone',
  showMesh = false,
  size = 260,
}: FaceScannerProps) {
  const overlayRef = useRef<HTMLCanvasElement>(null)
  const { videoRef, ready, error } = useCamera(true)
  const stepIds = useMemo(() => (steps ? steps.map((s) => s.id) : null), [steps])
  const { mode, stepIndex, progress, hint, countdown, flash } = useFaceCapture({
    videoRef,
    cameraReady: ready,
    steps: busy ? null : stepIds,
    onComplete,
    overlayRef,
    showMesh,
  })

  const dark = variant === 'phone'
  const accent = dark ? '#4ade80' : '#2563eb'
  const track = dark ? 'rgba(255,255,255,.18)' : '#e5e9f0'
  const total = steps?.length ?? 1
  const current = steps?.[stepIndex]
  const ring = size + 34
  const r = ring / 2 - 6
  const circumference = 2 * Math.PI * r
  const gap = total > 1 ? 10 : 0
  const seg = circumference / total - gap

  let label = current?.label ?? ''
  if (current?.id === 'blink' && mode === 'manual') label = 'Нүдээ аниад дуу гартал хүлээнэ үү'
  if (!steps) label = ''

  let status: string | null = null
  if (error) status = error
  else if (!ready) status = 'Камер асааж байна…'
  else if (mode === 'loading' && steps) status = 'AI загвар ачаалж байна…'

  const arrow = current ? ARROWS[current.id] : undefined

  return (
    <div className="flex flex-col items-center">
      <div className="relative" style={{ width: ring, height: ring }}>
        <svg width={ring} height={ring} className="absolute inset-0 -rotate-90" aria-hidden="true">
          {Array.from({ length: total }, (_, i) => {
            const fill = i < stepIndex ? 1 : i === stepIndex ? progress : 0
            const offset = i * (seg + gap)
            return (
              <g key={i}>
                <circle
                  cx={ring / 2}
                  cy={ring / 2}
                  r={r}
                  fill="none"
                  stroke={track}
                  strokeWidth={7}
                  strokeLinecap="round"
                  strokeDasharray={`${seg} ${circumference}`}
                  strokeDashoffset={-offset}
                />
                <circle
                  cx={ring / 2}
                  cy={ring / 2}
                  r={r}
                  fill="none"
                  stroke={i < stepIndex ? accent : dark ? '#a7f3d0' : '#93c5fd'}
                  strokeWidth={7}
                  strokeLinecap="round"
                  strokeDasharray={`${Math.max(0.001, seg * fill)} ${circumference}`}
                  strokeDashoffset={-offset}
                  style={{ transition: 'stroke-dasharray .15s linear' }}
                />
              </g>
            )
          })}
        </svg>

        <div
          className="absolute overflow-hidden rounded-full bg-black"
          style={{ inset: (ring - size) / 2, boxShadow: dark ? 'none' : 'inset 0 0 0 1px #dfe4ec' }}
        >
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="size-full object-cover"
            style={{ transform: 'scaleX(-1)' }}
          />
          <canvas ref={overlayRef} className="pointer-events-none absolute inset-0 size-full" />
          {flash > 0 && <div key={flash} className="scan-flash pointer-events-none absolute inset-0 bg-white" />}
          {countdown !== null && countdown > 0 && (
            <div className="absolute inset-0 flex items-center justify-center text-[72px] font-extrabold text-white/90 drop-shadow">
              {countdown}
            </div>
          )}
          {(status || busy) && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/55 px-6 text-center text-[14px] font-semibold text-white">
              {!error && (
                <span className="size-8 animate-spin rounded-full border-[3px] border-white/30 border-t-white" />
              )}
              {busy ?? status}
            </div>
          )}
        </div>

        {arrow && !busy && (
          <div
            className="scan-arrow absolute"
            style={
              {
                ...(arrow === 'left'
                  ? { left: -26, top: ring / 2 - 17, '--dx': '-6px' }
                  : arrow === 'right'
                    ? { right: -26, top: ring / 2 - 17, '--dx': '6px' }
                    : arrow === 'up'
                      ? { top: -26, left: ring / 2 - 17, '--dy': '-6px' }
                      : { bottom: -26, left: ring / 2 - 17, '--dy': '6px' }),
              } as CSSProperties
            }
          >
            <Arrow dir={arrow} color={accent} />
          </div>
        )}
      </div>

      <div className="mt-[22px] min-h-[64px] text-center">
        <div className={`text-[19px] font-extrabold leading-[26px] ${dark ? 'text-white' : 'text-[#191f28]'}`}>
          {busy ? '' : label}
        </div>
        <div className={`mt-[6px] text-[13.5px] font-medium ${dark ? 'text-white/65' : 'text-[#6b7684]'}`}>
          {busy
            ? ''
            : (hint ??
              (steps && stepIndex < total
                ? `${stepIndex + 1} / ${total}${mode === 'manual' ? ' · гараар горим' : ''}`
                : ''))}
        </div>
      </div>
    </div>
  )
}
