/** Thin client for the Flask + MongoDB backend in ../biometric-payment. */

// In dev, Vite proxies /api to http://127.0.0.1:5000 (see vite.config.ts).
// Set VITE_API_URL to call another host directly.
const BASE = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, '') ?? ''

export interface FrameReport {
  step: string
  det_score: number
  face_px: number
  sharpness: number
  brightness: number
  liveness: number | null
  yaw: number | null
  pitch: number | null
  roll: number | null
  eyes_open: number | null
  quality: number | null
  ms: Record<string, number>
}

export interface LivenessCheck {
  step: string
  passed: boolean
  measured: number | null
  required: string
}

export interface MlReport {
  frames: FrameReport[]
  liveness: {
    passed: boolean
    reason: string | null
    passive: number
    passive_min: number
    consistency_min: number
    motion: number
    checks: LivenessCheck[]
  }
  models: Record<string, string>
  match?: {
    score: number
    margin: number
    threshold: number
    min_margin: number
    top: { name: string; score: number }[]
  }
  ms_total?: number
}

export interface PublicUser {
  id: string
  name: string
  masked_name: string
  balance: number
  faceid: { enabled: boolean; enrolled_at: string | null; poses: string[]; model: string | null; source: string | null }
  pin_set: boolean
  pin_locked: boolean
}

export interface ApiTransaction {
  id: string
  user_name: string | null
  amount: number
  status: 'SUCCESS' | 'FAILED'
  method: 'face' | 'manual'
  merchant: string | null
  reason: string | null
  approval_code: string | null
  match_score: number | null
  liveness: number | null
  balance_after: number | null
  created_at: string
}

export interface Challenge {
  challenge_id: string
  steps: { id: StepId; label: string }[]
  expires_in: number
}

export type StepId = 'center' | 'turn_left' | 'turn_right' | 'look_up' | 'look_down' | 'blink'

export interface CapturedFrame {
  step: StepId
  image: string
}

export interface Health {
  ok: boolean
  db: boolean
  models_ready: boolean
  models: Record<string, string>
  pin_length: number
  thresholds: Record<string, number>
}

export class ApiError extends Error {
  code: string
  status: number
  report?: MlReport
  attemptsLeft?: number
  step?: string

  constructor(status: number, data: Record<string, unknown>) {
    super(typeof data.message === 'string' ? data.message : 'Алдаа гарлаа.')
    this.status = status
    this.code = typeof data.code === 'string' ? data.code : 'error'
    this.report = data.report as MlReport | undefined
    this.attemptsLeft = typeof data.attempts_left === 'number' ? data.attempts_left : undefined
    this.step = typeof data.step === 'string' ? data.step : undefined
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response
  try {
    res = await fetch(`${BASE}${path}`, {
      ...init,
      headers: { 'Content-Type': 'application/json', ...init?.headers },
    })
  } catch {
    throw new ApiError(0, {
      code: 'offline',
      message: 'Сервертэй холбогдож чадсангүй. biometric-payment/app.py ажиллаж байгаа эсэхийг шалгана уу.',
    })
  }
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>
  if (!res.ok) throw new ApiError(res.status, data)
  return data as T
}

const post = <T>(path: string, body: unknown) => request<T>(path, { method: 'POST', body: JSON.stringify(body) })

export const api = {
  health: () => request<Health>('/api/health'),
  user: (name: string) => request<PublicUser>(`/api/users/${encodeURIComponent(name)}`),
  transactions: (name: string, limit = 10) =>
    request<ApiTransaction[]>(`/api/users/${encodeURIComponent(name)}/transactions?limit=${limit}`),
  disableFaceId: (name: string) =>
    request<{ user: PublicUser }>(`/api/users/${encodeURIComponent(name)}/faceid`, { method: 'DELETE' }),
  challenge: (purpose: 'enroll' | 'pay') => post<Challenge>('/api/liveness/challenge', { purpose }),
  enrollFaces: (name: string, challengeId: string, frames: CapturedFrame[]) =>
    post<{ enrollment_id: string; pin_length: number; report: MlReport }>('/api/enroll/faces', {
      name,
      challenge_id: challengeId,
      frames,
    }),
  enrollPin: (enrollmentId: string, pin: string) =>
    post<{ user: PublicUser }>('/api/enroll/pin', { enrollment_id: enrollmentId, pin }),
  payIdentify: (challengeId: string, frames: CapturedFrame[], amount: number, merchant: string) =>
    post<{
      payment_id: string
      pin_length: number
      amount: number
      user: { masked_name: string; initial: string }
      expires_in: number
      report: MlReport
    }>('/api/pay/identify', { challenge_id: challengeId, frames, amount, merchant }),
  payConfirm: (paymentId: string, pin: string) =>
    post<{ transaction: ApiTransaction; user: { masked_name: string } }>('/api/pay/confirm', {
      payment_id: paymentId,
      pin,
    }),
  payCancel: (paymentId: string) => post<{ success: boolean }>('/api/pay/cancel', { payment_id: paymentId }),
}

/** Same rules as the server (security.pin_problem), checked early for instant feedback. */
export function pinProblem(pin: string, length = 4): string | null {
  if (!/^\d+$/.test(pin) || pin.length !== length) return `ПИН код ${length} оронтой тоо байх ёстой.`
  if (new Set(pin).size === 1) return 'Бүх цифр ижил ПИН код ашиглах боломжгүй.'
  const diffs = new Set([...pin].slice(1).map((c, i) => Number(c) - Number(pin[i])))
  if (diffs.size === 1 && (diffs.has(1) || diffs.has(-1))) return 'Дараалсан цифр (жишээ нь 1234) ашиглах боломжгүй.'
  return null
}

export const formatMnt = (n: number) => `${Math.round(n).toLocaleString('en-US')}₮`
