// Downloads the MediaPipe Face Landmarker model into public/models so the
// Face Pay camera works without internet access (e.g. during a class demo).
//   pnpm fetch-models
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'

const URL =
  'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task'
const target = path.resolve(import.meta.dirname, '../public/models/face_landmarker.task')

const res = await fetch(URL)
if (!res.ok) throw new Error(`Download failed: ${res.status} ${res.statusText}`)
await mkdir(path.dirname(target), { recursive: true })
await writeFile(target, Buffer.from(await res.arrayBuffer()))
console.log(`Saved ${target}`)
