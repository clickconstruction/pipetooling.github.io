import { useEffect, useState, lazy, Suspense } from 'react'
import { Routes, Route, Navigate, useLocation, useNavigate, useParams } from 'react-router-dom'
import { useAuth } from './hooks/useAuth'
import { useAppHealth } from './hooks/useAppHealth'
import { AUTH_GATE_SLOW_AFTER_MS, AUTH_GATE_SLOW_WORDS, gateHoldsFor } from './lib/appHealth'
import { supabase } from './lib/supabase'
import Layout from './components/Layout'
import { IndexLanding } from './components/IndexLanding'
import { indexLandingPath } from './lib/devBridgeLanding'
import SignIn from './pages/SignIn'
import Away from './pages/Away'
import BidRoom from './pages/BidRoom'
import SubmittalRoom from './pages/SubmittalRoom'
import DevLogin from './pages/DevLogin'
import BodyScrollLockSentinel from './components/BodyScrollLockSentinel'
import ResetPassword from './pages/ResetPassword'
import ResetPasswordConfirm from './pages/ResetPasswordConfirm'
import AcceptInvite from './pages/AcceptInvite'
const Customers = lazy(() => import('./pages/Customers'))
const CustomerDetail = lazy(() => import('./pages/CustomerDetail'))
const InKind = lazy(() => import('./pages/InKind'))
const DevelopmentPage = lazy(() => import('./pages/DevelopmentPage'))
const Projects = lazy(() => import('./pages/Projects'))
const ProjectEditGate = lazy(() => import('./pages/ProjectEditGate'))
const ProjectNewGate = lazy(() => import('./pages/ProjectNewGate'))
const Workflow = lazy(() => import('./pages/Workflow'))
const Settings = lazy(() => import('./pages/Settings'))
const Help = lazy(() => import('./pages/Help'))
const Calendar = lazy(() => import('./pages/Calendar'))
const Map = lazy(() => import('./pages/Map'))
const Dashboard = lazy(() => import('./pages/Dashboard'))
const DispatchMode = lazy(() => import('./pages/DispatchMode'))
const JobModeTabs = lazy(() => import('./pages/JobModeTabs'))
const Templates = lazy(() => import('./pages/Templates'))
const People = lazy(() => import('./pages/People'))
const Jobs = lazy(() => import('./pages/Jobs'))
const JobsAccountsReceivable = lazy(() => import('./pages/JobsAccountsReceivable'))
const LegalDeskPage = lazy(() => import('./pages/LegalDeskPage'))
const LienDeskPage = lazy(() => import('./pages/LienDeskPage'))
// The Projects board (punch list #242): every working project as one picture, beside the Pipeline's Forecast.
const ProjectsBoard = lazy(() => import('./pages/ProjectsBoard'))
const Banking = lazy(() => import('./pages/Banking'))
const Materials = lazy(() => import('./pages/Materials'))
const Quickfill = lazy(() => import('./pages/Quickfill'))
const Bridge = lazy(() => import('./pages/Bridge'))
const GcProjects = lazy(() => import('./pages/GcProjects'))
const Messages = lazy(() => import('./pages/Messages'))
const Training = lazy(() => import('./pages/Training'))
const Moneyfill = lazy(() => import('./pages/Moneyfill'))
const Partnerships = lazy(() => import('./pages/Partnerships'))
const Bids = lazy(() => import('./pages/Bids'))
const Prospects = lazy(() => import('./pages/Prospects'))
const Duplicates = lazy(() => import('./pages/Duplicates'))
const Checklist = lazy(() => import('./pages/Checklist'))
const Roadmap = lazy(() => import('./pages/Roadmap'))
const PunchList = lazy(() => import('./pages/PunchList'))
const JobTally = lazy(() => import('./pages/JobTally'))
const BoxCode = lazy(() => import('./pages/BoxCode'))
// #319 (v2.6981), the First look spike: the customer's page a look's link opens, and the desk that makes the link.
const ShowUs = lazy(() => import('./pages/ShowUsRoute'))
const ReceiptLink = lazy(() => import('./pages/ReceiptLink'))
const FirstLooks = lazy(() => import('./pages/FirstLooks'))
const BillsSent = lazy(() => import('./pages/BillsSent'))
const FirstLookRead = lazy(() => import('./pages/FirstLookRead'))
const BoxScan = lazy(() => import('./pages/BoxScan'))
const MachineCode = lazy(() => import('./pages/MachineCode'))
const ScheduleDispatch = lazy(() => import('./pages/ScheduleDispatch'))
const Estimates = lazy(() => import('./pages/Estimates'))
const Documents = lazy(() => import('./pages/Documents'))
const EstimateAcceptStaffPreview = lazy(() => import('./pages/EstimateAcceptStaffPreview'))
// GC mode's trade partner portal (P1b-ii-b): public, and loaded only when a company opens its link.
const GcTradePortal = lazy(() => import('./pages/GcTradePortal'))
const FileLinkPage = lazy(() => import('./pages/FileLinkPage'))
import EstimateAccept from './pages/EstimateAccept'
import EstimatePublicTerms from './pages/EstimatePublicTerms'
import HazmatNoticePublic from './pages/HazmatNoticePublic'
import CustomerPortal from './pages/CustomerPortal'
import SubPortal from './pages/SubPortal'
import PayLink from './pages/PayLink'
import LegalPortal from './pages/LegalPortal'
import GcWordAsk from './pages/GcWordAsk'
import LegalConfirm from './pages/LegalConfirm'
import SupplyHouseQuotePage from './pages/SupplyHouseQuotePage'
import PartnerStatement from './pages/PartnerStatement'
import Logbook from './pages/Logbook'
import ContractAccept from './pages/ContractAccept'
import CustomerRating from './pages/CustomerRating'
import JobContractSign from './pages/JobContractSign'
import ContractBookPreview from './pages/ContractBookPreview'
import FileOpen from './pages/FileOpen'
import TaskShortcut from './pages/TaskShortcut'
import { LeaveSignIn, SignedOutGate } from './components/SignInReturn'
import { wipeServiceWorkersAndCaches } from './lib/hardReload'
import { ToastProvider, useToastContext } from './contexts/ToastContext'
import { ConfirmDialogProvider } from './contexts/ConfirmDialogContext'
import { ThemeProvider } from './contexts/ThemeContext'
import { LedgerDisplayPrefixProvider } from './contexts/LedgerDisplayPrefixContext'
import { DispatchNoteRequirementsProvider } from './contexts/DispatchNoteRequirementsContext'
import { UpdatePrompt } from './components/UpdatePrompt'
import { ForceReloadProvider } from './contexts/ForceReloadContext'
import { RealtimeLifecycleProvider } from './contexts/RealtimeLifecycleContext'
import { ChecklistAddModalProvider } from './contexts/ChecklistAddModalContext'
import { DispatchTaskModalProvider } from './contexts/DispatchTaskModalContext'
import { EstimatorTaskModalProvider } from './contexts/EstimatorTaskModalContext'
import { NewCustomerModalProvider } from './contexts/NewCustomerModalContext'
import { NewProjectModalProvider } from './contexts/NewProjectModalContext'
import { EditCustomerModalProvider } from './contexts/EditCustomerModalContext'
import { EditProjectModalProvider } from './contexts/EditProjectModalContext'
import { BillCustomerModalProvider } from './contexts/BillCustomerModalContext'
import { TestReportModalProvider } from './contexts/TestReportModalContext'
import { JobDetailOpenerBridgeProvider } from './contexts/JobDetailOpenerBridgeContext'
import { JobFormModalProvider } from './contexts/JobFormModalContext'
import { BidPreviewModalProvider } from './contexts/BidPreviewModalContext'
import { ErrorBoundary } from './components/ErrorBoundary'
import { RouteChunkBoundary } from './components/RouteChunkBoundary'
import { DailyGoalsGateProvider } from './contexts/DailyGoalsGateContext'
import { JobsListCacheProvider } from './contexts/JobsListCacheContext'
import { JobDetailModalProvider } from './contexts/JobDetailModalContext'
import { CustomerProfileModalProvider } from './contexts/CustomerProfileModalContext'
import { PayCalendarModalProvider } from './contexts/PayCalendarModalContext'
import { JobHoursStoryModalProvider } from './contexts/JobHoursStoryModalContext'
import { UpdateFocusOpenerBridgeProvider } from './contexts/UpdateFocusOpenerBridgeContext'
import { UserReviewModalProvider } from './contexts/UserReviewModalContext'
import { PersonDeskProvider } from './contexts/PersonDeskContext'

// Easter egg:
// Jodi if you can see this the secret code is Swordfish

/** Auth-gate loading screen (v2.1051): after 5s it offers the repair page so
 * nobody stares at a bare "Loading…" during an outage or a wedged cache. The
 * useAuth watchdog separately gives up at 8s and falls through to sign-in.
 * In a freeze (#183 PR 1, v2.6009) the app-health kernel has seen a request
 * start and nothing land: past 5 s the screen reads "The app is slow right
 * now. Keep this open." and offers no repair link, and the watchdog holds.
 * The link stays for the case where no request could start at all. */
function AuthGateLoadingScreen() {
  const [past5s, setPast5s] = useState(false)
  useEffect(() => {
    const t = setTimeout(() => setPast5s(true), AUTH_GATE_SLOW_AFTER_MS)
    return () => clearTimeout(t)
  }, [])
  const health = useAppHealth()
  const slow = past5s && gateHoldsFor(health.state)
  return (
    <div style={{ padding: '2rem', textAlign: 'center' }} data-auth-gate={slow ? 'slow' : 'loading'}>
      {slow ? AUTH_GATE_SLOW_WORDS : 'Loading…'}
      {past5s && !slow ? (
        <div style={{ marginTop: '1rem', fontSize: '0.875rem' }}>
          <a href="/fix-cache.html" style={{ color: 'var(--text-link)' }}>
            Taking too long? Fix the app
          </a>
        </div>
      ) : null}
    </div>
  )
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  // A visitor who arrives signed out asked for this address, and the gate keeps it across the sign-in (v2.7182).
  // One who was signed in on this visit and is not now (Sign out, a session that ended) asked for nothing.
  const [hadSession, setHadSession] = useState(false)
  useEffect(() => {
    if (user) setHadSession(true)
  }, [user])
  if (loading) return <AuthGateLoadingScreen />
  if (!user) return <SignedOutGate hadSession={hadSession} />
  return <>{children}</>
}

function SignInRoute() {
  const { user, loading, role } = useAuth()
  if (loading) return <AuthGateLoadingScreen />
  if (user) {
    // The address the person asked for before signing in, once: the gate's, the standalone /task launch's, a box
    // label's, a file link's, or the one an emailed sign-in link carries (`signInReturnAddress.ts` holds the rule: a
    // path on this site and nothing else). With none waiting, the role's landing: a dev on the Bridge, everyone else
    // on the Dashboard (v2.5879, `indexLandingPath`).
    return <LeaveSignIn landing={indexLandingPath(role)} />
  }
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
            // Fresh SW + caches, then hard reload (wipe without unregistering would
            // leave the old SW controlling with an empty precache — see hardReload.ts)
            const reload = () => { window.location.reload() }
            wipeServiceWorkersAndCaches().then(reload, reload)
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
  const { pathname } = useLocation()

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
      <UpdatePrompt />
      {/* Freezes the page behind ANY blocking overlay (modal, sheet, dialog) on every route, the public pages too; opt-out via data-page-scroll="allow". */}
      <BodyScrollLockSentinel />
      {/* Every route sits in a chunk boundary: a page outside the Layout (a box label's scan, a public room), or a provider
          above it, whose chunk the newest deploy no longer serves used to unmount the whole app and leave an empty page.
          The Layout keeps its own around the outlet, so a lost page chunk there still leaves the nav standing. */}
      <RouteChunkBoundary resetKey={pathname}>
      <Routes>
        <Route path="/sign-in" element={<SignInRoute />} />
        <Route path="/dev-login" element={<DevLogin />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/reset-password-confirm" element={<ResetPasswordConfirm />} />
        <Route path="/accept-invite" element={<AcceptInvite />} />
        <Route path="/task" element={<TaskShortcut />} />
        <Route path="/estimate/accept" element={<EstimateAccept />} />
        {/* #281 (v2.6678): the estimate text's short link, my.clickplumbing.com/e/<code>, lands here with the code in the path. */}
        <Route path="/e/:code" element={<EstimateAccept />} />
        <Route path="/bid-room" element={<BidRoom />} />
        <Route path="/submittal" element={<SubmittalRoom />} />
        <Route path="/q/:token" element={<SupplyHouseQuotePage />} />
        <Route path="/contract/accept" element={<ContractAccept />} />
        <Route path="/contract/sign" element={<JobContractSign />} />
        <Route path="/estimate/terms" element={<EstimatePublicTerms />} />
        <Route path="/hazmat-notice" element={<HazmatNoticePublic />} />
        <Route path="/portal" element={<CustomerPortal />} />
        <Route path="/p/:slug" element={<CustomerPortal />} />
        <Route path="/sub" element={<SubPortal />} />
        <Route path="/pay/:id" element={<PayLink />} />
        {/* #294 (v2.6797): a box label's code, prts.co/b/<code>. Signed out it is the public box page; signed in it opens the box on the On site tab. Outside the Layout so the sign-in gate never swallows a scan. */}
        {/* v2.6868: each of the two box routes sits in its own Suspense. They are lazy, and a press on one opens the other
            (Open the box, Scan another label, Type the code): with no boundary that press suspended in a click and
            React blanked the page. */}
        <Route
          path="/b/:code"
          element={
            <Suspense fallback={null}>
              <BoxCode />
            </Suspense>
          }
        />
        {/* #294 (v2.6799): bare prts.co lands here, Scan a label: type the code, or find a part on the site this phone last scanned. */}
        <Route
          path="/b"
          element={
            <Suspense fallback={null}>
              <BoxScan />
            </Suspense>
          }
        />
        {/* #319 (v2.6981), the First look spike: a look's link, /show/<ten letters>. No sign-in: the code is the key. Outside the Layout, in its own Suspense, as the box page is. */}
        <Route
          path="/show/:code"
          element={
            <Suspense fallback={null}>
              <ShowUs />
            </Suspense>
          }
        />
        {/* #299 (v2.7101): a receipt link for a card charge, /r/<ten letters>. No sign-in: the code is the key. Outside the Layout, in its own Suspense, as the box page is. */}
        <Route
          path="/r/:code"
          element={
            <Suspense fallback={null}>
              <ReceiptLink />
            </Suspense>
          }
        />
        <Route path="/rate" element={<CustomerRating />} />
        <Route path="/s/:slug" element={<SubPortal />} />
        <Route path="/legal" element={<LegalPortal />} />
        <Route path="/ask" element={<GcWordAsk />} />
        <Route
          path="/t/:token"
          element={
            <Suspense fallback={null}>
              <GcTradePortal />
            </Suspense>
          }
        />
        <Route
          path="/f/:link"
          element={
            <Suspense fallback={null}>
              <FileLinkPage />
            </Suspense>
          }
        />
        <Route path="/legal/confirm" element={<LegalConfirm />} />
        {/* The staff preview is lazy and sits outside the Layout's Suspense, so it carries its own: Back onto it after a
            reload suspended in a popstate, which React treats as a press, and blanked the page. */}
        <Route
          path="/estimate/customer-accept-preview/:id"
          element={
            <ProtectedRoute>
              <Suspense fallback={null}>
                <EstimateAcceptStaffPreview />
              </Suspense>
            </ProtectedRoute>
          }
        />
        {/* A kept file's lasting link (Messages cut 6): it signs in on its own, so it returns to the file after. */}
        <Route path="/files/:source/:id" element={<FileOpen />} />
        <Route
          path="/contract/book-preview"
          element={
            <ProtectedRoute>
              <ContractBookPreview />
            </ProtectedRoute>
          }
        />
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <RealtimeLifecycleProvider>
                <ForceReloadProvider>
                  <ChecklistAddModalProvider>
                    <DispatchTaskModalProvider>
                      <EstimatorTaskModalProvider>
                        <NewCustomerModalProvider>
                          <NewProjectModalProvider>
                            <EditCustomerModalProvider>
                              <EditProjectModalProvider>
                                {/* Above Bill Customer and the job window (punch list #341): both open their own windows from
                                    providers, and a Pay calendar press inside either found no opener while this sat below them. */}
                                <PayCalendarModalProvider>
                                <BillCustomerModalProvider>
                                <TestReportModalProvider>
                                  <JobDetailOpenerBridgeProvider>
                                  <JobFormModalProvider>
                                    <BidPreviewModalProvider>
                                      <DailyGoalsGateProvider>
                                        <JobsListCacheProvider>
                                          <UpdateFocusOpenerBridgeProvider>
                                            <JobDetailModalProvider>
                                              <CustomerProfileModalProvider>
                                              <JobHoursStoryModalProvider>
                                              <UserReviewModalProvider>
                                                <PersonDeskProvider>
                                                  <Layout />
                                                </PersonDeskProvider>
                                              </UserReviewModalProvider>
                                              </JobHoursStoryModalProvider>
                                              </CustomerProfileModalProvider>
                                            </JobDetailModalProvider>
                                          </UpdateFocusOpenerBridgeProvider>
                                        </JobsListCacheProvider>
                                      </DailyGoalsGateProvider>
                                    </BidPreviewModalProvider>
                                  </JobFormModalProvider>
                                  </JobDetailOpenerBridgeProvider>
                                </TestReportModalProvider>
                                </BillCustomerModalProvider>
                                </PayCalendarModalProvider>
                              </EditProjectModalProvider>
                            </EditCustomerModalProvider>
                          </NewProjectModalProvider>
                        </NewCustomerModalProvider>
                      </EstimatorTaskModalProvider>
                    </DispatchTaskModalProvider>
                  </ChecklistAddModalProvider>
                </ForceReloadProvider>
              </RealtimeLifecycleProvider>
            </ProtectedRoute>
          }
        >
          <Route index element={<IndexLanding />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="dispatch-mode" element={<DispatchMode />} />
          <Route path="dispatch-mode/schedule" element={<DispatchMode />} />
          <Route path="dispatch-mode/inbox" element={<DispatchMode />} />
          <Route path="dispatch-mode/customers" element={<DispatchMode />} />

          <Route path="dispatch-mode/po" element={<DispatchMode />} />
          <Route path="job-mode/schedule" element={<JobModeTabs />} />
          <Route path="job-mode/inbox" element={<JobModeTabs />} />
          <Route path="job-mode/customers" element={<JobModeTabs />} />
          <Route path="customers" element={<Customers />} />
          <Route path="customers/new" element={<Navigate to="/customers" state={{ openNewCustomer: true }} replace />} />
          <Route path="customers/:id" element={<CustomerDetail />} />
          <Route path="customers/:id/edit" element={<NavigateToEditCustomer />} />
          {/* The Development page (punch list #208 PR 2): a development's everything-in-one-place page, the Customer Hub's sibling. */}
          <Route path="developments/:id" element={<DevelopmentPage />} />
          <Route path="projects" element={<Projects />} />
          <Route path="projects/new" element={<ProjectNewGate />} />
          <Route path="projects/:id/edit" element={<ProjectEditGate />} />
          <Route path="workflows/:projectId" element={<Workflow />} />
          <Route path="jobs" element={<Jobs />} />
          <Route path="accounts-receivable" element={<JobsAccountsReceivable />} />
          {/* Bills sent (punch list #327): every bill that left, to whom and the minute it went, read from the sent copies. */}
          <Route path="bills-sent" element={<ErrorBoundary><BillsSent /></ErrorBoundary>} />
          <Route path="in-kind" element={<ErrorBoundary><InKind /></ErrorBoundary>} />
          <Route path="legal-desk" element={<LegalDeskPage />} />
          <Route path="lien-desk" element={<LienDeskPage />} />
          <Route path="projects-board" element={<ErrorBoundary><ProjectsBoard /></ErrorBoundary>} />
          <Route path="schedule-dispatch" element={<ScheduleDispatch />} />
          <Route path="banking" element={<Banking />} />
          <Route path="quickfill" element={<ErrorBoundary><Quickfill /></ErrorBoundary>} />
          <Route path="bridge" element={<ErrorBoundary><Bridge /></ErrorBoundary>} />
          <Route path="gc" element={<ErrorBoundary><GcProjects /></ErrorBoundary>} />
          <Route path="messages" element={<ErrorBoundary><Messages /></ErrorBoundary>} />
          {/* A training course, read at the person's own pace (punch list #111): the lessons ride in this lazy chunk. */}
          <Route path="training/:slug" element={<ErrorBoundary><Training /></ErrorBoundary>} />
          <Route path="moneyfill" element={<ErrorBoundary><Moneyfill /></ErrorBoundary>} />
          <Route path="partnerships" element={<ErrorBoundary><Partnerships /></ErrorBoundary>} />
          <Route path="my-statement" element={<ErrorBoundary><PartnerStatement /></ErrorBoundary>} />
          <Route path="logbook/:userId" element={<ErrorBoundary><Logbook /></ErrorBoundary>} />
          <Route path="my-logbook" element={<ErrorBoundary><Logbook own /></ErrorBoundary>} />
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
          <Route path="roadmap" element={<Roadmap />} />
          <Route path="punch-list" element={<PunchList />} />
          <Route path="first-looks" element={<ErrorBoundary><FirstLooks /></ErrorBoundary>} />
          <Route path="first-look/:id" element={<ErrorBoundary><FirstLookRead /></ErrorBoundary>} />
          <Route path="tally" element={<JobTally />} />
          <Route path="m/:code" element={<MachineCode />} />
          <Route path="settings" element={<Settings />} />
          <Route path="help" element={<Help />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      </RouteChunkBoundary>
    </>
  )
}

function LedgerDisplayPrefixBridge({ children }: { children: React.ReactNode }) {
  const { user } = useAuth()
  return <LedgerDisplayPrefixProvider authUserId={user?.id ?? null}>{children}</LedgerDisplayPrefixProvider>
}

function DispatchNoteRequirementsBridge({ children }: { children: React.ReactNode }) {
  const { user } = useAuth()
  return (
    <DispatchNoteRequirementsProvider authUserId={user?.id ?? null}>
      {children}
    </DispatchNoteRequirementsProvider>
  )
}

/**
 * The Away note (punch list #256 PR 8, v2.6587): a signed-in account the seal refused (archived, with a note left for
 * it) gets the Away page in place of everything under it, providers and routes alike, so nothing else reads as them.
 * Whatever path they typed, this is the page. `my_away_note()` is the one read the gate lets through.
 */
function ArchivedCallerGate({ children }: { children: React.ReactNode }) {
  const { archivedCaller, loading } = useAuth()
  if (!loading && archivedCaller) return <Away />
  return <>{children}</>
}

export default function App() {
  return (
    <ThemeProvider>
      <ToastProvider>
        <ConfirmDialogProvider>
        <ArchivedCallerGate>
        <LedgerDisplayPrefixBridge>
          <DispatchNoteRequirementsBridge>
            <AppContent />
          </DispatchNoteRequirementsBridge>
        </LedgerDisplayPrefixBridge>
        </ArchivedCallerGate>
        </ConfirmDialogProvider>
      </ToastProvider>
    </ThemeProvider>
  )
}
