import { useCallback, useEffect, useState } from 'react'
import { api, type ApiTransaction, type Health, type MlReport } from '../api'
import Cashier from './Cashier'
import MlPanel from './MlPanel'
import Terminal from './Terminal'
import type { Order } from './types'

/** POS mode: cashier counter (left), customer-facing Face Pay terminal (centre), ML details (right). */
export default function PosView() {
  const [order, setOrder] = useState<Order | null>(null)
  const [report, setReport] = useState<MlReport | null>(null)
  const [lastPaid, setLastPaid] = useState<{ amount: number; code: string | null } | null>(null)
  const [showMesh, setShowMesh] = useState(false)
  const [health, setHealth] = useState<Health | null>(null)
  const [offline, setOffline] = useState(false)

  useEffect(() => {
    let alive = true
    const poll = () =>
      api
        .health()
        .then((h) => {
          if (!alive) return
          setHealth(h)
          setOffline(false)
        })
        .catch(() => {
          if (!alive) return
          setHealth(null)
          setOffline(true)
        })
    void poll()
    const id = window.setInterval(poll, 5000)
    return () => {
      alive = false
      window.clearInterval(id)
    }
  }, [])

  const finished = useCallback((tx: ApiTransaction | null) => {
    if (tx) setLastPaid({ amount: tx.amount, code: tx.approval_code })
    setOrder(null)
  }, [])

  return (
    <div className="no-scrollbar h-full overflow-y-auto bg-[radial-gradient(120%_80%_at_50%_0%,#f4f6fb_0%,#e3e8f0_100%)]">
      <div className="mx-auto grid max-w-[1320px] items-start gap-[20px] px-[16px] pb-[40px] pt-[8px] lg:grid-cols-[320px_minmax(0,1fr)_340px] lg:px-[24px]">
        <div className="order-2 lg:order-1">
          <Cashier
            activeOrder={order}
            lastPaid={lastPaid}
            onRequest={(o) => {
              setReport(null)
              setOrder(o)
            }}
            onCancel={() => setOrder(null)}
          />
        </div>
        <div className="order-1 flex justify-center pt-[8px] lg:order-2">
          <Terminal order={order} showMesh={showMesh} onReport={setReport} onFinished={finished} />
        </div>
        <div className="order-3">
          <MlPanel report={report} health={health} offline={offline} showMesh={showMesh} onToggleMesh={setShowMesh} />
        </div>
      </div>
    </div>
  )
}
