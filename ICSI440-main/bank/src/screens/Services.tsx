import type { ReactNode } from 'react'
import {
  CardIcon,
  ChecklistIcon,
  DocIcon,
  DotsIcon,
  FaceIdIcon,
  HandCoinsIcon,
  type IconComponent,
  PiggyIcon,
  PlusIcon,
  SearchIcon,
  TransferIcon,
  WalletCardIcon,
} from '../components/Icons'
import StatusBar from '../components/StatusBar'

function Bubble({ children }: { children: ReactNode }) {
  return (
    <span className="flex size-[44px] items-center justify-center rounded-full bg-brand-soft text-brand">
      {children}
    </span>
  )
}

const services: { label: string; icon: ReactNode; facePay?: boolean }[] = [
  { label: 'Данс', icon: <WalletCardIcon size={25} /> },
  { label: 'Хадгаламж', icon: <PiggyIcon size={25} /> },
  { label: 'Шилжүүлэг', icon: <TransferIcon size={24} /> },
  { label: 'Карт', icon: <CardIcon size={25} /> },
  { label: 'Төлбөр', icon: <ChecklistIcon size={25} /> },
  { label: 'Apple Pay', icon: <span className="text-[11px] font-extrabold tracking-tight text-ink">Pay</span> },
  { label: 'Face Pay', icon: <FaceIdIcon size={25} />, facePay: true },
  { label: 'Бусад', icon: <DotsIcon size={26} /> },
]

const quick: { label: string; Icon: IconComponent }[] = [
  { label: 'Зээл', Icon: HandCoinsIcon },
  { label: 'Тодорхойлолт', Icon: DocIcon },
]

export default function Services({ onOpenFacePay }: { onOpenFacePay: () => void }) {
  return (
    <div className="absolute inset-0 bg-surface">
      <StatusBar battery={76} />
      <div className="absolute inset-x-0 top-0 z-10 flex h-[94px] items-end justify-center bg-white pb-[16px]">
        <h1 className="text-[16px] font-bold">Үйлчилгээ</h1>
      </div>

      <div className="no-scrollbar absolute inset-x-0 bottom-0 top-[94px] overflow-y-auto px-[19px] pb-[110px] pt-[30px]">
        <label className="flex h-[43px] items-center gap-[15px] rounded-[17px] bg-white px-[15px]">
          <SearchIcon size={20} strokeWidth={2} />
          <input
            aria-label="Search"
            placeholder="Хайх"
            className="h-full flex-1 bg-transparent text-[16px] font-medium outline-none placeholder:text-[#7a8591]"
          />
        </label>

        <div className="mt-[19px] grid grid-cols-2 gap-[12px]">
          {quick.map(({ label, Icon }) => (
            <button
              key={label}
              className="flex h-[104px] flex-col items-center justify-center gap-[17px] rounded-[17px] bg-white"
            >
              <Bubble>
                <Icon size={23} />
              </Bubble>
              <span className="text-[13.5px] font-bold leading-none">{label}</span>
            </button>
          ))}
        </div>

        <section className="mt-[19px] h-[160px] rounded-[17px] bg-white px-[18px] pt-[17px]">
          <div className="flex items-center justify-between">
            <h2 className="text-[16px] font-bold">Байнга ашиглах</h2>
            <button className="mr-[6px] text-[14px] font-bold text-brand">Засах</button>
          </div>
          <div className="mt-[20px] flex w-[77px] flex-col items-center gap-[10px]">
            <Bubble>
              <PlusIcon size={24} strokeWidth={2} />
            </Bubble>
            <span className="text-[13px] font-medium leading-none">Нэмэх</span>
          </div>
        </section>

        <section className="mt-[19px] rounded-[17px] bg-white px-[18px] pb-[22px] pt-[17px]">
          <div className="flex items-center justify-between">
            <h2 className="text-[16px] font-bold">Үйлчилгээнүүд</h2>
            <button className="mr-[6px] text-[14px] font-bold text-brand">Бүгд</button>
          </div>
          <div className="mt-[22px] grid grid-cols-4 gap-y-[18px]">
            {services.map(({ label, icon, facePay }) => (
              <button
                key={label}
                onClick={facePay ? onOpenFacePay : undefined}
                className="flex flex-col items-center gap-[10px]"
              >
                <Bubble>{icon}</Bubble>
                <span className="text-[13px] font-medium leading-none">{label}</span>
              </button>
            ))}
          </div>
        </section>
      </div>
    </div>
  )
}
