import { ArrowLeftIcon, CameraFlipIcon, type IconComponent, ImageIcon, ZapIcon } from '../components/Icons'
import StatusBar from '../components/StatusBar'

interface QRScanProps {
  onBack: () => void
}

type CornerPosition = 'tl' | 'tr' | 'bl' | 'br'

const cornerClasses: Record<CornerPosition, string> = {
  tl: 'left-0 top-0 rounded-tl-[28px] border-b-0 border-r-0',
  tr: 'right-0 top-0 rounded-tr-[28px] border-b-0 border-l-0',
  bl: 'bottom-0 left-0 rounded-bl-[28px] border-r-0 border-t-0',
  br: 'bottom-0 right-0 rounded-br-[28px] border-l-0 border-t-0',
}

const cameraActions: { label: string; Icon: IconComponent }[] = [
  { label: 'Toggle flash', Icon: ZapIcon },
  { label: 'Switch camera', Icon: CameraFlipIcon },
  { label: 'Choose from gallery', Icon: ImageIcon },
]

function Corner({ pos }: { pos: CornerPosition }) {
  return <span className={`absolute size-[36px] border-[3px] border-white ${cornerClasses[pos]}`} />
}

export default function QRScan({ onBack }: QRScanProps) {
  return (
    <div className="absolute inset-0 overflow-hidden bg-[#1a1a1d]">
      {/* simulated camera feed */}
      <div
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(120% 40% at 50% 8%, #2b2b2e 0%, #121214 70%), linear-gradient(180deg,#1d1d20 0%,#17171a 28%,#26232b 45%,#17171b 62%,#8a6f5c 88%,#c89478 100%)',
        }}
      />
      <div
        className="absolute inset-x-0 top-[95px] h-[300px] origin-top -skew-y-3 opacity-90"
        style={{ background: 'linear-gradient(180deg,#232226,#17171b 60%,#1d1b24)' }}
      />
      <div
        className="absolute inset-x-0 top-[395px] h-[170px] opacity-95"
        style={{ background: 'linear-gradient(180deg,#242327,#18181b)' }}
      />
      <div className="absolute -bottom-6 left-[-30px] h-[220px] w-[250px] rounded-full bg-[#d9a287] blur-[8px]" />
      <div className="absolute -bottom-10 right-[-60px] h-[180px] w-[280px] rounded-full bg-[#cf9879] blur-[8px]" />
      <div className="absolute inset-0 backdrop-blur-[2px]" />

      <StatusBar tone="light" battery={77} />
      <span className="absolute left-[276px] top-[7px] z-30 size-[5px] rounded-full bg-[#2ecc40]" />

      <button onClick={onBack} aria-label="Back" className="absolute left-[18px] top-[62px] z-20 text-white">
        <ArrowLeftIcon size={26} strokeWidth={2} />
      </button>
      <h1 className="absolute inset-x-0 top-[62px] z-10 text-center text-[16px] font-medium text-white">QPay</h1>

      {/* scan frame */}
      <div className="absolute left-[75px] top-[303px] h-[235px] w-[240px]">
        <Corner pos="tl" />
        <Corner pos="tr" />
        <Corner pos="bl" />
        <Corner pos="br" />
      </div>

      <div className="absolute inset-x-0 top-[699px] flex justify-between px-[74px]">
        {cameraActions.map(({ label, Icon }) => (
          <button
            key={label}
            aria-label={label}
            className="flex size-[44px] items-center justify-center rounded-full bg-[#e6e6e6] text-ink active:opacity-80"
          >
            <Icon size={22} strokeWidth={1.8} />
          </button>
        ))}
      </div>
    </div>
  )
}
