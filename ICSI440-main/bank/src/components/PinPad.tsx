import { useMemo } from 'react'
import { BackspaceIcon } from './Icons'

interface PinPadProps {
  length: number
  value: string
  onChange: (value: string) => void
  /** Randomise digit positions (shoulder-surfing protection on public terminals). */
  scramble?: boolean
  /** Changing this re-shuffles a scrambled pad. */
  shuffleKey?: number
  variant?: 'phone' | 'pos'
  error?: string | null
  /** Changing this plays the shake animation (wrong / mismatched PIN). */
  shakeKey?: number
  disabled?: boolean
}

function shuffled(): string[] {
  const digits = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9']
  for (let i = digits.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[digits[i], digits[j]] = [digits[j]!, digits[i]!]
  }
  return digits
}

export default function PinPad({
  length,
  value,
  onChange,
  scramble = false,
  shuffleKey = 0,
  variant = 'phone',
  error,
  shakeKey = 0,
  disabled = false,
}: PinPadProps) {
  const digits = useMemo(
    () => (scramble ? shuffled() : ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0']),
    [scramble, shuffleKey],
  )
  const keys = [...digits.slice(0, 9), 'blank', digits[9]!, 'del']
  const pos = variant === 'pos'

  const press = (key: string) => {
    if (disabled) return
    if (key === 'del') onChange(value.slice(0, -1))
    else if (key !== 'blank' && value.length < length) onChange(value + key)
  }

  return (
    <div className="flex w-full flex-col items-center">
      <div
        key={shakeKey}
        className={`flex gap-[18px] ${shakeKey ? 'pin-shake' : ''}`}
        aria-label={`${value.length} / ${length}`}
      >
        {Array.from({ length }, (_, i) => (
          <span
            key={i}
            className={`rounded-full transition-all duration-150 ${pos ? 'size-[18px]' : 'size-[16px]'} ${
              i < value.length ? (error ? 'bg-[#f04452]' : 'scale-110 bg-brand') : 'bg-[#d9dee6]'
            }`}
          />
        ))}
      </div>
      <p
        className={`mt-[14px] h-[18px] text-center text-[13px] font-semibold ${error ? 'text-[#f04452]' : 'text-transparent'}`}
      >
        {error || '·'}
      </p>
      <div className={`mt-[6px] grid w-full grid-cols-3 ${pos ? 'gap-[10px]' : 'gap-y-[4px]'}`}>
        {keys.map((key, i) =>
          key === 'blank' ? (
            <span key={`b${i}`} />
          ) : (
            <button
              key={key}
              type="button"
              aria-label={key === 'del' ? 'Устгах' : key}
              disabled={disabled}
              onClick={() => press(key)}
              className={`flex items-center justify-center font-semibold text-[#191f28] transition active:scale-95 disabled:opacity-40 ${
                pos
                  ? 'h-[62px] rounded-[16px] bg-[#f2f4f6] text-[26px] active:bg-[#e5e8eb]'
                  : 'h-[64px] rounded-full text-[27px] active:bg-black/5'
              }`}
            >
              {key === 'del' ? <BackspaceIcon size={26} strokeWidth={1.9} /> : key}
            </button>
          ),
        )}
      </div>
    </div>
  )
}
