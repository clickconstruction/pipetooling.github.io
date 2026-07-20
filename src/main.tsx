import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import { AuthProvider } from './hooks/useAuth'
import { tryClaimChunkRecoveryReload } from './lib/chunkLoadRecovery'
import { hardReloadFromRoot } from './lib/hardReload'
import './index.css'

// A deploy replaces all hashed assets; when Vite's preload helper hits a stale-chunk 404
// mid-navigation, reload once (guarded) for the fresh build instead of white-screening.
// The route boundary (RouteChunkBoundary) handles the import()-rejection variant.
window.addEventListener('vite:preloadError', (event) => {
  if (tryClaimChunkRecoveryReload(Date.now(), typeof sessionStorage !== 'undefined' ? sessionStorage : null)) {
    event.preventDefault()
    hardReloadFromRoot()
  }
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter
      future={{
        // Keep false: v7_startTransition can leave router context (Outlet, useSearchParams) one
        // transition behind the real URL until a full reload — see remix-run/react-router#12546, #12552.
        v7_startTransition: false,
        v7_relativeSplatPath: true,
      }}
    >
      <AuthProvider>
        <App />
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
)
