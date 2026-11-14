import type { ComponentType, ReactNode, SVGProps } from 'react'

export interface IconProps extends Omit<SVGProps<SVGSVGElement>, 'children'> {
  size?: number
  strokeWidth?: number
}

export type IconComponent = ComponentType<IconProps>

function make(children: ReactNode, fill = false): IconComponent {
  return function Icon({ size = 24, strokeWidth = 1.8, ...rest }: IconProps) {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill={fill ? 'currentColor' : 'none'}
        stroke={fill ? 'none' : 'currentColor'}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        {...rest}
      >
        {children}
      </svg>
    )
  }
}

export const UserIcon = make(
  <>
    <circle cx="12" cy="8" r="4" />
    <path d="M20 21a8 8 0 0 0-16 0" />
  </>,
)
export const EyeOffIcon = make(
  <>
    <path d="M10.7 5.1a10.7 10.7 0 0 1 11.2 6.6 1 1 0 0 1 0 .7 10.7 10.7 0 0 1-1.4 2.5" />
    <path d="M14.1 14.2a3 3 0 0 1-4.2-4.2" />
    <path d="M17.5 17.5a10.7 10.7 0 0 1-15.4-5.1 1 1 0 0 1 0-.7 10.7 10.7 0 0 1 4.4-5.1" />
    <path d="m2 2 20 20" />
  </>,
)
export const BellIcon = make(
  <>
    <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
    <path d="M10.3 21a1.9 1.9 0 0 0 3.4 0" />
  </>,
)
export const CopyIcon = make(
  <>
    <rect x="8" y="8" width="12" height="12" rx="3" />
    <path d="M4 16c-1.1 0-2-.9-2-2V6a4 4 0 0 1 4-4h8c1.1 0 2 .9 2 2" />
  </>,
)
export const ChecklistIcon = make(
  <>
    <rect x="3.5" y="3.5" width="17" height="17" rx="4.5" />
    <path d="m7.5 9 1.2 1.2L10.8 8" />
    <path d="M13 9h3.5" />
    <path d="m7.5 15 1.2 1.2 2.1-2.2" />
    <path d="M13 15h3.5" />
  </>,
)
export const HandCoinsIcon = make(
  <>
    <path d="M11 15h2a2 2 0 1 0 0-4h-3c-.6 0-1.1.2-1.4.6L3 17" />
    <path d="m7 21 1.6-1.4c.3-.4.8-.6 1.4-.6h4c1.1 0 2.1-.4 2.8-1.2l4.6-4.4a2 2 0 0 0-2.75-2.9l-4.2 3.9" />
    <path d="m2 16 6 6" />
    <circle cx="16" cy="9" r="2.9" />
    <circle cx="6" cy="5" r="3" />
  </>,
)
export const WalletCardIcon = make(
  <>
    <path d="M4 7a3 3 0 0 1 3-3h9l1.5 2.5" />
    <rect x="3" y="6.5" width="18" height="13" rx="3.5" />
    <rect x="14.5" y="11.5" width="6.5" height="4" rx="2" />
    <circle cx="17.2" cy="13.5" r=".4" fill="currentColor" />
  </>,
)
export const CardIcon = make(
  <>
    <rect x="2.5" y="5" width="19" height="14" rx="3" />
    <path d="M2.5 10h19" />
    <path d="M6.5 15h4" />
  </>,
)
export const BulbIcon = make(
  <>
    <path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5" />
    <path d="M9 18h6" />
    <path d="M10 22h4" />
  </>,
)
export const SearchIcon = make(
  <>
    <circle cx="11" cy="11" r="8" />
    <path d="m21 21-4.3-4.3" />
  </>,
)
export const PlusIcon = make(<path d="M5 12h14M12 5v14" />)
export const PiggyIcon = make(
  <>
    <path d="M19 5c-1.5 0-2.8 1.4-3 2-3.5-1.5-11-.3-11 5 0 1.8 0 3 2 4.5V20h4v-2h3v2h4v-4c1-.5 1.7-1 2-2h2v-4h-2c0-1-.5-1.5-1-2V5z" />
    <path d="M2 9v1c0 1.1.9 2 2 2h1" />
    <path d="M16 11h.01" />
  </>,
)
export const TransferIcon = make(
  <>
    <path d="M14 10 20 4" />
    <path d="M15 4h5v5" />
    <path d="M10 14 4 20" />
    <path d="M9 20H4v-5" />
  </>,
)
export const DocIcon = make(
  <>
    <rect x="4" y="3" width="16" height="18" rx="4" />
    <path d="M8.5 8.5h7M8.5 12h7M8.5 15.5h4" />
  </>,
)
export const DotsIcon = make(
  <>
    <circle cx="5" cy="12" r="2" />
    <circle cx="12" cy="12" r="2" />
    <circle cx="19" cy="12" r="2" />
  </>,
  true,
)
export const ScanLineIcon = make(
  <>
    <path d="M3 7V5a2 2 0 0 1 2-2h2" />
    <path d="M17 3h2a2 2 0 0 1 2 2v2" />
    <path d="M21 17v2a2 2 0 0 1-2 2h-2" />
    <path d="M7 21H5a2 2 0 0 1-2-2v-2" />
    <path d="M7 12h10" />
  </>,
)
export const ServicesIcon = make(
  <>
    <rect x="3" y="3" width="7" height="7" rx="2" />
    <rect x="14" y="3" width="7" height="7" rx="2" />
    <rect x="3" y="14" width="7" height="7" rx="2" />
    <circle cx="17" cy="17" r="3" />
    <path d="m21 21-1.9-1.9" />
  </>,
)
export const ArrowUpRightIcon = make(
  <>
    <path d="M7 17 17 7" />
    <path d="M8 7h9v9" />
  </>,
)
export const ChevronDownIcon = make(<path d="m6 9 6 6 6-6" />)
export const ChevronRightIcon = make(<path d="m9 18 6-6-6-6" />)
export const ArrowLeftIcon = make(
  <>
    <path d="M19 12H5" />
    <path d="m12 19-7-7 7-7" />
  </>,
)
export const BackspaceIcon = make(
  <>
    <path d="M20 5H9l-7 7 7 7h11a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2z" />
    <path d="m18 9-6 6M12 9l6 6" />
  </>,
)
export const RepeatIcon = make(
  <>
    <path d="m17 2 4 4-4 4" />
    <path d="M3 11v-1a4 4 0 0 1 4-4h14" />
    <path d="m7 22-4-4 4-4" />
    <path d="M21 13v1a4 4 0 0 1-4 4H3" />
  </>,
)
export const GlobeIcon = make(
  <>
    <circle cx="12" cy="12" r="10" />
    <path d="M21.5 15H17a2 2 0 0 0-2 2v4.5" />
    <path d="M7 3.3V5a3 3 0 0 0 3 3 2 2 0 0 1 2 2c0 1.1.9 2 2 2a2 2 0 0 0 2-2c0-1.1.9-2 2-2h3.2" />
    <path d="M11 22v-4a2 2 0 0 0-2-2 2 2 0 0 1-2-2v-1a2 2 0 0 0-2-2H2" />
  </>,
)
export const SaveIcon = make(
  <>
    <path d="M5 8a5 5 0 0 1 5-5h4.5L20 8.5V16a5 5 0 0 1-5 5H8a3 3 0 0 1-3-3z" />
    <path d="M8 21v-3a1.5 1.5 0 0 1 1.5-1.5h5A1.5 1.5 0 0 1 16 18v3" />
    <path d="M14 3v4a1.5 1.5 0 0 0 1.5 1.5H20" />
  </>,
)
export const ZapIcon = make(<path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z" />)
export const CameraFlipIcon = make(
  <>
    <path d="M4 8h3l1.5-2h7L17 8h3a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z" />
    <path d="M9 13.2a3 3 0 0 1 5.2-1" />
    <path d="M15 13.8a3 3 0 0 1-5.2 1" />
  </>,
)
export const ImageIcon = make(
  <>
    <rect x="3" y="3" width="18" height="18" rx="3" />
    <circle cx="9" cy="9" r="2" />
    <path d="m21 15-3.1-3.1a2 2 0 0 0-2.8 0L6 21" />
  </>,
)
export const PhoneIcon = make(
  <path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2z" />,
  true,
)
export const MailIcon = make(
  <>
    <rect x="2" y="4" width="20" height="16" rx="2" />
    <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
  </>,
)
export const HeartIcon = make(
  <path d="M12 21s-8.5-5.2-8.5-11.2C3.5 6.6 5.8 4.5 8.4 4.5c1.5 0 2.8.7 3.6 1.9.8-1.2 2.1-1.9 3.6-1.9 2.6 0 4.9 2.1 4.9 5.3C20.5 15.8 12 21 12 21z" />,
  true,
)

/** TDB knot logo: three interlocking loops. */
export function TdbLogo({ size = 24, strokeWidth = 1.8, ...rest }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      aria-hidden="true"
      {...rest}
    >
      {[0, 60, 120].map((deg) => (
        <ellipse key={deg} cx="12" cy="12" rx="9" ry="4.6" transform={`rotate(${deg} 12 12)`} />
      ))}
    </svg>
  )
}
export const FaceIdIcon = make(
  <>
    <path d="M3 8V6a3 3 0 0 1 3-3h2M16 3h2a3 3 0 0 1 3 3v2M21 16v2a3 3 0 0 1-3 3h-2M8 21H6a3 3 0 0 1-3-3v-2" />
    <path d="M9 9v1.5M15 9v1.5M12 9v4h-1" />
    <path d="M9 16a4 4 0 0 0 6 0" />
  </>,
)
export const ShieldIcon = make(
  <>
    <path d="M12 3 4.5 6v5.5c0 4.6 3.2 8.4 7.5 9.5 4.3-1.1 7.5-4.9 7.5-9.5V6L12 3z" />
    <path d="m9 12 2 2 4-4" />
  </>,
)
export const LockIcon = make(
  <>
    <rect x="4.5" y="10.5" width="15" height="10" rx="3" />
    <path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" />
  </>,
)
export const CheckIcon = make(<path d="m5 12.5 4.5 4.5L19 7.5" />)
export const XIcon = make(<path d="M6 6l12 12M18 6 6 18" />)
export const AlertIcon = make(
  <>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7.5v5.5M12 16.5v.01" />
  </>,
)
export const SunIcon = make(
  <>
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2.5v2M12 19.5v2M4.6 4.6 6 6M18 18l1.4 1.4M2.5 12h2M19.5 12h2M4.6 19.4 6 18M18 6l1.4-1.4" />
  </>,
)
export const GlassesIcon = make(
  <>
    <circle cx="6.5" cy="14" r="3.5" />
    <circle cx="17.5" cy="14" r="3.5" />
    <path d="M10 14h4M3 13.5 5 7M21 13.5 19 7" />
  </>,
)
export const SmartphoneIcon = make(
  <>
    <rect x="6.5" y="2.5" width="11" height="19" rx="2.5" />
    <path d="M11 18.5h2" />
  </>,
)
export const PosIcon = make(
  <>
    <rect x="5" y="2.5" width="14" height="19" rx="2.5" />
    <rect x="7.5" y="5" width="9" height="6" rx="1" />
    <path d="M8.5 14.5h1M11.5 14.5h1M14.5 14.5h1M8.5 17.5h1M11.5 17.5h1M14.5 17.5h1" />
  </>,
)
export const EyeIcon = make(
  <>
    <path d="M2.1 12.3a1 1 0 0 1 0-.6C3.6 7.6 7.5 5 12 5s8.4 2.6 9.9 6.7a1 1 0 0 1 0 .6C20.4 16.4 16.5 19 12 19s-8.4-2.6-9.9-6.7" />
    <circle cx="12" cy="12" r="3" />
  </>,
)
export const TrashIcon = make(
  <>
    <path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3" />
  </>,
)
export const RefreshIcon = make(
  <>
    <path d="M20 11a8 8 0 0 0-14.3-4.9L4 8" />
    <path d="M4 4v4h4M4 13a8 8 0 0 0 14.3 4.9L20 16" />
    <path d="M20 20v-4h-4" />
  </>,
)
