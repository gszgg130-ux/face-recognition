import { useState } from 'react'
import { formatMnt } from '../api'
import { MERCHANT, products, type Product } from '../data'
import type { Order, OrderLine } from './types'

interface CashierProps {
  activeOrder: Order | null
  lastPaid: { amount: number; code: string | null } | null
  onRequest: (order: Order) => void
  onCancel: () => void
}

/** Merchant side of the counter: ring up items and push the total to the customer terminal. */
export default function Cashier({ activeOrder, lastPaid, onRequest, onCancel }: CashierProps) {
  const [cart, setCart] = useState<OrderLine[]>([])
  const total = cart.reduce((sum, l) => sum + l.product.price * l.qty, 0)
  const locked = activeOrder !== null

  const add = (product: Product, delta: number) =>
    setCart((lines) => {
      const existing = lines.find((l) => l.product.id === product.id)
      if (!existing) return delta > 0 ? [...lines, { product, qty: 1 }] : lines
      return lines.map((l) => (l.product.id === product.id ? { ...l, qty: l.qty + delta } : l)).filter((l) => l.qty > 0)
    })

  const request = () => {
    if (!cart.length) return
    onRequest({ id: Date.now(), items: cart, total })
  }

  // The cart is cleared as soon as the terminal reports a successful payment.
  const [paidId, setPaidId] = useState<string | null>(null)
  if (lastPaid && lastPaid.code !== paidId) {
    setPaidId(lastPaid.code)
    setCart([])
  }

  return (
    <section className="rounded-[24px] bg-white p-[18px] shadow-[0_8px_30px_rgba(15,30,70,.08)]">
      <header className="flex items-center justify-between">
        <div>
          <div className="text-[11px] font-extrabold uppercase tracking-[0.12em] text-[#8b95a1]">
            Касс · кассчны тал
          </div>
          <h2 className="mt-[2px] text-[18px] font-extrabold">{MERCHANT.name}</h2>
        </div>
        <span className="rounded-full bg-[#f2f4f6] px-[10px] py-[5px] text-[11px] font-bold text-[#6b7684]">
          {MERCHANT.terminalId}
        </span>
      </header>

      <div className="mt-[16px] grid grid-cols-2 gap-[8px]">
        {products.map((p) => (
          <button
            key={p.id}
            disabled={locked}
            onClick={() => add(p, 1)}
            className="flex items-center gap-[10px] rounded-[14px] bg-[#f7f8fa] p-[10px] text-left transition hover:bg-[#eef1f5] active:scale-[.98] disabled:opacity-50"
          >
            <span className="size-[30px] shrink-0 rounded-[10px]" style={{ background: p.color }} />
            <span className="min-w-0">
              <span className="block truncate text-[13px] font-bold">{p.name}</span>
              <span className="block text-[12px] font-semibold text-[#8b95a1] tabular-nums">{formatMnt(p.price)}</span>
            </span>
          </button>
        ))}
      </div>

      <div className="mt-[16px] rounded-[16px] border border-[#eef1f5]">
        {cart.length === 0 ? (
          <p className="px-[14px] py-[18px] text-center text-[13px] font-medium text-[#8b95a1]">Бараа сонгоно уу</p>
        ) : (
          <ul className="divide-y divide-[#f2f4f6]">
            {cart.map(({ product, qty }) => (
              <li key={product.id} className="flex items-center gap-[10px] px-[12px] py-[9px] text-[13.5px]">
                <span className="flex-1 font-semibold">{product.name}</span>
                <span className="flex items-center gap-[6px]">
                  <button
                    disabled={locked}
                    onClick={() => add(product, -1)}
                    aria-label="Хасах"
                    className="size-[26px] rounded-full bg-[#f2f4f6] font-bold disabled:opacity-40"
                  >
                    −
                  </button>
                  <span className="w-[18px] text-center font-bold tabular-nums">{qty}</span>
                  <button
                    disabled={locked}
                    onClick={() => add(product, 1)}
                    aria-label="Нэмэх"
                    className="size-[26px] rounded-full bg-[#f2f4f6] font-bold disabled:opacity-40"
                  >
                    +
                  </button>
                </span>
                <span className="w-[72px] text-right font-bold tabular-nums">{formatMnt(product.price * qty)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="mt-[14px] flex items-baseline justify-between">
        <span className="text-[14px] font-bold text-[#6b7684]">Нийт</span>
        <span className="text-[26px] font-extrabold tracking-tight tabular-nums">{formatMnt(total)}</span>
      </div>

      {locked ? (
        <div className="mt-[12px] space-y-[8px]">
          <div className="flex items-center gap-[10px] rounded-[14px] bg-[#eef4ff] px-[14px] py-[12px] text-[13px] font-bold text-brand">
            <span className="size-[8px] animate-pulse rounded-full bg-brand" />
            Терминал дээр төлбөр хүлээж байна…
          </div>
          <button
            onClick={onCancel}
            className="h-[46px] w-full rounded-[14px] bg-[#f2f4f6] text-[14px] font-bold text-[#4e5968]"
          >
            Захиалга цуцлах
          </button>
        </div>
      ) : (
        <button
          disabled={!cart.length}
          onClick={request}
          className="mt-[12px] h-[52px] w-full rounded-[14px] bg-[#191f28] text-[15px] font-bold text-white transition disabled:bg-[#d1d6db]"
        >
          Терминал руу төлбөр илгээх
        </button>
      )}

      {lastPaid && !locked && (
        <p className="mt-[10px] rounded-[12px] bg-[#e3f6ea] px-[12px] py-[9px] text-[12.5px] font-bold text-[#1b7f43]">
          Сүүлийн төлбөр орлоо · {formatMnt(lastPaid.amount)} · код {lastPaid.code}
        </p>
      )}
    </section>
  )
}
