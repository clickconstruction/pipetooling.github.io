import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import { AuthProvider } from './hooks/useAuth'
import './index.css'

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
