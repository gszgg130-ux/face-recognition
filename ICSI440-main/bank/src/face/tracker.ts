/**
 * On-device face tracking with MediaPipe Face Landmarker (478 landmarks + blendshapes).
 *
 * Runs in the browser at camera frame rate. It does NOT decide who you are or
 * whether you are real - the server does that. It only gives instant guidance
 * ("come closer", "turn left") and picks the right moment to capture each frame
 * for the server-side liveness challenge.
 */
import { FaceLandmarker, type NormalizedLandmark } from '@mediapipe/tasks-vision'
import wasmLoaderPath from '@mediapipe/tasks-vision/vision_wasm_internal.js?url'
import wasmBinaryPath from '@mediapipe/tasks-vision/vision_wasm_internal.wasm?url'

const REMOTE_MODEL =
  'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task'
// `pnpm fetch-models` puts a copy here so the demo also works offline.
const LOCAL_MODEL = `${import.meta.env.BASE_URL}models/face_landmarker.task`

export interface FaceSignal {
  /** Number of faces in the frame. */
  count: number
  /** Face centre / size in *mirrored* (selfie) coordinates, 0..1 of the frame. */
  cx: number
  cy: number
  size: number
  /** Approximate head yaw in degrees. + = user turns to their right (same convention as the server). */
  yaw: number
  /** Nose position between eyes (0) and mouth (1). Grows when looking down. */
  pitchRatio: number
  /** Eye closure 0 (open) .. 1 (closed). */
  blink: number
  /** A light subset of mirrored landmarks for drawing the mesh overlay. */
  points: { x: number; y: number }[]
}

let landmarkerPromise: Promise<FaceLandmarker> | null = null

async function pickModel(): Promise<string> {
  try {
    const res = await fetch(LOCAL_MODEL, { method: 'HEAD' })
    const type = res.headers.get('content-type') ?? ''
    if (res.ok && !type.includes('text/html')) return LOCAL_MODEL
  } catch {
    /* fall through to the CDN copy */
  }
  return REMOTE_MODEL
}

export function loadTracker(): Promise<FaceLandmarker> {
  if (!landmarkerPromise) {
    landmarkerPromise = (async () => {
      const modelAssetPath = await pickModel()
      const fileset = { wasmLoaderPath, wasmBinaryPath }
      const options = (delegate: 'GPU' | 'CPU') => ({
        baseOptions: { modelAssetPath, delegate },
        runningMode: 'VIDEO' as const,
        numFaces: 2,
        outputFaceBlendshapes: true,
        minFaceDetectionConfidence: 0.5,
        minFacePresenceConfidence: 0.5,
        minTrackingConfidence: 0.5,
      })
      try {
        return await FaceLandmarker.createFromOptions(fileset, options('GPU'))
      } catch {
        return await FaceLandmarker.createFromOptions(fileset, options('CPU'))
      }
    })()
    landmarkerPromise.catch(() => {
      landmarkerPromise = null // allow a retry later
    })
  }
  return landmarkerPromise
}

const MESH_SUBSET = Array.from({ length: 468 }, (_, i) => i).filter((i) => i % 4 === 0)

/** Turn raw landmarks into the few numbers the UI needs. */
export function readSignal(
  landmarker: FaceLandmarker,
  source: HTMLCanvasElement | HTMLVideoElement,
  timestamp: number,
): FaceSignal | null {
  const width = source instanceof HTMLVideoElement ? source.videoWidth : source.width
  const height = source instanceof HTMLVideoElement ? source.videoHeight : source.height
  if (!width || !height) return null
  const result = landmarker.detectForVideo(source, timestamp)
  const faces = result.faceLandmarks
  if (!faces.length) return { count: 0, cx: 0.5, cy: 0.5, size: 0, yaw: 0, pitchRatio: 0.5, blink: 0, points: [] }

  // The largest face is the customer; others are bystanders.
  const spans = faces.map((lm) => {
    const xs = lm.map((p) => p.x)
    return Math.max(...xs) - Math.min(...xs)
  })
  const index = spans.indexOf(Math.max(...spans))
  const lm = faces[index] as NormalizedLandmark[]
  const bystanders = spans.filter((s, i) => i !== index && s > spans[index]! * 0.6).length

  const px = (i: number) => ({ x: lm[i]!.x * width, y: lm[i]!.y * height })
  const eyeA = px(33) // subject's right eye outer corner (image left in a raw frame)
  const eyeB = px(263) // subject's left eye outer corner (image right)
  const nose = px(1)
  const mouthL = px(61)
  const mouthR = px(291)
  const eyeMid = { x: (eyeA.x + eyeB.x) / 2, y: (eyeA.y + eyeB.y) / 2 }
  const mouthMid = { x: (mouthL.x + mouthR.x) / 2, y: (mouthL.y + mouthR.y) / 2 }
  const iod = Math.hypot(eyeB.x - eyeA.x, eyeB.y - eyeA.y) || 1
  const u = { x: (eyeB.x - eyeA.x) / iod, y: (eyeB.y - eyeA.y) / iod } // along the eye line
  const v = { x: -u.y, y: u.x } // perpendicular, pointing down the face
  const rel = { x: nose.x - eyeMid.x, y: nose.y - eyeMid.y }
  // Nose tip sits ~0.5 inter-ocular distances in front of the eye corners, so
  // its sideways offset r ≈ 0.5·tan(yaw). A nose moving to the image-left means
  // the user turned to *their* right, which we report as positive yaw.
  const r = (rel.x * u.x + rel.y * u.y) / iod
  const yaw = (-Math.atan2(r, 0.5) * 180) / Math.PI
  const faceHeight = (mouthMid.x - eyeMid.x) * v.x + (mouthMid.y - eyeMid.y) * v.y || 1
  const pitchRatio = (rel.x * v.x + rel.y * v.y) / faceHeight

  // Blink: blendshapes when available, eye aspect ratio as a fallback.
  const shapes = result.faceBlendshapes[index]?.categories ?? []
  const score = (name: string) => shapes.find((c) => c.categoryName === name)?.score
  const left = score('eyeBlinkLeft')
  const right = score('eyeBlinkRight')
  const ear = (top: number, bottom: number, a: number, b: number) =>
    Math.hypot(px(top).x - px(bottom).x, px(top).y - px(bottom).y) /
    (Math.hypot(px(a).x - px(b).x, px(a).y - px(b).y) || 1)
  const earAvg = (ear(159, 145, 33, 133) + ear(386, 374, 362, 263)) / 2
  const earClosed = Math.min(1, Math.max(0, (0.28 - earAvg) / 0.16))
  const blink = left !== undefined && right !== undefined ? Math.max((left + right) / 2, earClosed) : earClosed

  const xs = lm.map((p) => p.x)
  const ys = lm.map((p) => p.y)
  const minX = Math.min(...xs)
  const maxX = Math.max(...xs)
  return {
    count: 1 + bystanders,
    cx: 1 - (minX + maxX) / 2,
    cy: (Math.min(...ys) + Math.max(...ys)) / 2,
    size: maxX - minX,
    yaw,
    pitchRatio,
    blink,
    points: MESH_SUBSET.map((i) => ({ x: 1 - lm[i]!.x, y: lm[i]!.y })),
  }
}
