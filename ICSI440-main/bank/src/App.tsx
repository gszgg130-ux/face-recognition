import { useEffect, useState } from 'react'
import TabBar from './components/TabBar'
import StatusBar from './components/StatusBar'
import ViewSwitch, { type View } from './components/ViewSwitch'
import { CURRENT_USER, type Tab } from './data'
import PosView from './pos/PosView'
import FacePaySetup from './screens/FacePaySetup'
import Home from './screens/Home'
import QRScan from './screens/QRScan'
import Services from './screens/Services'
import Transfer from './screens/Transfer'

function BankApp({ onOpenPos }: { onOpenPos: () => void }) {
  const [tab, setTab] = useState<Tab>('home')
  const [homeLightStatus, setHomeLightStatus] = useState(true)
  const [facePayOpen, setFacePayOpen] = useState(false)
  const [homeKey, setHomeKey] = useState(0)

  const changeTab = (next: Tab) => {
    if (next === 'home') setHomeLightStatus(true)
    setTab(next)
  }

  const closeFacePay = () => {
    setFacePayOpen(false)
    setHomeKey((k) => k + 1) // refresh Face Pay status on the home screen
  }

  return (
    <div className="flex h-full items-center justify-center sm:px-6 sm:pb-6">
      <div className="relative isolate h-full w-full max-w-[390px] overflow-hidden bg-white sm:h-[844px] sm:max-h-full sm:rounded-[48px] sm:shadow-[0_30px_80px_rgba(15,30,70,.25)] sm:ring-8 sm:ring-black">
        {tab === 'home' && !facePayOpen && (
          <>
            <Home key={homeKey} onScrollTone={setHomeLightStatus} onOpenFacePay={() => setFacePayOpen(true)} />
            <StatusBar
              battery={77}
              time="12:44"
              tone={homeLightStatus ? 'light' : 'dark'}
              className={homeLightStatus ? '' : 'bg-white'}
            />
          </>
        )}
        {tab === 'qr' && <QRScan onBack={() => changeTab('home')} />}
        {tab === 'transfer' && <Transfer />}
        {tab === 'services' && <Services onOpenFacePay={() => setFacePayOpen(true)} />}

        {tab !== 'qr' && <TabBar active={tab} onChange={changeTab} glass={tab === 'home'} />}

        {facePayOpen && <FacePaySetup userName={CURRENT_USER.name} onBack={closeFacePay} onTryPos={onOpenPos} />}
      </div>
    </div>
  )
}

const viewFromHash = (): View => (window.location.hash === '#pos' ? 'pos' : 'bank')

export default function App() {
  const [view, setView] = useState<View>(viewFromHash)

  useEffect(() => {
    const onHash = () => setView(viewFromHash())
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  const switchView = (next: View) => {
    const url = next === 'pos' ? '#pos' : window.location.pathname + window.location.search
    window.history.replaceState(null, '', url)
    setView(next)
  }

  return (
    <div className="flex h-full flex-col">
      <ViewSwitch view={view} onChange={switchView} />
      <main className="min-h-0 flex-1">
        {view === 'bank' ? <BankApp onOpenPos={() => switchView('pos')} /> : <PosView />}
      </main>
    </div>
  )
}
