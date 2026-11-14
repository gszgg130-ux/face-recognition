import type { Tab } from '../data'
import { ScanLineIcon, ServicesIcon, TdbLogo, TransferIcon, type IconComponent } from './Icons'

interface TabItem {
  id: Tab
  label: string
  Icon: IconComponent
}

const items: TabItem[] = [
  { id: 'home', label: 'Нүүр', Icon: TdbLogo },
  { id: 'qr', label: 'QR төлбөр', Icon: ScanLineIcon },
  { id: 'transfer', label: 'Шилжүүлэг', Icon: TransferIcon },
  { id: 'services', label: 'Үйлчилгээ', Icon: ServicesIcon },
]

interface TabBarProps {
  active: Tab
  onChange: (tab: Tab) => void
  glass?: boolean
}

export default function TabBar({ active, onChange, glass = false }: TabBarProps) {
  return (
    <nav
      aria-label="Main navigation"
      className={`absolute inset-x-[19px] bottom-[19px] z-20 flex h-[65px] items-center rounded-[33px] p-[3px] ${
        glass
          ? 'bg-white/70 shadow-[0_2px_24px_rgba(0,0,0,.18)] backdrop-blur-xl ring-1 ring-white/70'
          : 'bg-white shadow-[0_2px_20px_rgba(0,0,0,.10)] ring-1 ring-black/[.03]'
      }`}
    >
      {items.map(({ id, label, Icon }) => {
        const isActive = id === active
        return (
          <button
            key={id}
            aria-current={isActive ? 'page' : undefined}
            onClick={() => onChange(id)}
            className={`flex h-full flex-1 flex-col items-center justify-center gap-[5px] rounded-[30px] transition-colors ${
              isActive ? (glass ? 'bg-white/80' : 'bg-[#efefef]') : ''
            }`}
          >
            {isActive ? (
              <span className="flex size-[24px] items-center justify-center rounded-full bg-gradient-to-br from-[#4a7de0] to-[#1f4ca3] text-white">
                <Icon size={14} strokeWidth={2} />
              </span>
            ) : (
              <span className="flex size-[24px] items-center justify-center text-ink">
                <Icon size={22} strokeWidth={1.7} />
              </span>
            )}
            <span className={`text-[11.5px] leading-none text-ink ${isActive ? 'font-semibold' : 'font-medium'}`}>
              {label}
            </span>
          </button>
        )
      })}
    </nav>
  )
}
