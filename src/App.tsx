import { useEffect } from 'react'
import { Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from './hooks/useAuth'
import { supabase } from './lib/supabase'
import Layout from './components/Layout'
import SignIn from './pages/SignIn'
import SignUp from './pages/SignUp'
import ResetPassword from './pages/ResetPassword'
import ResetPasswordConfirm from './pages/ResetPasswordConfirm'
import Customers from './pages/Customers'
import CustomerForm from './pages/CustomerForm'
import Projects from './pages/Projects'
import ProjectForm from './pages/ProjectForm'
import Workflow from './pages/Workflow'
import Settings from './pages/Settings'
import Calendar from './pages/Calendar'
import Dashboard from './pages/Dashboard'
import Templates from './pages/Templates'
import People from './pages/People'
import Materials from './pages/Materials'
import Bids from './pages/Bids'
import Duplicates from './pages/Duplicates'
import Checklist from './pages/Checklist'
import { Toast, useToast } from './components/Toast'
import { UpdatePrompt } from './components/UpdatePrompt'
import { ForceReloadProvider } from './contexts/ForceReloadContext'

// Easter egg:
// Jodi if you can see this the secret code is Swordfish

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  if (loading) return <div style={{ padding: '2rem', textAlign: 'center' }}>Loading…</div>
  if (!user) return <Navigate to="/sign-in" replace />
  return <>{children}</>
}

function SignInRoute() {
  const { user, loading } = useAuth()
  if (loading) return <div style={{ padding: '2rem', textAlign: 'center' }}>Loading…</div>
  if (user) return <Navigate to="/dashboard" replace />
  return <SignIn />
}

// Component to handle magic link authentication from hash fragments
function AuthHandler() {
  const location = useLocation()
  const navigate = useNavigate()

  useEffect(() => {
    // Check if we have authentication tokens in the hash
    if (location.hash) {
      const hashParams = new URLSearchParams(location.hash.substring(1))
      const accessToken = hashParams.get('access_token')
      const refreshToken = hashParams.get('refresh_token')
      const type = hashParams.get('type')

      // Handle magiclink authentication (from login-as-user)
      if (accessToken && refreshToken && type === 'magiclink') {
        supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        }).then(({ error }) => {
          if (error) {
            console.error('Failed to set session from magic link:', error)
            navigate('/sign-in', { replace: true })
          } else {
            // Clear the hash, clear cache, and hard reload
            window.history.replaceState(null, '', window.location.pathname + window.location.search)
            const reload = () => { window.location.reload() }
            if (typeof caches !== 'undefined') {
              caches.keys().then((keys) => Promise.all(keys.map((k) => caches.delete(k))))
                .then(reload, reload)
            } else {
              reload()
            }
          }
        })
      }
    }
  }, [location.hash, navigate])

  return null
}

export default function App() {
  const { toasts, showToast, removeToast } = useToast()

  useEffect(() => {
    // Listen for session expiring events
    const handleSessionExpiring = ((event: CustomEvent) => {
      const minutes = event.detail.minutesRemaining
      showToast(
        `Your session will expire in ${minutes} minute${minutes !== 1 ? 's' : ''}. Please save your work.`,
        'warning'
      )
    }) as EventListener

    window.addEventListener('session-expiring', handleSessionExpiring)
    
    return () => {
      window.removeEventListener('session-expiring', handleSessionExpiring)
    }
  }, [showToast])

  return (
    <>
      <UpdatePrompt />
      <AuthHandler />
      <Routes>
        <Route path="/sign-in" element={<SignInRoute />} />
        <Route path="/sign-up" element={<SignUp />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/reset-password-confirm" element={<ResetPasswordConfirm />} />
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <ForceReloadProvider>
                <Layout />
              </ForceReloadProvider>
            </ProtectedRoute>
          }
        >
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="customers" element={<Customers />} />
          <Route path="customers/new" element={<CustomerForm />} />
          <Route path="customers/:id/edit" element={<CustomerForm />} />
          <Route path="projects" element={<Projects />} />
          <Route path="projects/new" element={<ProjectForm />} />
          <Route path="projects/:id/edit" element={<ProjectForm />} />
          <Route path="workflows/:projectId" element={<Workflow />} />
          <Route path="people" element={<People />} />
          <Route path="calendar" element={<Calendar />} />
          <Route path="templates" element={<Templates />} />
          <Route path="materials" element={<Materials />} />
          <Route path="duplicates" element={<Duplicates />} />
          <Route path="bids" element={<Bids />} />
          <Route path="checklist" element={<Checklist />} />
          <Route path="settings" element={<Settings />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      {/* Toast notifications */}
      {toasts.map(toast => (
        <Toast
          key={toast.id}
          message={toast.message}
          type={toast.type}
          onClose={() => removeToast(toast.id)}
        />
      ))}
    </>
  )
}
