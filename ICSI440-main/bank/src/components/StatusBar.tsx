import { HeartIcon } from './Icons'

interface StatusBarProps {
  time?: string
  battery?: number
  tone?: 'dark' | 'light'
  className?: string
}

export default function StatusBar({ time = '12:45', battery = 77, tone = 'dark', className = '' }: StatusBarProps) {
  const light = tone === 'light'
  const fg = light ? '#ffffff' : '#000000'
  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none absolute inset-x-0 top-0 z-30 flex h-[46px] items-center justify-between px-[36px] pt-[2px] ${className}`}
      style={{ color: fg }}
    >
      <div className="flex items-center gap-[3px] text-[16px] font-bold tracking-tight">
        {time}
        <HeartIcon size={14} />
      </div>
      <div className="flex items-center gap-[7px]">
        {/* cellular */}
        <svg width="20" height="12" viewBox="0 0 20 12" fill="currentColor" aria-hidden="true">
          {[0, 5, 10, 15].map((x, i) => (
            <g key={x}>
              <rect x={x} y={9} width="3" height="3" rx="1" />
              <rect
                x={x}
                y={5.5 - (i === 3 ? 3 : 0)}
                width="3"
                height={i === 3 ? 6 : 2.5}
                rx="1"
                opacity={i === 3 ? 1 : 0.9}
              />
              {i === 3 && <rect x={x} y={0} width="3" height="3" rx="1" />}
            </g>
          ))}
        </svg>
        {/* wifi */}
        <svg
          width="17"
          height="12"
          viewBox="0 0 17 12"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          aria-hidden="true"
        >
          <path d="M1.5 4.2a10 10 0 0 1 14 0" />
          <path d="M4 7a6.4 6.4 0 0 1 9 0" />
          <circle cx="8.5" cy="10" r="1" fill="currentColor" />
        </svg>
        {/* battery */}
        <div className="flex items-center">
          <div
            className="relative flex h-[16px] w-[27px] items-center justify-center overflow-hidden rounded-[5px]"
            style={{ background: light ? 'rgba(255,255,255,.35)' : 'rgba(0,0,0,.3)' }}
          >
            <div className="absolute inset-y-0 left-0" style={{ width: `${battery}%`, background: fg }} />
            <span
              className="relative text-[11px] font-extrabold leading-none"
              style={{ color: light ? '#0a1f5c' : '#fff' }}
            >
              {battery}
            </span>
          </div>
          <div
            className="ml-[1px] h-[5px] w-[1.5px] rounded-r"
            style={{ background: light ? 'rgba(255,255,255,.5)' : 'rgba(0,0,0,.4)' }}
          />
        </div>
      </div>
    </div>
  )
}
