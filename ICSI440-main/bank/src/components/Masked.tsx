import { MASKED_BALANCE } from '../data'

/** Masked balance, e.g. "******.**" */
export default function Masked({ className = '' }: { className?: string }) {
  return <span className={`font-extrabold tracking-[0.04em] ${className}`}>{MASKED_BALANCE}</span>
}
