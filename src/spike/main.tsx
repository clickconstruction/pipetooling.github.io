/**
 * SPIKE ONLY (2026-11-15, punch list #346 and #350): the real components over made-up data, for screenshots and for
 * the states prod does not have. Served by the dev server at `/spike-sub-labor.html#<view>`. Deleted at wrap-up.
 */
import { StrictMode, useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import '../index.css'
import { SPIKE_VIEWS as BASE_VIEWS } from './views'
import { PAYMENT_VIEWS } from './paymentViews'

import { PORTAL_VIEWS } from './portalViews'

const SPIKE_VIEWS = [...BASE_VIEWS, ...PAYMENT_VIEWS, ...PORTAL_VIEWS]

function App() {
  const [hash, setHash] = useState(() => window.location.hash.replace(/^#/, '') || 'index')
  useEffect(() => {
    const on = () => setHash(window.location.hash.replace(/^#/, '') || 'index')
    window.addEventListener('hashchange', on)
    return () => window.removeEventListener('hashchange', on)
  }, [])
  const view = SPIKE_VIEWS.find((v) => v.key === hash)
  return (
    <div style={{ maxWidth: view?.wide === false ? 420 : 1180, margin: '0 auto', padding: view?.bare ? 0 : '1rem', color: 'var(--text-700)', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      {view && !view.bare ? (
        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '0.6rem' }}>
          <a href="#index">Sub labor spike</a> · {view.title} · every name and amount here is made up
        </div>
      ) : null}
      {view ? (
        <div key={view.key}>{view.render()}</div>
      ) : (
        <div>
          <h1 style={{ fontSize: '1.2rem' }}>Sub labor spike · punch list #346 and #350</h1>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>The real components over made-up data. The live page, on real data and read only, is People → Subs on this dev server.</p>
          <ul style={{ lineHeight: 1.9 }}>
            {SPIKE_VIEWS.map((v) => (
              <li key={v.key}>
                <a href={`#${v.key}`}>{v.title}</a>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
