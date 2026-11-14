import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { api, ApiError, pinProblem, type CapturedFrame, type MlReport, type PublicUser } from '../api'
import {
  AlertIcon,
  ArrowLeftIcon,
  CheckIcon,
  FaceIdIcon,
  GlassesIcon,
  LockIcon,
  PosIcon,
  RefreshIcon,
  ShieldIcon,
  SunIcon,
  TrashIcon,
} from '../components/Icons'
import PinPad from '../components/PinPad'
import StatusBar from '../components/StatusBar'
import FaceScanner, { type ScannerStep } from '../face/FaceScanner'
import { loadTracker } from '../face/tracker'

type Stage = 'loading' | 'manage' | 'guide' | 'scan' | 'pin' | 'confirm' | 'saving' | 'done'

interface FacePaySetupProps {
  userName: string
  onBack: () => void
  onTryPos: () => void
  onChanged?: (user: PublicUser) => void
}

const STEP_NAMES = ['Заавар', 'Нүүр уншуулах', 'ПИН код']

function Stepper({ active, dark }: { active: number; dark: boolean }) {
  return (
    <div className="flex items-center gap-[6px] px-[20px]">
      {STEP_NAMES.map((name, i) => (
        <div key={name} className="flex flex-1 flex-col gap-[6px]">
          <div
            className={`h-[4px] rounded-full ${i <= active ? (dark ? 'bg-[#4ade80]' : 'bg-brand') : dark ? 'bg-white/15' : 'bg-[#e3e7ee]'}`}
          />
          <span
            className={`text-[11px] font-bold ${i === active ? (dark ? 'text-white' : 'text-brand') : dark ? 'text-white/45' : 'text-[#9aa3ad]'}`}
          >
            {i + 1}. {name}
          </span>
        </div>
      ))}
    </div>
  )
}

function Section({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) {
  return (
    <section className="rounded-[18px] bg-white p-[16px] shadow-[0_1px_0_rgba(0,0,0,.03)]">
      <h3 className="flex items-center gap-[10px] text-[15px] font-extrabold">
        <span className="flex size-[32px] items-center justify-center rounded-full bg-brand-soft text-brand">
          {icon}
        </span>
        {title}
      </h3>
      <div className="mt-[10px] space-y-[7px] text-[13.5px] leading-[20px] text-[#4e5968]">{children}</div>
    </section>
  )
}

function Bullet({ children }: { children: ReactNode }) {
  return (
    <p className="flex gap-[8px]">
      <span className="mt-[8px] size-[5px] shrink-0 rounded-full bg-brand" />
      <span>{children}</span>
    </p>
  )
}

/** Step 1: guidelines that must be scrolled to the end and agreed to before continuing. */
function Guide({ onContinue, offline }: { onContinue: () => void; offline: boolean }) {
  const endRef = useRef<HTMLDivElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const [read, setRead] = useState(false)
  const [agreed, setAgreed] = useState(false)

  useEffect(() => {
    loadTracker().catch(() => undefined) // warm up MediaPipe while the user reads
  }, [])

  useEffect(() => {
    const end = endRef.current
    if (!end) return
    const observer = new IntersectionObserver(([entry]) => entry?.isIntersecting && setRead(true), {
      root: scrollRef.current,
      threshold: 0.9,
    })
    observer.observe(end)
    return () => observer.disconnect()
  }, [])

  return (
    <>
      <div
        ref={scrollRef}
        className="no-scrollbar absolute inset-x-0 bottom-[96px] top-[150px] overflow-y-auto px-[16px] pb-[20px]"
      >
        <div className="flex flex-col items-center px-[10px] pb-[18px] pt-[6px] text-center">
          <span className="flex size-[72px] items-center justify-center rounded-[24px] bg-gradient-to-br from-[#4a7de0] to-[#1f4ca3] text-white shadow-[0_10px_30px_rgba(34,82,159,.35)]">
            <FaceIdIcon size={40} strokeWidth={1.7} />
          </span>
          <h2 className="mt-[14px] text-[21px] font-extrabold leading-[28px]">Нүүрээрээ төлөөрэй</h2>
          <p className="mt-[6px] text-[13.5px] leading-[20px] text-[#6b7684]">
            Карт, утас гаргахгүйгээр POS терминал руу хараад, ПИН кодоо оруулахад л төлбөр хийгдэнэ. Эхлэхээс өмнө доорх
            зааврыг бүрэн уншина уу.
          </p>
        </div>

        {offline && (
          <div className="mb-[12px] flex gap-[10px] rounded-[14px] bg-[#fff4e5] p-[12px] text-[12.5px] font-semibold leading-[18px] text-[#9a5b00]">
            <AlertIcon size={18} className="shrink-0" />
            Сервертэй холбогдоогүй байна. Нүүр уншуулахын өмнө biometric-payment/app.py-г ажиллуулна уу.
          </div>
        )}

        <div className="space-y-[12px]">
          <Section icon={<SunIcon size={18} />} title="Уншуулахын өмнө">
            <Bullet>Гэрэлтэй газар, гэрэл рүү харж зогсоно уу. Араас тусах гэрлээс зайлсхий.</Bullet>
            <Bullet>Нарны шил, амны хаалт, малгайгаа авна уу. Энгийн нүдний шил зүүж болно.</Bullet>
            <Bullet>Утсаа нүдний түвшинд, 30–40 см зайд барина уу. Үс нүүрийг бүү халхлаарай.</Bullet>
          </Section>
          <Section icon={<FaceIdIcon size={18} />} title="Уншуулах явц (~30 секунд)">
            <Bullet>
              Эхлээд <b>эгц</b>, дараа нь <b>зүүн</b>, <b>баруун</b>, <b>дээш</b>, <b>доош</b> харж нүүрээ 5 өнцгөөс
              уншуулна. Эцэст нь <b>нүдээ анивчина</b>.
            </Bullet>
            <Bullet>
              Дугуй хүрээ ногоон болж дүүрэх хүртэл тухайн байрлалдаа байгаарай. Камер автоматаар зураг авна.
            </Bullet>
            <Bullet>Олон өнцгөөс уншуулснаар толгойгоо бага зэрэг эргүүлсэн үед ч POS таньж чадна.</Bullet>
          </Section>
          <Section icon={<ShieldIcon size={18} />} title="Амьд байдлын шалгалт">
            <Bullet>
              Хиймэл оюун ухаан (MiniFASNet) таны зураг, видео, дэлгэц эсвэл маск биш, амьд хүн гэдгийг шалгана.
            </Bullet>
            <Bullet>
              Сервер санамсаргүй даалгавар (эргэх, анивчих) өгч, хариуг өөрөө дахин хэмждэг тул бичлэгээр хуурах
              боломжгүй.
            </Bullet>
          </Section>
          <Section icon={<LockIcon size={18} />} title="Хувийн мэдээлэл ба аюулгүй байдал">
            <Bullet>
              Таны <b>зургийг хадгалахгүй</b>. Зөвхөн нүүрнээс гаргаж авсан 512 тооноос бүрдэх математик загварыг банкны
              серверт хадгална.
            </Bullet>
            <Bullet>
              Нүүрээр төлөх бүрт <b>4 оронтой ПИН код</b> давхар асууна. ПИН кодоо хэнд ч бүү хэл.
            </Bullet>
            <Bullet>ПИН код 5 удаа буруу орвол Face Pay 15 минут түгжигдэнэ.</Bullet>
            <Bullet>Face Pay-г хүссэн үедээ энэ цэснээс идэвхгүй болгож, загвараа устгах боломжтой.</Bullet>
          </Section>
          <Section icon={<GlassesIcon size={18} />} title="Анхаарах зүйл">
            <Bullet>Ихэр болон адилхан төрхтэй хүмүүсийг ПИН код хамгаална.</Bullet>
            <Bullet>Гадаад төрх эрс өөрчлөгдвөл (сахал, мэс засал) нүүрээ дахин бүртгүүлнэ үү.</Bullet>
          </Section>
        </div>

        <div ref={endRef} className="mt-[16px]">
          <label
            className={`flex items-start gap-[12px] rounded-[16px] p-[14px] transition ${
              read ? 'bg-white' : 'bg-white/60 opacity-60'
            }`}
          >
            <input
              type="checkbox"
              disabled={!read}
              checked={agreed}
              onChange={(e) => setAgreed(e.target.checked)}
              className="mt-[2px] size-[20px] accent-[#22529f]"
            />
            <span className="text-[13.5px] font-semibold leading-[20px]">
              Би зааврыг бүрэн уншиж, биометрийн мэдээллээ төлбөр баталгаажуулахад ашиглахыг зөвшөөрч байна.
            </span>
          </label>
        </div>
      </div>

      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-surface via-surface to-transparent px-[16px] pb-[30px] pt-[14px]">
        <button
          disabled={!read || !agreed}
          onClick={onContinue}
          className="h-[54px] w-full rounded-[16px] bg-brand text-[16px] font-bold text-white transition disabled:bg-[#c9d3e3]"
        >
          {!read ? 'Доош гүйлгэж бүрэн уншина уу ↓' : !agreed ? 'Зөвшөөрлөө тэмдэглэнэ үү' : 'Үргэлжлүүлэх'}
        </button>
      </div>
    </>
  )
}

export default function FacePaySetup({ userName, onBack, onTryPos, onChanged }: FacePaySetupProps) {
  const [stage, setStage] = useState<Stage>('loading')
  const [user, setUser] = useState<PublicUser | null>(null)
  const [offline, setOffline] = useState(false)
  const [steps, setSteps] = useState<ScannerStep[] | null>(null)
  const [challengeId, setChallengeId] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [scanError, setScanError] = useState<string | null>(null)
  const [report, setReport] = useState<MlReport | null>(null)
  const [enrollmentId, setEnrollmentId] = useState<string | null>(null)
  const [pinLength, setPinLength] = useState(4)
  const [pin, setPin] = useState('')
  const [firstPin, setFirstPin] = useState('')
  const [pinError, setPinError] = useState<string | null>(null)
  const [shake, setShake] = useState(0)
  const [confirmDisable, setConfirmDisable] = useState(false)

  useEffect(() => {
    api
      .user(userName)
      .then((u) => {
        setUser(u)
        setStage(u.faceid.enabled ? 'manage' : 'guide')
      })
      .catch((err: ApiError) => {
        setOffline(err.code === 'offline')
        setStage('guide')
      })
  }, [userName])

  const newChallenge = useCallback(async () => {
    setScanError(null)
    setSteps(null)
    setBusy(null)
    try {
      const ch = await api.challenge('enroll')
      setChallengeId(ch.challenge_id)
      setSteps(ch.steps)
    } catch (err) {
      setScanError((err as ApiError).message)
    }
  }, [])

  useEffect(() => {
    if (stage === 'scan') void newChallenge()
  }, [stage, newChallenge])

  const onFrames = useCallback(
    async (frames: CapturedFrame[]) => {
      if (!challengeId) return
      setBusy('AI шалгаж байна…')
      try {
        const res = await api.enrollFaces(userName, challengeId, frames)
        setReport(res.report)
        setEnrollmentId(res.enrollment_id)
        setPinLength(res.pin_length)
        setPin('')
        setPinError(null)
        setStage('pin')
      } catch (err) {
        const e = err as ApiError
        setReport(e.report ?? null)
        setScanError(e.message)
        setBusy(null)
        setSteps(null)
      }
    },
    [challengeId, userName],
  )

  const onPin = async (value: string) => {
    setPin(value)
    setPinError(null)
    if (value.length < pinLength) return
    if (stage === 'pin') {
      const problem = pinProblem(value, pinLength)
      if (problem) {
        setPinError(problem)
        setShake((s) => s + 1)
        window.setTimeout(() => setPin(''), 450)
        return
      }
      setFirstPin(value)
      window.setTimeout(() => {
        setPin('')
        setStage('confirm')
      }, 180)
      return
    }
    if (value !== firstPin) {
      setPinError('ПИН код таарсангүй. Дахин үүсгэнэ үү.')
      setShake((s) => s + 1)
      window.setTimeout(() => {
        setPin('')
        setFirstPin('')
        setStage('pin')
      }, 900)
      return
    }
    setStage('saving')
    try {
      const res = await api.enrollPin(enrollmentId ?? '', value)
      setUser(res.user)
      onChanged?.(res.user)
      setStage('done')
    } catch (err) {
      const e = err as ApiError
      if (e.code === 'enrollment_expired') {
        setScanError(e.message)
        setStage('scan')
      } else {
        setPinError(e.message)
        setPin('')
        setFirstPin('')
        setStage('pin')
      }
    }
  }

  const disable = async () => {
    if (!confirmDisable) {
      setConfirmDisable(true)
      return
    }
    try {
      const res = await api.disableFaceId(userName)
      setUser(res.user)
      onChanged?.(res.user)
      setConfirmDisable(false)
      setStage('guide')
    } catch (err) {
      setScanError((err as ApiError).message)
    }
  }

  const dark = stage === 'scan'
  const stepperIndex = stage === 'guide' ? 0 : stage === 'scan' ? 1 : 2
  const showStepper = ['guide', 'scan', 'pin', 'confirm', 'saving'].includes(stage)

  return (
    <div className={`absolute inset-0 z-30 ${dark ? 'bg-[#0b0f19] text-white' : 'bg-surface'}`}>
      <StatusBar tone={dark ? 'light' : 'dark'} battery={77} />

      <div className="absolute inset-x-0 top-[50px] flex h-[48px] items-center px-[12px]">
        <button
          onClick={onBack}
          aria-label="Буцах"
          className="flex size-[40px] items-center justify-center rounded-full"
        >
          <ArrowLeftIcon size={24} strokeWidth={2} />
        </button>
        <h1 className="flex-1 pr-[40px] text-center text-[16px] font-bold">Face Pay тохиргоо</h1>
      </div>

      {showStepper && (
        <div className="absolute inset-x-0 top-[104px]">
          <Stepper active={stepperIndex} dark={dark} />
        </div>
      )}

      {stage === 'loading' && (
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="size-8 animate-spin rounded-full border-[3px] border-brand/20 border-t-brand" />
        </div>
      )}

      {stage === 'guide' && <Guide offline={offline} onContinue={() => setStage('scan')} />}

      {stage === 'scan' && (
        <div className="absolute inset-x-0 bottom-0 top-[150px] flex flex-col items-center px-[20px] pt-[18px]">
          <p className="mb-[26px] text-center text-[13.5px] font-medium leading-[20px] text-white/65">
            Дугуй хүрээнд нүүрээ байрлуулж, зааврыг дагана уу.
            <br />5 өнцгөөс уншуулаад нүдээ анивчина.
          </p>
          {scanError ? (
            <div className="mt-[10px] flex w-full flex-col items-center rounded-[22px] bg-white/[.06] p-[22px] text-center">
              <span className="flex size-[52px] items-center justify-center rounded-full bg-[#f04452]/15 text-[#ff6b77]">
                <AlertIcon size={28} />
              </span>
              <p className="mt-[14px] text-[15px] font-bold leading-[22px]">{scanError}</p>
              {report && (
                <p className="mt-[8px] text-[12px] text-white/50">
                  P(real) {report.liveness.passive.toFixed(2)} · ижил хүн {report.liveness.consistency_min.toFixed(2)}
                </p>
              )}
              <button
                onClick={() => void newChallenge()}
                className="mt-[18px] flex h-[48px] items-center gap-[8px] rounded-full bg-white px-[22px] text-[15px] font-bold text-[#0b0f19]"
              >
                <RefreshIcon size={18} strokeWidth={2.2} /> Дахин оролдох
              </button>
            </div>
          ) : (
            <FaceScanner steps={steps} onComplete={(f) => void onFrames(f)} busy={busy} variant="phone" size={250} />
          )}
          {steps && !scanError && (
            <div className="mt-[8px] flex flex-wrap justify-center gap-[6px]">
              {steps.map((s) => (
                <span
                  key={s.id}
                  className="rounded-full bg-white/10 px-[10px] py-[5px] text-[11px] font-semibold text-white/75"
                >
                  {
                    {
                      center: 'Эгц',
                      turn_left: 'Зүүн',
                      turn_right: 'Баруун',
                      look_up: 'Дээш',
                      look_down: 'Доош',
                      blink: 'Анивчих',
                    }[s.id]
                  }
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {(stage === 'pin' || stage === 'confirm' || stage === 'saving') && (
        <div className="absolute inset-x-0 bottom-0 top-[150px] flex flex-col items-center px-[28px] pt-[26px]">
          {report && stage === 'pin' && (
            <div className="mb-[18px] flex items-center gap-[8px] rounded-full bg-[#e3f6ea] px-[14px] py-[7px] text-[12.5px] font-bold text-[#1b7f43]">
              <CheckIcon size={16} strokeWidth={2.6} />
              Нүүр 5 өнцгөөс бүртгэгдлээ · амьд байдал {Math.round(report.liveness.passive * 100)}%
            </div>
          )}
          <h2 className="text-center text-[21px] font-extrabold">
            {stage === 'pin' ? 'ПИН код үүсгэх' : 'ПИН кодоо давтана уу'}
          </h2>
          <p className="mt-[6px] text-center text-[13.5px] leading-[20px] text-[#6b7684]">
            {stage === 'pin'
              ? `Нүүрээр төлөх бүрт давхар баталгаажуулах ${pinLength} оронтой код`
              : 'Баталгаажуулахын тулд дахин оруулна уу'}
          </p>
          <div className="mt-[34px] w-full">
            <PinPad
              length={pinLength}
              value={pin}
              onChange={(v) => void onPin(v)}
              error={pinError}
              shakeKey={shake}
              disabled={stage === 'saving'}
            />
          </div>
        </div>
      )}

      {stage === 'done' && (
        <div className="absolute inset-x-0 bottom-0 top-[100px] flex flex-col items-center px-[24px] pt-[40px] text-center">
          <span className="pop-in flex size-[92px] items-center justify-center rounded-full bg-[#22c55e] text-white shadow-[0_14px_40px_rgba(34,197,94,.35)]">
            <CheckIcon size={50} strokeWidth={2.6} />
          </span>
          <h2 className="mt-[22px] text-[23px] font-extrabold">Face Pay идэвхжлээ</h2>
          <p className="mt-[8px] text-[14px] leading-[21px] text-[#6b7684]">
            Одоо Face Pay бүхий POS терминал дээр камер руу хараад, ПИН кодоо оруулж төлөөрэй.
          </p>
          <div className="mt-[22px] w-full space-y-[10px] rounded-[18px] bg-white p-[16px] text-left text-[14px] font-semibold">
            {['Нүүрийг 5 өнцгөөс бүртгэсэн', 'Амьд байдал баталгаажсан', 'ПИН код тохируулсан'].map((t) => (
              <p key={t} className="flex items-center gap-[10px]">
                <span className="flex size-[22px] items-center justify-center rounded-full bg-[#e3f6ea] text-[#1b7f43]">
                  <CheckIcon size={14} strokeWidth={3} />
                </span>
                {t}
              </p>
            ))}
          </div>
          <div className="absolute inset-x-[16px] bottom-[30px] space-y-[10px]">
            <button
              onClick={onTryPos}
              className="flex h-[54px] w-full items-center justify-center gap-[8px] rounded-[16px] bg-brand text-[16px] font-bold text-white"
            >
              <PosIcon size={20} /> POS терминал дээр туршиж үзэх
            </button>
            <button onClick={onBack} className="h-[50px] w-full rounded-[16px] bg-white text-[15px] font-bold">
              Дуусгах
            </button>
          </div>
        </div>
      )}

      {stage === 'manage' && user && (
        <div className="absolute inset-x-0 bottom-0 top-[110px] px-[16px] pt-[14px]">
          <div className="rounded-[22px] bg-gradient-to-br from-[#07194f] via-[#123b84] to-[#22529f] p-[20px] text-white shadow-[0_10px_30px_rgba(34,82,159,.3)]">
            <div className="flex items-center gap-[12px]">
              <span className="flex size-[48px] items-center justify-center rounded-[16px] bg-white/15">
                <FaceIdIcon size={28} />
              </span>
              <div>
                <div className="text-[17px] font-extrabold">Face Pay</div>
                <div className="mt-[2px] flex items-center gap-[6px] text-[12.5px] font-semibold text-white/80">
                  <span className={`size-[8px] rounded-full ${user.pin_locked ? 'bg-[#ffb020]' : 'bg-[#4ade80]'}`} />
                  {user.pin_locked ? 'Түр түгжигдсэн' : 'Идэвхтэй'}
                </div>
              </div>
            </div>
            <dl className="mt-[18px] grid grid-cols-2 gap-[12px] text-[12px]">
              <div>
                <dt className="text-white/60">Бүртгэсэн</dt>
                <dd className="mt-[2px] text-[14px] font-bold">
                  {user.faceid.enrolled_at ? new Date(user.faceid.enrolled_at).toLocaleDateString('mn-MN') : '—'}
                </dd>
              </div>
              <div>
                <dt className="text-white/60">Нүүрний өнцөг</dt>
                <dd className="mt-[2px] text-[14px] font-bold">{user.faceid.poses.length}</dd>
              </div>
              <div>
                <dt className="text-white/60">ПИН код</dt>
                <dd className="mt-[2px] text-[14px] font-bold">{user.pin_set ? 'Тохируулсан' : '—'}</dd>
              </div>
              <div>
                <dt className="text-white/60">Загвар</dt>
                <dd className="mt-[2px] text-[14px] font-bold">{user.faceid.model ?? '—'}</dd>
              </div>
            </dl>
          </div>

          <div className="mt-[14px] overflow-hidden rounded-[18px] bg-white">
            <button
              onClick={onTryPos}
              className="flex h-[60px] w-full items-center gap-[12px] px-[16px] text-left text-[15px] font-bold"
            >
              <PosIcon size={22} className="text-brand" /> POS терминал дээр туршиж үзэх
            </button>
            <div className="mx-[16px] h-px bg-[#eef1f5]" />
            <button
              onClick={() => setStage('guide')}
              className="flex h-[60px] w-full items-center gap-[12px] px-[16px] text-left text-[15px] font-bold"
            >
              <RefreshIcon size={22} className="text-brand" /> Нүүр, ПИН кодоо дахин бүртгүүлэх
            </button>
            <div className="mx-[16px] h-px bg-[#eef1f5]" />
            <button
              onClick={() => void disable()}
              className="flex h-[60px] w-full items-center gap-[12px] px-[16px] text-left text-[15px] font-bold text-[#f04452]"
            >
              <TrashIcon size={22} />
              {confirmDisable ? 'Дахин дарж баталгаажуулна уу' : 'Face Pay идэвхгүй болгох'}
            </button>
          </div>
          <p className="mt-[12px] px-[6px] text-[12px] leading-[18px] text-[#8b95a1]">
            Идэвхгүй болгоход таны нүүрний загвар болон ПИН код серверээс бүрмөсөн устгагдана.
          </p>
        </div>
      )}
    </div>
  )
}
