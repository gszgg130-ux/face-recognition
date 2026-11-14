import { PosIcon, SmartphoneIcon } from './Icons'

export type View = 'bank' | 'pos'

interface ViewSwitchProps {
  view: View
  onChange: (view: View) => void
}

const options = [
  { id: 'bank' as const, label: 'Банк апп', Icon: SmartphoneIcon },
  { id: 'pos' as const, label: 'POS терминал', Icon: PosIcon },
]

/** Toggle between the customer's bank app and the store's Face Pay terminal. */
export default function ViewSwitch({ view, onChange }: ViewSwitchProps) {
  return (
    <div className="flex h-[56px] shrink-0 items-center justify-center px-[16px]">
      <div
        role="tablist"
        aria-label="Харагдац"
        className="flex rounded-full bg-white/80 p-[4px] shadow-[0_4px_18px_rgba(15,30,70,.12)] ring-1 ring-black/[.04] backdrop-blur"
      >
        {options.map(({ id, label, Icon }) => {
          const active = view === id
          return (
            <button
              key={id}
              role="tab"
              aria-selected={active}
              onClick={() => onChange(id)}
              className={`flex h-[38px] items-center gap-[7px] rounded-full px-[16px] text-[13.5px] font-bold transition ${
                active ? 'bg-[#191f28] text-white' : 'text-[#6b7684] hover:text-[#191f28]'
              }`}
            >
              <Icon size={17} strokeWidth={2} />
              {label}
            </button>
          )
        })}
      </div>
    </div>
  )
}
