import { useEffect, lazy } from 'react'
import { Routes, Route, Navigate, useLocation, useNavigate, useParams } from 'react-router-dom'
import { useAuth } from './hooks/useAuth'
import { supabase } from './lib/supabase'
import Layout from './components/Layout'
import SignIn from './pages/SignIn'
import DevLogin from './pages/DevLogin'
import SignUp from './pages/SignUp'
import ResetPassword from './pages/ResetPassword'
import ResetPasswordConfirm from './pages/ResetPasswordConfirm'
const Customers = lazy(() => import('./pages/Customers'))
const Projects = lazy(() => import('./pages/Projects'))
const ProjectForm = lazy(() => import('./pages/ProjectForm'))
const ProjectNewGate = lazy(() => import('./pages/ProjectNewGate'))
const Workflow = lazy(() => import('./pages/Workflow'))
const Settings = lazy(() => import('./pages/Settings'))
const Calendar = lazy(() => import('./pages/Calendar'))
const Map = lazy(() => import('./pages/Map'))
const Dashboard = lazy(() => import('./pages/Dashboard'))
const Templates = lazy(() => import('./pages/Templates'))
const People = lazy(() => import('./pages/People'))
const Jobs = lazy(() => import('./pages/Jobs'))
const JobsAccountsReceivable = lazy(() => import('./pages/JobsAccountsReceivable'))
const Banking = lazy(() => import('./pages/Banking'))
const Materials = lazy(() => import('./pages/Materials'))
const Quickfill = lazy(() => import('./pages/Quickfill'))
const Bids = lazy(() => import('./pages/Bids'))
const Prospects = lazy(() => import('./pages/Prospects'))
const Duplicates = lazy(() => import('./pages/Duplicates'))
const Checklist = lazy(() => import('./pages/Checklist'))
const JobTally = lazy(() => import('./pages/JobTally'))
const ScheduleDispatch = lazy(() => import('./pages/ScheduleDispatch'))
const Estimates = lazy(() => import('./pages/Estimates'))
const Documents = lazy(() => import('./pages/Documents'))
const EstimateAcceptStaffPreview = lazy(() => import('./pages/EstimateAcceptStaffPreview'))
import EstimateAccept from './pages/EstimateAccept'
import EstimatePublicTerms from './pages/EstimatePublicTerms'
import ContractAccept from './pages/ContractAccept'
import { ToastProvider, useToastContext } from './contexts/ToastContext'
import { registerSW } from 'virtual:pwa-register'
import { ForceReloadProvider } from './contexts/ForceReloadContext'
import { ChecklistAddModalProvider } from './contexts/ChecklistAddModalContext'
import { DispatchTaskModalProvider } from './contexts/DispatchTaskModalContext'
import { EstimatorTaskModalProvider } from './contexts/EstimatorTaskModalContext'
import { NewCustomerModalProvider } from './contexts/NewCustomerModalContext'
import { NewProjectModalProvider } from './contexts/NewProjectModalContext'
import { EditCustomerModalProvider } from './contexts/EditCustomerModalContext'
import { BillCustomerModalProvider } from './contexts/BillCustomerModalContext'
import { JobFormModalProvider } from './contexts/JobFormModalContext'
import { BidPreviewModalProvider } from './contexts/BidPreviewModalContext'
import { ErrorBoundary } from './components/ErrorBoundary'
import { DailyGoalsGateProvider } from './contexts/DailyGoalsGateContext'
import { JobsListCacheProvider } from './contexts/JobsListCacheContext'

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
        // Clear hash FIRST so back button cannot return to token URL
        window.history.replaceState(null, '', window.location.pathname + window.location.search)
        supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        }).then(({ error }) => {
          if (error) {
            console.error('Failed to set session from magic link:', error)
            navigate('/sign-in', { replace: true })
          } else {
            // Clear cache and hard reload
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

function NavigateToEditCustomer() {
  const { id } = useParams<{ id: string }>()
  return <Navigate to="/customers" state={{ openEditCustomer: id ?? null }} replace />
}

function AppContent() {
  const { showToast } = useToastContext()

  useEffect(() => {
    registerSW({ immediate: true })
  }, [])

  useEffect(() => {
    const handleSessionExpiring = ((event: CustomEvent) => {
      const minutes = event.detail.minutesRemaining
      showToast(
        `Your session will expire in ${minutes} minute${minutes !== 1 ? 's' : ''}. Please save your work.`,
        'warning'
      )
    }) as EventListener

    window.addEventListener('session-expiring', handleSessionExpiring)
    return () => window.removeEventListener('session-expiring', handleSessionExpiring)
  }, [showToast])

  return (
    <>
      <AuthHandler />
      <Routes>
        <Route path="/sign-in" element={<SignInRoute />} />
        <Route path="/dev-login" element={<DevLogin />} />
        <Route path="/sign-up" element={<SignUp />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/reset-password-confirm" element={<ResetPasswordConfirm />} />
        <Route path="/estimate/accept" element={<EstimateAccept />} />
        <Route path="/contract/accept" element={<ContractAccept />} />
        <Route path="/estimate/terms" element={<EstimatePublicTerms />} />
        <Route
          path="/estimate/customer-accept-preview/:id"
          element={
            <ProtectedRoute>
              <EstimateAcceptStaffPreview />
            </ProtectedRoute>
          }
        />
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <ForceReloadProvider>
                <ChecklistAddModalProvider>
                  <DispatchTaskModalProvider>
                    <EstimatorTaskModalProvider>
                      <NewCustomerModalProvider>
                        <NewProjectModalProvider>
                          <EditCustomerModalProvider>
                            <BillCustomerModalProvider>
                              <JobFormModalProvider>
                                <BidPreviewModalProvider>
                                  <DailyGoalsGateProvider>
                                    <JobsListCacheProvider>
                                      <Layout />
                                    </JobsListCacheProvider>
                                  </DailyGoalsGateProvider>
                                </BidPreviewModalProvider>
                              </JobFormModalProvider>
                            </BillCustomerModalProvider>
                          </EditCustomerModalProvider>
                        </NewProjectModalProvider>
                      </NewCustomerModalProvider>
                    </EstimatorTaskModalProvider>
                  </DispatchTaskModalProvider>
                </ChecklistAddModalProvider>
              </ForceReloadProvider>
            </ProtectedRoute>
          }
        >
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="customers" element={<Customers />} />
          <Route path="customers/new" element={<Navigate to="/customers" state={{ openNewCustomer: true }} replace />} />
          <Route path="customers/:id/edit" element={<NavigateToEditCustomer />} />
          <Route path="projects" element={<Projects />} />
          <Route path="projects/new" element={<ProjectNewGate />} />
          <Route path="projects/:id/edit" element={<ProjectForm />} />
          <Route path="workflows/:projectId" element={<Workflow />} />
          <Route path="jobs" element={<Jobs />} />
          <Route path="accounts-receivable" element={<JobsAccountsReceivable />} />
          <Route path="schedule-dispatch" element={<ScheduleDispatch />} />
          <Route path="banking" element={<Banking />} />
          <Route path="quickfill" element={<ErrorBoundary><Quickfill /></ErrorBoundary>} />
          <Route path="people" element={<People />} />
          <Route path="calendar" element={<Calendar />} />
          <Route path="map" element={<Map />} />
          <Route path="templates" element={<Templates />} />
          <Route path="materials" element={<Materials />} />
          <Route path="estimates" element={<Estimates />} />
          <Route path="estimates/:id" element={<Estimates />} />
          <Route path="documents" element={<Documents />} />
          <Route path="duplicates" element={<Duplicates />} />
          <Route path="bids" element={<Bids />} />
          <Route path="prospects" element={<Prospects />} />
          <Route path="checklist" element={<Checklist />} />
          <Route path="tally" element={<JobTally />} />
          <Route path="settings" element={<Settings />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  )
}

export default function App() {
  return (
    <ToastProvider>
      <AppContent />
    </ToastProvider>
  )
}
