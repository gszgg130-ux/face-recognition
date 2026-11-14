import { accounts, type Account } from '../data'
import IbanText from './IbanText'
import Masked from './Masked'

interface AccountSheetProps {
  open: boolean
  selectedId: string
  onSelect: (account: Account) => void
  onClose: () => void
}

export default function AccountSheet({ open, selectedId, onSelect, onClose }: AccountSheetProps) {
  return (
    <div className={`absolute inset-0 z-40 ${open ? '' : 'pointer-events-none'}`} inert={!open}>
      <div
        aria-hidden="true"
        onClick={onClose}
        className={`absolute inset-0 bg-black/55 transition-opacity duration-300 ${open ? 'opacity-100' : 'opacity-0'}`}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="account-sheet-title"
        className={`absolute inset-x-0 bottom-0 h-[409px] rounded-t-[24px] bg-white transition-transform duration-300 ease-out ${
          open ? 'translate-y-0' : 'translate-y-full'
        }`}
      >
        <h2
          id="account-sheet-title"
          className="flex h-[51px] items-center justify-center border-b border-[#e3e3e3] text-[15px] font-medium text-[#6e7885]"
        >
          Дансны жагсаалт
        </h2>
        <div className="flex flex-col gap-[12px] px-[15px] pt-[19px]">
          {accounts.map((acc) => {
            const selected = acc.id === selectedId
            return (
              <button
                key={acc.id}
                aria-pressed={selected}
                onClick={() => onSelect(acc)}
                className={`relative h-[91px] rounded-[18px] px-[14px] pt-[10px] text-left ${
                  selected ? 'bg-[#e8f1fc]' : 'bg-[#f6f6f6]'
                }`}
              >
                <div className="text-[14px] font-medium leading-[19px] text-[#7b848f]">{acc.name}</div>
                <div className="mt-[3px] flex items-center gap-[8px] text-[12.5px] leading-[16px] text-[#7b848f]">
                  <span className="size-[7px] rounded-full border border-[#8a939d]" />
                  <span>{acc.oldNumber}</span>
                  <span className="text-[11.5px]">хуучин</span>
                </div>
                <div className="ml-[3px] h-[8px] w-0 border-l border-dashed border-[#8a939d]" />
                <div className="flex items-center gap-[8px] text-[16px] font-medium leading-[20px] text-ink">
                  <span className="size-[7px] rounded-full bg-[#0b57b5]" />
                  <span>
                    <IbanText iban={acc.iban} />
                  </span>
                </div>
                <div className="absolute right-[15px] top-[12px] flex h-[64px] flex-col items-end justify-between">
                  <Masked className={`text-[14px] ${selected ? 'text-[#0b4a9f]' : 'text-ink'}`} />
                  <span className="mb-[8px] text-[15px] font-semibold text-[#7b848f]">{acc.currency}</span>
                </div>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
