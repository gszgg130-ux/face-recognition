import { useEffect, useState } from 'react'
import { api, type ApiTransaction, type PublicUser } from '../api'
import {
  ArrowUpRightIcon,
  BellIcon,
  BulbIcon,
  CardIcon,
  ChecklistIcon,
  ChevronRightIcon,
  CopyIcon,
  EyeIcon,
  EyeOffIcon,
  FaceIdIcon,
  HandCoinsIcon,
  MailIcon,
  PhoneIcon,
  TdbLogo,
  UserIcon,
} from '../components/Icons'
import IbanText from '../components/IbanText'
import Masked from '../components/Masked'
import { CURRENT_USER, findAccount, PRIMARY_ACCOUNT_ID, transactions } from '../data'

const primaryAccount = findAccount(PRIMARY_ACCOUNT_ID)

const quick = [
  { label: 'Данс', Icon: ChecklistIcon },
  { label: 'Зээл', Icon: HandCoinsIcon },
  { label: 'Карт', Icon: CardIcon },
  { label: 'Хэрэглээ', Icon: BulbIcon },
]

function Banner() {
  return (
    <div className="mx-[19px] mt-[24px] h-[205px] overflow-hidden rounded-[17px] bg-black px-[17px] pt-[18px] text-white">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-[7px]">
          <TdbLogo size={22} strokeWidth={2.4} />
          <span className="text-[19px] font-extrabold tracking-tight">TDB</span>
          <span className="mx-[3px] h-[18px] w-px bg-white/50" />
          <span className="flex size-[22px] items-center justify-center rounded-full bg-[#b7bfe6] text-[8px] font-bold text-[#27327a]">
            ★
          </span>
        </div>
        <div className="mr-[8px] text-right text-[13px] font-extrabold leading-[17px]">
          ЗАЛИЛАГЧИД <span className="text-[#f8d948]">ОНЦГОЙ</span>
          <br />
          <span className="text-[#f8d948]">ҮЕИЙГ</span> АШИГЛАДАГ!!!
          <div className="mt-[3px] text-[6.5px] font-medium leading-[8px] text-white/90">
            Нэвтрэх нэр, нууц үгээ хэнд ч <b>БҮҮ ӨГ!</b>
          </div>
        </div>
      </div>

      <div className="mt-[13px] h-[98px] rounded-[7px] bg-[#f8de4a] px-[11px] pt-[7px] text-[#161616]">
        <div className="text-[8px] font-extrabold">ЗАЛИЛАНГААС СЭРГИЙЛЬЕ :</div>
        <ul className="mt-[3px] list-disc space-y-[1.5px] pl-[9px] text-[5.6px] font-medium leading-[7px] marker:text-[5px]">
          <li>Хуурамч линк дээр бүү дар.</li>
          <li>Нэр, и-мэйл, веб хаягийг ганц үсэг, ганц тоо, ганц цэг сольж дуураймладаг.</li>
          <li>
            Залилагч банк, цагдаа, төрийн байгууллага болон танд-ын хүний нэрийг ашиглан тантай холбогдож, хуурч
            мэхлэхийг оролддог.
          </li>
          <li>Цахим орчинд байгууллагын нэр, логог ашиглахаас гадна хуурамч хаяг, дугаараас залилдаг.</li>
          <li>
            Өндөр ашиг амласан, хувийн мэдээлэл шаардсан, яаруулсан санал, яаралтай шийдвэр гаргуулах гэж шаддаг нь
            цахим залилан байдаг.
          </li>
        </ul>
      </div>

      <div className="mt-[8px] flex items-center text-[7px]">
        <span className="w-[110px] text-[6px] leading-[8px] text-[#f8d948]">Албан ёсны лавлах сувгууд:</span>
        <span className="mr-[11px] h-[14px] w-px bg-white/40" />
        <span className="flex items-center gap-[5px] font-semibold">
          <PhoneIcon size={9} /> 1800 1977, 75770049
        </span>
        <span className="ml-[22px] flex items-center gap-[5px] font-semibold">
          <MailIcon size={10} strokeWidth={2.4} /> info@tdbm.mn
        </span>
      </div>
    </div>
  )
}

function formatDate(iso: string) {
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}

const money = (n: number) => n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

function FacePayCard({ user, onOpen }: { user: PublicUser | null; onOpen: () => void }) {
  const enabled = user?.faceid.enabled
  if (enabled) {
    return (
      <button
        type="button"
        onClick={onOpen}
        className="mx-[19px] mt-[25px] flex h-[72px] w-[calc(100%-38px)] items-center gap-[14px] rounded-[22px] bg-[#f4f7fc] px-[16px] text-left ring-1 ring-[#e3eaf5]"
      >
        <span className="flex size-[42px] items-center justify-center rounded-[14px] bg-brand text-white">
          <FaceIdIcon size={24} />
        </span>
        <div className="flex-1">
          <div className="flex items-center gap-[7px] text-[15px] font-extrabold">
            Face Pay
            <span className="flex items-center gap-[4px] rounded-full bg-[#e3f6ea] px-[7px] py-[2px] text-[10.5px] font-bold text-[#1b7f43]">
              <span className="size-[6px] rounded-full bg-[#22c55e]" /> Идэвхтэй
            </span>
          </div>
          <div className="mt-[3px] text-[11.5px] font-medium text-[#6e7885]">
            POS терминал руу хараад ПИН кодоор төлнө
          </div>
        </div>
        <ChevronRightIcon size={20} strokeWidth={2.2} className="text-[#9aa3ad]" />
      </button>
    )
  }
  return (
    <button
      type="button"
      onClick={onOpen}
      className="mx-[19px] mt-[25px] flex h-[76px] w-[calc(100%-38px)] items-center gap-[14px] rounded-[22px] bg-gradient-to-r from-[#07194f] via-[#123b84] to-[#22529f] px-[16px] text-left text-white shadow-[0_8px_25px_rgba(34,82,159,.25)]"
    >
      <span className="flex size-[44px] items-center justify-center rounded-[14px] bg-white/15 ring-1 ring-white/25">
        <FaceIdIcon size={26} />
      </span>
      <div className="flex-1">
        <div className="text-[15px] font-extrabold">Face Pay тохируулах</div>
        <div className="mt-[3px] text-[11.5px] font-medium text-white/70">
          Карт, утасгүйгээр нүүрээрээ төлөх · 30 сек
        </div>
      </div>
      <span className="flex size-[34px] items-center justify-center rounded-full bg-white/10 ring-1 ring-white/20">
        <ChevronRightIcon size={18} strokeWidth={2.4} />
      </span>
    </button>
  )
}

interface HomeProps {
  onScrollTone: (light: boolean) => void
  onOpenFacePay: () => void
}

export default function Home({ onScrollTone, onOpenFacePay }: HomeProps) {
  const [user, setUser] = useState<PublicUser | null>(null)
  const [live, setLive] = useState<ApiTransaction[]>([])
  const [reveal, setReveal] = useState(false)

  useEffect(() => {
    api
      .user(CURRENT_USER.name)
      .then(setUser)
      .catch(() => setUser(null))
    api
      .transactions(CURRENT_USER.name, 6)
      .then((txs) => setLive(txs.filter((t) => t.status === 'SUCCESS')))
      .catch(() => setLive([]))
  }, [])

  const showMoney = reveal && user !== null

  return (
    <div
      className="no-scrollbar absolute inset-0 overflow-y-auto bg-white"
      onScroll={(e) => onScrollTone(e.currentTarget.scrollTop < 200)}
    >
      <div
        className="relative h-[290px] overflow-hidden text-white"
        style={{
          background: 'linear-gradient(158deg, #07194f 0%, #0a2672 48%, #0c3490 78%, #0a2a7a 100%)',
        }}
      >
        <div
          className="absolute -right-24 top-10 h-[420px] w-[260px] rotate-[32deg] opacity-30"
          style={{ background: 'linear-gradient(90deg, transparent, #3d6fe0 55%, transparent)' }}
        />
        <div
          className="absolute -left-10 top-[140px] h-[300px] w-[200px] rotate-[32deg] opacity-20"
          style={{ background: 'linear-gradient(90deg, transparent, #2a56c4 50%, transparent)' }}
        />

        <div className="absolute left-[19px] top-[54px] flex size-[42px] items-center justify-center rounded-full bg-white/10 ring-1 ring-white/30">
          <UserIcon size={22} strokeWidth={1.8} />
        </div>
        <div className="absolute left-[72px] top-[53px]">
          <div className="text-[12.5px] font-medium leading-[16px] text-white/70">Өдрийн мэнд!</div>
          <div className="text-[16.5px] font-extrabold leading-[22px]">{CURRENT_USER.displayName}</div>
        </div>
        <button
          aria-label={reveal ? 'Hide balance' : 'Show balance'}
          aria-pressed={reveal}
          onClick={() => setReveal((r) => !r)}
          className="absolute right-[75px] top-[54px] flex size-[42px] items-center justify-center rounded-full bg-white/10 ring-1 ring-white/30"
        >
          {reveal ? <EyeIcon size={22} /> : <EyeOffIcon size={22} />}
        </button>
        <button
          aria-label="Notifications"
          className="absolute right-[19px] top-[54px] flex size-[42px] items-center justify-center rounded-full bg-white/10 ring-1 ring-white/30"
        >
          <BellIcon size={22} />
          <span className="absolute -right-[4px] -top-[5px] flex size-[16px] items-center justify-center rounded-full bg-[#ef4d4d] text-[10px] font-semibold">
            1
          </span>
        </button>

        <div className="absolute left-[19px] top-[104px] text-white/90">
          <div className="flex items-center gap-[7px] text-[13.5px] font-medium">
            <span className="size-[7px] rounded-full border border-white/80" />
            {primaryAccount.oldNumber}
            <span className="ml-[3px] text-[10px] font-semibold text-white/70">ХУУЧИН</span>
          </div>
          <div className="ml-[3px] h-[6px] w-0 border-l border-dashed border-white/70" />
          <div className="flex items-center gap-[7px] text-[13.5px] font-medium text-white">
            <span className="size-[7px] rounded-full bg-white" />
            <span>
              <IbanText iban={primaryAccount.iban} />
            </span>
            <CopyIcon size={13} className="ml-[10px]" strokeWidth={2.2} />
          </div>
        </div>
        <div className="absolute left-[19px] top-[147px]">
          {showMoney ? (
            <span className="text-[20px] font-extrabold tracking-[0.01em] text-white">
              {money(user.balance)} <span className="text-[14px] font-bold text-white/70">MNT</span>
            </span>
          ) : (
            <Masked className="text-[20px] text-white" />
          )}
        </div>

        <div className="absolute left-[19px] top-[197px] flex gap-[10px]">
          <button className="h-[44px] w-[132px] rounded-full bg-white text-[14px] font-medium text-brand">
            Дансны хуулга
          </button>
          <button className="h-[44px] w-[101px] rounded-full bg-white/10 text-[14px] font-medium ring-1 ring-white/30">
            Данс хайх
          </button>
        </div>
      </div>

      <div className="relative -mt-[25px] rounded-t-[26px] bg-white pb-[130px] pt-[28px]">
        <div className="grid grid-cols-4 px-[19px]">
          {quick.map(({ label, Icon }) => (
            <button key={label} className="flex flex-col items-center gap-[12px]">
              <span className="flex size-[40px] items-center justify-center rounded-full bg-brand-soft text-brand">
                <Icon size={22} />
              </span>
              <span className="text-[14px] font-medium leading-none">{label}</span>
            </button>
          ))}
        </div>

        <FacePayCard user={user} onOpen={onOpenFacePay} />

        <Banner />

        <div className="mt-[34px] flex items-center justify-between px-[19px]">
          <h2 className="text-[16px] font-medium text-[#6e7885]">Сүүлийн гүйлгээ</h2>
          <button className="flex items-center text-[16px] font-bold text-brand">
            Хуулга
            <ChevronRightIcon size={18} strokeWidth={2.4} />
          </button>
        </div>

        <ul className="mt-[16px]">
          {live.map((t) => (
            <li key={t.id} className="flex h-[62px] items-start px-[19px]">
              <span className="relative flex size-[36px] items-center justify-center rounded-full bg-brand-soft text-brand">
                <FaceIdIcon size={19} strokeWidth={2} />
              </span>
              <div className="ml-[13px] min-w-0 flex-1">
                <div className="text-[14px] font-medium leading-[19px] text-[#7d858f]">{formatDate(t.created_at)}</div>
                <div className="mt-[1px] truncate text-[15px] font-medium leading-[20px]">
                  Face Pay - {t.merchant ?? 'POS'}
                </div>
              </div>
              {showMoney ? (
                <span className="text-[14px] font-extrabold text-ink">-{money(t.amount)}</span>
              ) : (
                <Masked className="text-[14px] text-ink" />
              )}
            </li>
          ))}
          {transactions.map((t) => (
            <li key={t.id} className="flex h-[62px] items-start px-[19px]">
              <span className="flex size-[36px] items-center justify-center rounded-full bg-[#f0f0f0] text-[#6e7885]">
                <ArrowUpRightIcon size={18} strokeWidth={2} />
              </span>
              <div className="ml-[13px] flex-1">
                <div className="text-[14px] font-medium leading-[19px] text-[#7d858f]">{t.date}</div>
                <div className="mt-[1px] text-[15px] font-medium leading-[20px]">{t.title}</div>
              </div>
              <Masked className="text-[14px] text-ink" />
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
