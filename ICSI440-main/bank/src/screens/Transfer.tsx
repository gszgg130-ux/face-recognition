import { useState } from 'react'
import AccountSheet from '../components/AccountSheet'
import IbanText from '../components/IbanText'
import {
  BackspaceIcon,
  ChevronDownIcon,
  GlobeIcon,
  type IconComponent,
  RepeatIcon,
  SaveIcon,
} from '../components/Icons'
import Masked from '../components/Masked'
import StatusBar from '../components/StatusBar'
import { findAccount, PRIMARY_ACCOUNT_ID } from '../data'

const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', 'del'] as const
type Key = (typeof keys)[number]

type TransferMode = 'internal' | 'international' | 'saved'

const modes: { id: TransferMode; label: string; Icon: IconComponent }[] = [
  { id: 'internal', label: 'Дотоод', Icon: RepeatIcon },
  { id: 'international', label: 'Гадаад', Icon: GlobeIcon },
  { id: 'saved', label: 'Хадгалсан', Icon: SaveIcon },
]

const MAX_DIGITS = 12
const MAX_DECIMALS = 2

/** Adds thousands separators to the integer part, e.g. "1234567.5" -> "1,234,567.5". */
function formatAmount(raw: string) {
  const [int = '0', dec] = raw.split('.')
  const grouped = int.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  return dec === undefined ? grouped : `${grouped}.${dec}`
}

/** Applies a keypad press to the current raw amount string. */
function applyKey(current: string, key: Key) {
  if (key === 'del') return current.length > 1 ? current.slice(0, -1) : '0'
  if (key === '.') return current.includes('.') ? current : `${current}.`
  if (current.replace('.', '').length >= MAX_DIGITS) return current
  if (current === '0') return key

  const [, decimals] = current.split('.')
  if (decimals !== undefined && decimals.length >= MAX_DECIMALS) return current
  return current + key
}

export default function Transfer() {
  const [amount, setAmount] = useState('0')
  const [accountId, setAccountId] = useState(PRIMARY_ACCOUNT_ID)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [mode, setMode] = useState<TransferMode>('internal')

  const account = findAccount(accountId)

  return (
    <div className="absolute inset-0 bg-surface">
      <StatusBar battery={77} />

      <h1 className="absolute inset-x-0 top-[56px] text-center text-[16px] font-bold">Шилжүүлэг</h1>

      {/* segmented control */}
      <div className="absolute left-1/2 top-[94px] flex h-[46px] w-[212px] -translate-x-1/2 items-center rounded-[23px] bg-[#e0e0e0] p-[4px]">
        {modes.map(({ id, label, Icon }) => {
          const active = id === mode
          return (
            <button
              key={id}
              aria-label={label}
              aria-pressed={active}
              onClick={() => setMode(id)}
              className={`flex h-[38px] items-center justify-center gap-[8px] rounded-[19px] ${
                active ? 'min-w-[104px] bg-white px-[12px] text-[14px] font-bold' : 'flex-1 text-[#747c85]'
              }`}
            >
              <Icon size={active ? 20 : 22} strokeWidth={active ? 2 : 1.8} />
              {active && label}
            </button>
          )
        })}
      </div>

      {/* card */}
      <div className="absolute left-[15px] right-[15px] top-[158px] h-[583px] rounded-[17px] bg-white">
        <button
          onClick={() => setSheetOpen(true)}
          className="absolute left-[11px] right-[11px] top-[20px] flex h-[65px] items-center rounded-[17px] bg-surface px-[15px] text-left"
        >
          <div className="flex-1">
            <div className="text-[13px] leading-[17px] text-[#7a8591]">{account.name}</div>
            <div className="mt-[2px] text-[16px] font-medium leading-[21px] tracking-tight">
              <IbanText iban={account.iban} bold={false} />
            </div>
          </div>
          <div className="mr-[10px] flex flex-col items-end gap-[3px] pt-[1px]">
            <Masked className="text-[13px] text-[#1f4f9e]" />
            <span className="text-[15px] font-medium text-[#7a8591]">{account.currency}</span>
          </div>
          <ChevronDownIcon size={22} strokeWidth={2.2} />
        </button>

        <output className="absolute inset-x-0 top-[132px] text-center text-[36px] font-bold leading-[1]">
          {formatAmount(amount)}
        </output>

        {/* keypad */}
        <div className="absolute inset-x-0 top-[200px] grid grid-cols-3 px-[11px]">
          {keys.map((key) => (
            <button
              key={key}
              aria-label={key === 'del' ? 'Delete' : undefined}
              onClick={() => setAmount((current) => applyKey(current, key))}
              className="flex h-[79px] items-center justify-center text-[26px] font-medium active:opacity-50"
            >
              {key === 'del' ? <BackspaceIcon size={26} strokeWidth={1.9} /> : key}
            </button>
          ))}
        </div>

        <button className="absolute inset-x-[11px] bottom-[14px] h-[44px] rounded-[16px] bg-brand text-[16px] font-medium tracking-wide text-white active:opacity-90">
          Шилжүүлэх
        </button>
      </div>

      <AccountSheet
        open={sheetOpen}
        selectedId={accountId}
        onSelect={(selected) => {
          setAccountId(selected.id)
          setSheetOpen(false)
        }}
        onClose={() => setSheetOpen(false)}
      />
    </div>
  )
}
