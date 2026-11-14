import { useCallback, useEffect, useRef, useState } from 'react'
import { api, ApiError, formatMnt, type ApiTransaction, type CapturedFrame, type MlReport } from '../api'
import { AlertIcon, CardIcon, CheckIcon, FaceIdIcon, LockIcon, ScanLineIcon, ShieldIcon } from '../components/Icons'
import PinPad from '../components/PinPad'
import { MERCHANT } from '../data'
import FaceScanner, { type ScannerStep } from '../face/FaceScanner'
import { loadTracker } from '../face/tracker'
import type { Order } from './types'

type Screen =
  | { kind: 'idle' }
  | { kind: 'checkout'; note?: string }
  | { kind: 'scan'; steps: ScannerStep[] | null; challengeId: string | null; busy: string | null }
  | { kind: 'pin'; paymentId: string; maskedName: string; initial: string; pinLength: number }
  | { kind: 'processing' }
  | { kind: 'approved'; tx: ApiTransaction }
  | { kind: 'failed'; code: string; title: string; message: string; canRetry: boolean }

interface TerminalProps {
  order: Order | null
  showMesh: boolean
  onReport: (report: MlReport | null) => void
  onFinished: (tx: ApiTransaction | null) => void
}

const FAIL_TITLES: Record<string, string> = {
  liveness_failed: 'Амьд байдал баталгаажсангүй',
  no_match: 'Танигдсангүй',
  pin_locked: 'Face Pay түгжигдсэн',
  insufficient_funds: 'Үлдэгдэл хүрэлцэхгүй',
  payment_expired: 'Хугацаа дууслаа',
  challenge_expired: 'Хугацаа дууслаа',
  offline: 'Сервертэй холбогдсонгүй',
  not_me: 'Цуцлагдлаа',
}
const NO_RETRY = new Set(['pin_locked', 'insufficient_funds', 'offline'])

function useClock() {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 15000)
    return () => window.clearInterval(id)
  }, [])
  return now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
}

function FailIcon({ code }: { code: string }) {
  const Icon = code === 'pin_locked' ? LockIcon : code === 'liveness_failed' ? ShieldIcon : AlertIcon
  return (
    <span className="flex size-[84px] items-center justify-center rounded-full bg-[#fff0f0] text-[#f04452]">
      <Icon size={42} strokeWidth={1.9} />
    </span>
  )
}

/** Customer-facing Face Pay terminal (the "POS POV"), modelled on Korean pay-by-face terminals. */
export default function Terminal({ order, showMesh, onReport, onFinished }: TerminalProps) {
  const [screen, setScreen] = useState<Screen>({ kind: 'idle' })
  const [pin, setPin] = useState('')
  const [pinError, setPinError] = useState<string | null>(null)
  const [shake, setShake] = useState(0)
  const [shuffle, setShuffle] = useState(0)
  const [leaving, setLeaving] = useState(100)
  const clock = useClock()
  const orderRef = useRef(order)
  orderRef.current = order

  useEffect(() => {
    loadTracker().catch(() => undefined) // warm up MediaPipe before the first customer
  }, [])

  useEffect(() => {
    setScreen(order ? { kind: 'checkout' } : { kind: 'idle' })
    setPin('')
    setPinError(null)
  }, [order])

  const fail = useCallback(
    (err: unknown) => {
      const e = err instanceof ApiError ? err : new ApiError(0, { message: String(err) })
      if (e.report) onReport(e.report)
      const isFrameError = e.status === 422 && !!e.step
      setScreen({
        kind: 'failed',
        code: e.code,
        title: isFrameError ? 'Нүүр тод харагдсангүй' : (FAIL_TITLES[e.code] ?? 'Төлбөр амжилтгүй'),
        message: e.message,
        canRetry: !NO_RETRY.has(e.code),
      })
    },
    [onReport],
  )

  const startScan = useCallback(async () => {
    setScreen({ kind: 'scan', steps: null, challengeId: null, busy: null })
    try {
      const ch = await api.challenge('pay')
      setScreen({ kind: 'scan', steps: ch.steps, challengeId: ch.challenge_id, busy: null })
    } catch (err) {
      fail(err)
    }
  }, [fail])

  const onFrames = useCallback(
    async (frames: CapturedFrame[]) => {
      const current = orderRef.current
      if (screen.kind !== 'scan' || !screen.challengeId || !current) return
      setScreen({ ...screen, busy: 'Таньж байна…' })
      try {
        const res = await api.payIdentify(screen.challengeId, frames, current.total, MERCHANT.id)
        onReport(res.report)
        setPin('')
        setPinError(null)
        setShuffle((s) => s + 1)
        setScreen({
          kind: 'pin',
          paymentId: res.payment_id,
          maskedName: res.user.masked_name,
          initial: res.user.initial,
          pinLength: res.pin_length,
        })
      } catch (err) {
        fail(err)
      }
    },
    [screen, onReport, fail],
  )

  const onPin = async (value: string) => {
    if (screen.kind !== 'pin') return
    setPin(value)
    setPinError(null)
    if (value.length < screen.pinLength) return
    const pinScreen = screen
    setScreen({ kind: 'processing' })
    try {
      const res = await api.payConfirm(pinScreen.paymentId, value)
      setScreen({ kind: 'approved', tx: res.transaction })
    } catch (err) {
      const e = err as ApiError
      if (e.code === 'wrong_pin') {
        setScreen(pinScreen)
        setPin('')
        setPinError(e.message)
        setShake((s) => s + 1)
        setShuffle((s) => s + 1)
      } else {
        fail(err)
      }
    }
  }

  const notMe = () => {
    if (screen.kind === 'pin') void api.payCancel(screen.paymentId)
    setScreen({
      kind: 'failed',
      code: 'not_me',
      title: FAIL_TITLES.not_me!,
      message: 'Төлбөр цуцлагдлаа. Дахин оролдох эсвэл өөр аргаар төлнө үү.',
      canRetry: true,
    })
  }

  // Approved screen returns to idle by itself, like a real terminal.
  useEffect(() => {
    if (screen.kind !== 'approved') return
    setLeaving(100)
    const started = Date.now()
    const id = window.setInterval(() => {
      const left = Math.max(0, 100 - ((Date.now() - started) / 7000) * 100)
      setLeaving(left)
      if (left === 0) {
        window.clearInterval(id)
        onFinished(screen.tx)
      }
    }, 100)
    return () => window.clearInterval(id)
  }, [screen, onFinished])

  const scanning = screen.kind === 'scan'
  const amount = order?.total ?? 0

  return (
    <div className="flex flex-col items-center">
      {/* device body */}
      <div className="relative w-[min(400px,calc(100vw-32px))] rounded-[40px] bg-gradient-to-b from-[#3a3f4a] via-[#23262e] to-[#17191e] p-[12px] pt-[46px] shadow-[0_40px_80px_rgba(10,20,40,.35),inset_0_1px_0_rgba(255,255,255,.12)]">
        {/* camera module: RGB lens, IR/depth lens, IR flood dots, status LED */}
        <div className="absolute left-1/2 top-[11px] flex h-[26px] -translate-x-1/2 items-center gap-[9px] rounded-full bg-[#0b0c0f] px-[14px] ring-1 ring-white/5">
          <span className="size-[5px] rounded-full bg-[#3a1f1f]" />
          <span className="size-[13px] rounded-full bg-[radial-gradient(circle_at_35%_35%,#5b6b8c,#0d1424_60%)] ring-2 ring-[#1d2230]" />
          <span className="size-[9px] rounded-full bg-[radial-gradient(circle_at_35%_35%,#6b3b55,#1a0d14_65%)] ring-2 ring-[#1d2230]" />
          <span className="flex gap-[3px]">
            {[0, 1, 2].map((i) => (
              <span key={i} className="size-[3px] rounded-full bg-[#2a2d35]" />
            ))}
          </span>
          <span
            className={`size-[6px] rounded-full transition ${scanning ? 'animate-pulse bg-[#4ade80] shadow-[0_0_8px_#4ade80]' : 'bg-[#1f3326]'}`}
          />
        </div>

        {/* screen */}
        <div className="relative h-[640px] overflow-hidden rounded-[26px] bg-white text-[#191f28] max-sm:h-[600px]">
          <div className="flex h-[44px] items-center justify-between px-[20px] text-[12.5px] font-bold text-[#8b95a1]">
            <span>{MERCHANT.name}</span>
            <span className="tabular-nums">{clock}</span>
          </div>

          {screen.kind === 'idle' && (
            <div className="fade-in flex h-[calc(100%-44px)] flex-col items-center px-[28px] pt-[70px] text-center">
              <div className="relative flex size-[170px] items-center justify-center">
                <span className="pos-pulse absolute inset-0 rounded-full bg-brand/10" />
                <span className="pos-pulse absolute inset-[22px] rounded-full bg-brand/15 [animation-delay:.6s]" />
                <span className="relative flex size-[96px] items-center justify-center rounded-[30px] bg-brand text-white shadow-[0_14px_34px_rgba(34,82,159,.4)]">
                  <FaceIdIcon size={54} strokeWidth={1.6} />
                </span>
              </div>
              <h2 className="mt-[34px] text-[30px] font-extrabold leading-[38px] tracking-tight">
                Нүүрээрээ
                <br />
                төлөөрэй
              </h2>
              <p className="mt-[12px] text-[15px] font-medium text-[#6b7684]">Карт, утас хэрэггүй · TDB Face Pay</p>
              <div className="mt-auto mb-[34px] w-full rounded-[18px] bg-[#f2f4f6] px-[18px] py-[14px] text-[13.5px] font-semibold text-[#4e5968]">
                Бараагаа касс дээр уншуулна уу
              </div>
            </div>
          )}

          {screen.kind === 'checkout' && order && (
            <div className="fade-in flex h-[calc(100%-44px)] flex-col px-[22px] pb-[22px] pt-[16px]">
              <div className="text-[15px] font-bold text-[#6b7684]">Төлөх дүн</div>
              <div className="mt-[4px] text-[40px] font-extrabold tracking-tight tabular-nums">{formatMnt(amount)}</div>
              <ul className="no-scrollbar mt-[14px] max-h-[150px] space-y-[8px] overflow-y-auto border-y border-[#f2f4f6] py-[12px] text-[14px]">
                {order.items.map(({ product, qty }) => (
                  <li key={product.id} className="flex justify-between font-medium text-[#4e5968]">
                    <span>
                      {product.name} <span className="text-[#8b95a1]">× {qty}</span>
                    </span>
                    <span className="tabular-nums">{formatMnt(product.price * qty)}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-auto space-y-[10px]">
                <button
                  onClick={() => void startScan()}
                  className="flex h-[96px] w-full items-center gap-[16px] rounded-[22px] bg-brand px-[20px] text-left text-white shadow-[0_12px_28px_rgba(34,82,159,.35)] active:scale-[.99]"
                >
                  <span className="flex size-[56px] items-center justify-center rounded-[18px] bg-white/15">
                    <FaceIdIcon size={34} strokeWidth={1.7} />
                  </span>
                  <span>
                    <span className="block text-[21px] font-extrabold">Нүүрээр төлөх</span>
                    <span className="mt-[2px] block text-[13px] font-medium text-white/75">
                      Камер руу хараад ПИН кодоо оруулна
                    </span>
                  </span>
                </button>
                <div className="grid grid-cols-2 gap-[10px]">
                  {[
                    { label: 'Карт', Icon: CardIcon },
                    { label: 'QPay', Icon: ScanLineIcon },
                  ].map(({ label, Icon }) => (
                    <button
                      key={label}
                      onClick={() =>
                        setScreen({ kind: 'checkout', note: `${label}: энэ демо-д зөвхөн Face Pay ажиллана.` })
                      }
                      className="flex h-[58px] items-center justify-center gap-[8px] rounded-[18px] bg-[#f2f4f6] text-[15px] font-bold text-[#4e5968]"
                    >
                      <Icon size={20} /> {label}
                    </button>
                  ))}
                </div>
                <p className="h-[16px] text-center text-[12px] font-semibold text-[#8b95a1]">{screen.note ?? ''}</p>
              </div>
            </div>
          )}

          {screen.kind === 'scan' && (
            <div className="fade-in flex h-[calc(100%-44px)] flex-col items-center px-[22px] pt-[8px]">
              <span className="rounded-full bg-[#f2f4f6] px-[14px] py-[6px] text-[14px] font-extrabold tabular-nums">
                {formatMnt(amount)}
              </span>
              <h2 className="mt-[14px] text-[22px] font-extrabold">Камер руу харна уу</h2>
              <p className="mt-[4px] text-[13px] font-medium text-[#8b95a1]">Дэлгэцийн зааврыг дагана уу</p>
              <div className="mt-[26px]">
                <FaceScanner
                  steps={screen.steps}
                  busy={screen.busy}
                  onComplete={(f) => void onFrames(f)}
                  variant="pos"
                  size={236}
                  showMesh={showMesh}
                />
              </div>
              <button
                onClick={() => setScreen({ kind: 'checkout' })}
                className="mb-[22px] mt-auto h-[50px] w-full rounded-[16px] bg-[#f2f4f6] text-[15px] font-bold text-[#4e5968]"
              >
                Цуцлах
              </button>
            </div>
          )}

          {screen.kind === 'pin' && (
            <div className="fade-in flex h-[calc(100%-44px)] flex-col items-center px-[22px] pt-[10px]">
              <span className="flex size-[60px] items-center justify-center rounded-full bg-brand-soft text-[24px] font-extrabold text-brand">
                {screen.initial}
              </span>
              <h2 className="mt-[12px] text-[21px] font-extrabold">{screen.maskedName}, та мөн үү?</h2>
              <p className="mt-[4px] text-[14px] font-medium text-[#6b7684]">
                {formatMnt(amount)} төлөхийн тулд ПИН кодоо оруулна уу
              </p>
              <div className="mt-[22px] w-full">
                <PinPad
                  length={screen.pinLength}
                  value={pin}
                  onChange={(v) => void onPin(v)}
                  scramble
                  shuffleKey={shuffle}
                  variant="pos"
                  error={pinError}
                  shakeKey={shake}
                />
              </div>
              <button
                onClick={notMe}
                className="mb-[16px] mt-auto text-[14px] font-bold text-[#8b95a1] underline-offset-4 hover:underline"
              >
                Би биш
              </button>
            </div>
          )}

          {screen.kind === 'processing' && (
            <div className="flex h-[calc(100%-44px)] flex-col items-center justify-center gap-[18px]">
              <span className="size-[52px] animate-spin rounded-full border-[5px] border-brand/15 border-t-brand" />
              <p className="text-[17px] font-bold">Төлбөр хийгдэж байна…</p>
            </div>
          )}

          {screen.kind === 'approved' && (
            <div className="fade-in flex h-[calc(100%-44px)] flex-col items-center px-[24px] pt-[60px] text-center">
              <span className="pop-in flex size-[96px] items-center justify-center rounded-full bg-[#22c55e] text-white shadow-[0_14px_40px_rgba(34,197,94,.35)]">
                <CheckIcon size={54} strokeWidth={2.6} />
              </span>
              <h2 className="mt-[24px] text-[26px] font-extrabold">Төлбөр амжилттай</h2>
              <div className="mt-[6px] text-[34px] font-extrabold tracking-tight tabular-nums">
                {formatMnt(screen.tx.amount)}
              </div>
              <dl className="mt-[26px] w-full space-y-[10px] rounded-[18px] bg-[#f7f8fa] p-[16px] text-left text-[13.5px]">
                {[
                  ['Төлбөрийн хэрэгсэл', 'TDB Face Pay'],
                  ['Баталгаажуулах код', screen.tx.approval_code ?? '—'],
                  ['Огноо', new Date(screen.tx.created_at).toLocaleString('en-GB')],
                  ['Терминал', MERCHANT.terminalId],
                ].map(([k, v]) => (
                  <div key={k} className="flex justify-between gap-4">
                    <dt className="text-[#8b95a1]">{k}</dt>
                    <dd className="font-bold tabular-nums">{v}</dd>
                  </div>
                ))}
              </dl>
              <p className="mt-[18px] text-[14px] font-semibold text-[#6b7684]">Баярлалаа! Дахин ирээрэй.</p>
              <div className="mb-[26px] mt-auto h-[4px] w-full overflow-hidden rounded-full bg-[#eef1f5]">
                <div className="h-full bg-[#22c55e] transition-[width] duration-100" style={{ width: `${leaving}%` }} />
              </div>
            </div>
          )}

          {screen.kind === 'failed' && (
            <div className="fade-in flex h-[calc(100%-44px)] flex-col items-center px-[24px] pt-[80px] text-center">
              <FailIcon code={screen.code} />
              <h2 className="mt-[24px] text-[23px] font-extrabold">{screen.title}</h2>
              <p className="mt-[10px] text-[15px] font-medium leading-[23px] text-[#6b7684]">{screen.message}</p>
              <div className="mb-[22px] mt-auto w-full space-y-[10px]">
                {screen.canRetry && (
                  <button
                    onClick={() => void startScan()}
                    className="h-[54px] w-full rounded-[16px] bg-brand text-[16px] font-bold text-white"
                  >
                    Дахин оролдох
                  </button>
                )}
                <button
                  onClick={() => (order ? setScreen({ kind: 'checkout' }) : onFinished(null))}
                  className="h-[54px] w-full rounded-[16px] bg-[#f2f4f6] text-[16px] font-bold text-[#4e5968]"
                >
                  Өөр аргаар төлөх
                </button>
              </div>
            </div>
          )}
        </div>

        {/* chin: contactless reader */}
        <div className="flex h-[46px] items-center justify-center gap-[10px] text-white/35">
          <svg
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            aria-hidden="true"
          >
            <path d="M8.5 7.5a6 6 0 0 1 0 9M12 5a9.5 9.5 0 0 1 0 14M15.5 2.5a13 13 0 0 1 0 19" />
          </svg>
          <span className="text-[11px] font-extrabold tracking-[0.25em]">TDB FACE PAY</span>
        </div>
      </div>
      {/* stand */}
      <div className="h-[34px] w-[120px] bg-gradient-to-b from-[#1b1d22] to-[#2c3038] [clip-path:polygon(18%_0,82%_0,100%_100%,0_100%)]" />
      <div className="h-[14px] w-[230px] rounded-[50%] bg-gradient-to-b from-[#3a3f4a] to-[#1b1d22] shadow-[0_18px_30px_rgba(10,20,40,.3)]" />
    </div>
  )
}
