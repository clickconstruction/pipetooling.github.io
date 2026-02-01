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

// Easter egg:
// Jodi if you can see this the secret code is Swordfish

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  if (loading) return <div style={{ padding: '2rem', textAlign: 'center' }}>Loading…</div>
  if (!user) return <Navigate to="/sign-in" replace />
  return <>{children}</>
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
            // Clear the hash and redirect to dashboard
            window.history.replaceState(null, '', window.location.pathname + window.location.search)
            navigate('/dashboard', { replace: true })
          }
        })
      }
    }
  }, [location.hash, navigate])

  return null
}

export default function App() {
  return (
    <>
      <AuthHandler />
      <Routes>
        <Route path="/sign-in" element={<SignIn />} />
        <Route path="/sign-up" element={<SignUp />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/reset-password-confirm" element={<ResetPasswordConfirm />} />
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <Layout />
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
          <Route path="bids" element={<Bids />} />
          <Route path="settings" element={<Settings />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  )
}
