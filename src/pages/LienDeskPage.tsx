/**
 * The Lien desk as a page (punch list #182, the Lien desk's PR 1): `/lien-desk`, with the view, the notice and
 * the pile in the address (`lib/lien/lienDeskRoute.ts`), so a reload keeps your place, Back returns to the
 * Pipeline, and the address bar is the link to paste. Until this PR the desk was a window over the Pipeline,
 * opened by a one-shot `?liendesk=` link the board stripped on arrival; `Jobs.tsx` sends every such link here.
 *
 * The page reads for itself what the board used to hand the window: the desk's own rows (`useLienDeskData`, the
 * full read), the work months behind each notice, the letterhead, the people who sign, the By date rows from
 * the app-wide jobs cache (every billed job, through the kernel the Pipeline reads too) and the firm's matters
 * for counsel's sign-off. The doors back: the job form and the job window through their app-wide contexts, the
 * Legal desk and Settings by their addresses, and the three windows the desk opens over itself — a job's Lien
 * window, Put a GC on notice and Records for an owner — mounted here as the Pipeline mounted them. The gate is
 * the office set the desk's doors had (`isStagesOfficeRole`); anyone else lands on the Dashboard once their role
 * is known. On a phone (PR 3) the Notices list is the whole desk until a notice is open, and an open notice is the
 * whole desk with ← Notices on top; the address says which.
 */
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { Navigate, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useIsMobile } from '../hooks/useIsMobile'
import { useTopEdge } from '../hooks/useTopEdge'
import { buildJobsListCacheKey, useJobsListCache } from '../contexts/JobsListCacheContext'
import { useJobFormModal } from '../contexts/JobFormModalContext'
import { useEditCustomerModal } from '../contexts/EditCustomerModalContext'
import { useJobDetailModal } from '../contexts/JobDetailModalContext'
import { useToastContext } from '../contexts/ToastContext'
import { useLienDeskData } from '../hooks/useLienDeskData'
import { useForecastWorkMonths } from '../hooks/useForecastWorkMonths'
import { useLienCalendarRows } from '../hooks/useLienCalendarRows'
import { legalRpc, useLegalMatters } from '../hooks/useLegalMatters'
import { matterIsWithFirm } from '../lib/legal/legalMatters'
import { newAskMeta, signoffStateForJob } from '../lib/legal/legalAsks'
import { isStagesOfficeRole } from '../lib/jobs/stagesRoleGates'
import { useZzTestJobsHidden } from '../lib/jobs/zzTestJobSwitch'
import { fetchPhysicalInvoiceIssuerFromAppSettings, getPhysicalInvoiceIssuerDraft } from '../lib/physicalInvoiceIssuer'
import { lienSignerNameFor, lienSignerPhoneFor, type LienSignerUser } from '../lib/jobs/lienSigner'
import { lienFocusEditJobOptions } from '../lib/jobs/lienFocusEditJobOptions'
import { isLienLeader } from '../lib/jobs/lienDesk'
import { syncLienDeskAfterRecord } from '../lib/jobs/lienDeskIo'
import { lienWindowDeskAffidavit, lienWindowDeskNotice } from '../lib/jobs/lienTimelineDesk'
import { ownerRecordsFromDesk } from '../lib/jobs/ownerRecordsDesk'
import { fetchJobWithDetailsById } from '../lib/fetchJobWithDetailsById'
import { fetchActiveUsers } from '../lib/people/fetchActiveUsers'
import { effectiveJobLedgerNumber } from '../lib/ledgerDisplayPrefixes'
import { scopeForStagesSection } from '../lib/jobs/stagesSectionPrefs'
import { hasInAppHistory } from '../lib/inAppHistory'
import { calendarYmdInAppTzFromIso } from '../utils/dateUtils'
import { LEGAL_DESK_PATH, PIPELINE_HREF } from '../lib/legal/legalDeskRoute'
import { LIEN_DESK_DEFAULT_KIND, lienDeskFromSearch, lienDeskHref, type LienDeskKind } from '../lib/lien/lienDeskRoute'
import LienDesk from '../components/jobs/LienDesk'
import LienInstrumentsModal from '../components/jobs/LienInstrumentsModal'
import LienOwnerRecordsModal from '../components/jobs/LienOwnerRecordsModal'
import GcOnNoticeModal from '../components/jobs/GcOnNoticeModal'
import type { JobWithDetails } from '../types/jobWithDetails'
import type { LienDeskPile } from '../lib/jobs/lienDesk'
import { lienDeskRowFromState, lienDeskStateForView, lienDeskStateWithRow } from '../lib/jobs/lienPhoneJobScreen'

/** The same people the Jobs page hands the desk: the office and the field, and a dev's fellow devs. */
const DESK_USER_ROLES = ['assistant', 'controller', 'master_technician', 'subcontractor', 'helpers', 'estimator', 'primary', 'superintendent']

const BACK_DOOR: CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 6, height: 30, padding: '0 10px', borderWidth: 1, borderStyle: 'solid', borderColor: 'var(--border-strong)', borderRadius: 8, background: 'var(--surface)', color: 'var(--text-700)', font: 'inherit', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap', flex: 'none', marginRight: 8 }

/** The room under the page's top edge, so the desk's lists and panes scroll inside the screen and the page itself never does. */
const PAGE_BOTTOM_GAP_PX = 8

type LienWindow = { job: JobWithDetails; initialTab?: 'demand' | 'notice' | 'affidavit' | 'release_record'; noticeMonths?: string[] | null; openLastWork?: boolean }

export default function LienDeskPage() {
  const { user, role, loading: authLoading, profileName } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const jobFormModal = useJobFormModal()
  const editCustomerModal = useEditCustomerModal()
  const jobDetail = useJobDetailModal()
  const { showToast } = useToastContext()
  const isMobile = useIsMobile()
  const allowed = Boolean(user?.id) && isStagesOfficeRole(role)
  const authName = profileName?.trim() ?? ''
  const todayYmd = calendarYmdInAppTzFromIso(new Date().toISOString())

  // The By date rows are the billed jobs the board loads lazily. On a cold open, or when the cache holds another customer
  // filter's board, the page takes the Pipeline's own scoped first load for that one scope (a scope fetch alone is a no-op
  // until a board snapshot exists); on a warm cache it asks for the scope the way the Pipeline's doors did.
  const { jobs, jobsListDataKey, fetchScopeIfNeeded, runFetchScopes, mergedScopes } = useJobsListCache()
  const billedScope = scopeForStagesSection('billed')
  const userId = user?.id ?? null
  const cacheWarm = userId != null && jobsListDataKey === buildJobsListCacheKey(userId, null)
  useEffect(() => {
    if (!allowed) return
    if (cacheWarm) void fetchScopeIfNeeded(billedScope, null)
    else void runFetchScopes([billedScope], null)
  }, [allowed, cacheWarm, billedScope, fetchScopeIfNeeded, runFetchScopes])

  // The desk's own rows: the full read, as the open window read them.
  const hideZz = useZzTestJobsHidden(role)
  const { data, loading, refetch } = useLienDeskData(allowed, todayYmd, { light: false, hideZzTestJobs: hideZz })
  const deskJobs = useMemo(
    () => (data ? Object.values(data.jobsById).map((j) => ({ id: j.id, gc_customer_id: j.gc_customer_id, customer_address_id: j.customer_address_id })) : null),
    [data],
  )
  const { byJob: workMonths } = useForecastWorkMonths(deskJobs, todayYmd)

  // The letterhead (Settings → Company): the draft at once, then the saved one.
  const [issuerGen, setIssuerGen] = useState(0)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const issuer = useMemo(() => getPhysicalInvoiceIssuerDraft(), [issuerGen])
  useEffect(() => {
    if (!allowed) return
    let live = true
    void fetchPhysicalInvoiceIssuerFromAppSettings({ authRole: role }).then(() => {
      if (live) setIssuerGen((g) => g + 1)
    })
    return () => {
      live = false
    }
  }, [allowed, role])

  // Who signs: the job's master by his title line or his name, else the person at the keyboard (`lienSigner.ts`).
  const [users, setUsers] = useState<LienSignerUser[]>([])
  useEffect(() => {
    if (!allowed) return
    let live = true
    void (async () => {
      const [people, devs] = await Promise.all([
        fetchActiveUsers<LienSignerUser>('id, name, notes, phone', { roles: DESK_USER_ROLES }),
        role === 'dev' ? fetchActiveUsers<LienSignerUser>('id, name, notes', { roles: [], includeDev: true }) : Promise.resolve({ data: [] as LienSignerUser[], error: null }),
      ])
      if (!live) return
      const seen = new Set(people.data.map((u) => u.id))
      setUsers([...people.data, ...devs.data.filter((u) => !seen.has(u.id))])
    })()
    return () => {
      live = false
    }
  }, [allowed, role])
  const signerNameFor = useCallback((masterUserId: string | null) => lienSignerNameFor(users, masterUserId, authName), [users, authName])
  const leaderNameFor = useCallback((masterUserId: string | null) => (masterUserId ? users.find((u) => u.id === masterUserId)?.name?.trim() ?? '' : ''), [users])
  const signerPhoneFor = useCallback((masterUserId: string | null) => lienSignerPhoneFor(users, masterUserId, issuer?.phone ?? ''), [users, issuer?.phone])

  // The By date rows (v2.4101): the billed jobs with their runways, through the Pipeline's kernel. The pen on the grid
  // (v2.4153) re-reads what it wrote: a promise the pay dates, a kind or a last day the clocks.
  const [clocksRefresh, setClocksRefresh] = useState(0)
  const { rows: calendarRows, reloadPromises } = useLienCalendarRows(jobs, { role, billedLoaded: mergedScopes.has(billedScope), todayYmd, refreshKey: clocksRefresh })

  // Counsel's sign-off on a sent notice (#41 PR 3): the job's state on the firm's matter, and the ask.
  const legalMatters = useLegalMatters(allowed)
  const legalSignoff = useMemo(
    () =>
      legalMatters.available
        ? {
            stateFor: (jobId: string) => {
              const m = legalMatters.byJobId.get(jobId)
              if (!m || !matterIsWithFirm(m)) return null
              return signoffStateForJob(legalMatters.entriesByMatter.get(m.id) ?? [], jobId)
            },
            ask: async (jobId: string, text: string) => {
              const m = legalMatters.byJobId.get(jobId)
              if (!m || !matterIsWithFirm(m)) return 'This job is not with the firm — mark its account attorney-ready on the Legal desk first.'
              const job = jobs.find((j) => j.id === jobId)
              const jobLabel = job ? effectiveJobLedgerNumber(job.hcp_number, job.click_number) || '' : ''
              const err = await legalRpc('legal_add_entry', { p_matter_id: m.id, p_kind: 'question', p_body: text, p_meta: newAskMeta({ flavor: 'signoff', jobId, jobLabel, askedBy: authName }) })
              if (!err) void legalMatters.reload()
              return err
            },
          }
        : null,
    [legalMatters, jobs, authName],
  )

  // The address is the truth: the desk opens on what it names and tells the page every change, which it writes with
  // `replace`, so Back is one press to wherever you came from. The entry's state rides along: on a phone it says the
  // notice was opened from the list.
  const address = useMemo(() => lienDeskFromSearch(searchParams), [searchParams])
  const here = `${location.pathname}${location.search}`
  const onAddressChange = useCallback(
    (next: { kind: LienDeskKind; job: string | null; pile: LienDeskPile | null }) => {
      const href = lienDeskHref(next)
      // A job's own screen belongs to the first view (punch list #352, PR 4): another view drops the open row from the entry.
      if (href !== here) navigate(href, { replace: true, state: lienDeskStateForView(location.state, next.kind) })
    },
    [here, navigate, location.state],
  )

  // A phone: a row's job opens as its own screen, as a history entry of its own at the same address, so the phone's Back
  // closes it and the list is where it was (punch list #352, PR 4).
  const openRowKey = lienDeskRowFromState(location.state)
  const onOpenRow = useCallback((rowKey: string) => navigate(here, { state: lienDeskStateWithRow(location.state, rowKey) }), [here, navigate, location.state])
  const onCloseRow = useCallback(() => navigate(-1), [navigate])

  // A phone (punch list #182, PR 3): the Notices list, then one notice at a time. Opening a notice is a new entry, so Back
  // and ← Notices return to the list; a notice reached by a link goes to the list in its own place.
  const openedFromList = Boolean((location.state as { fromList?: boolean } | null)?.fromList)
  const onOpenNotice = useCallback((jobId: string, pile: LienDeskPile | null) => navigate(lienDeskHref({ kind: 'notice', job: jobId, pile }), { state: { fromList: true } }), [navigate])
  const onShowList = useCallback(() => {
    if (openedFromList) navigate(-1)
    else navigate(lienDeskHref({ kind: 'notice', pile: address.pile }), { replace: true })
  }, [openedFromList, navigate, address.pile])

  // Records for an owner (v2.4544): a window over the desk. `?records=` is a door the page consumes once (the Dashboard's
  // "signed for the records" line, punch list #86), as the Pipeline consumed `?ownerrecords=`.
  const [ownerRecords, setOwnerRecords] = useState<{ jobId: string | null } | null>(null)
  const recordsDoor = address.records
  useEffect(() => {
    if (!recordsDoor) return
    setOwnerRecords(recordsDoor)
    navigate(lienDeskHref({ kind: address.kind, job: address.job, pile: address.pile }), { replace: true, state: location.state })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recordsDoor])
  const ownerRecordsDesk = useMemo(() => ownerRecordsFromDesk(ownerRecords ? data : null), [ownerRecords, data])

  // A way back: the page behind when there is one, else the Pipeline, as `/accounts-receivable` does.
  const canGoBack = hasInAppHistory(typeof window !== 'undefined' ? window.history.state : null, location.key)
  const goBack = useCallback(() => {
    if (canGoBack) navigate(-1)
    else navigate(PIPELINE_HREF)
  }, [canGoBack, navigate])

  // The page is the whole screen under the app's top chrome, so the desk's lists and panes scroll inside it and the
  // document never scrolls. The top edge is read again whenever something above it changes (punch list #352, PR 0: a
  // banner that closed left a grey band its height above the phone dock). `--app-bottom-chrome` is the phone dock
  // when a mode shows one.
  const rootRef = useRef<HTMLDivElement | null>(null)
  const top = useTopEdge(rootRef)

  // The doors back. Edit job and the job window open over the page through their app-wide contexts; the desk re-reads
  // after a save and again when the window closes.
  const openEditJob = useCallback(
    (jobId: string, focus?: Parameters<typeof lienFocusEditJobOptions>[0]) => jobFormModal?.openEditJob(jobId, { onSaved: refetch, ...lienFocusEditJobOptions(focus) }),
    [jobFormModal, refetch],
  )
  const openJob = useCallback((jobId: string) => jobDetail?.openJobDetail({ jobId, onEditJobSaved: refetch, onClosed: refetch }), [jobDetail, refetch])

  // A job's Lien window (v2.4523): over the desk, which stays where it was when the window closes. The board may not hold
  // the job (a book row, a job on another customer's filter): read it rather than turn the office away (v2.3781).
  const [lienWindow, setLienWindow] = useState<LienWindow | null>(null)
  const withJob = useCallback(
    (jobId: string, open: (job: JobWithDetails) => void) => {
      const loaded = jobs.find((j) => j.id === jobId)
      if (loaded) {
        open(loaded)
        return
      }
      void fetchJobWithDetailsById(jobId).then((job) => {
        if (job) open(job)
        else showToast('That job could not be loaded. Open it from the Pipeline board.', 'error')
      })
    },
    [jobs, showToast],
  )

  // Put a GC on notice (v2.3470): every owner on every job with a failing GC, one approved run.
  const [gcNotice, setGcNotice] = useState<{ gcId: string } | null>(null)
  const [gcNoticeRereadKey, setGcNoticeRereadKey] = useState(0)
  const refetchAll = useCallback(() => {
    refetch()
    setGcNoticeRereadKey((k) => k + 1)
  }, [refetch])

  if (authLoading) return <div style={{ padding: '2rem', textAlign: 'center' }}>Loading…</div>
  if (!user) return <Navigate to="/sign-in" replace />
  // The role lands after the user on a cold load; bounce only a role that is known and outside the office set.
  if (role == null) return <div style={{ padding: '2rem', textAlign: 'center' }}>Loading…</div>
  if (!isStagesOfficeRole(role)) return <Navigate to="/dashboard" replace />

  const backDoor = (
    <button type="button" onClick={goBack} data-lien-desk-back aria-label={canGoBack ? 'Back' : 'Back to the Pipeline'} style={isMobile ? { ...BACK_DOOR, height: 44 } : BACK_DOOR}>
      <span aria-hidden="true">←</span> {canGoBack ? 'Back' : 'Pipeline'}
    </button>
  )

  return (
    <div ref={rootRef} data-lien-desk-page-root style={{ height: `calc(100dvh - ${top}px - var(--app-bottom-chrome, 0px) - ${PAGE_BOTTOM_GAP_PX}px)`, minHeight: 360, display: 'grid', gridTemplateRows: 'minmax(0, 1fr)' }}>
      <LienDesk
        layout={isMobile ? 'stacked' : 'columns'}
        onOpenNotice={onOpenNotice}
        onShowList={onShowList}
        backDoor={backDoor}
        onAddressChange={onAddressChange}
        openRowKey={openRowKey}
        onOpenRow={onOpenRow}
        onCloseRow={onCloseRow}
        data={data}
        loading={loading}
        todayYmd={todayYmd}
        authRole={role}
        authUserId={user.id}
        authName={authName}
        workMonths={workMonths}
        issuer={issuer}
        signerNameFor={signerNameFor}
        leaderNameFor={leaderNameFor}
        signerPhoneFor={signerPhoneFor}
        initialJobId={address.job}
        initialKind={address.kind ?? LIEN_DESK_DEFAULT_KIND}
        initialPile={address.pile}
        calendarRows={calendarRows}
        onCalendarChanged={(what) => {
          // The pen (v2.4153): a promise re-reads the pay dates; a kind or a last day re-reads the clocks; the desk's own queue follows either.
          if (what === 'promise') reloadPromises()
          else setClocksRefresh((k) => k + 1)
          refetch()
        }}
        onOpenCalendarLastWork={(jobId) => withJob(jobId, (job) => setLienWindow({ job, openLastWork: true }))}
        onOpenCalendarJob={(jobId) => withJob(jobId, (job) => setLienWindow({ job }))}
        onOpenOwnerRecords={() => setOwnerRecords({ jobId: null })}
        onOpenJob={openJob}
        onOpenLegalDesk={() => navigate(LEGAL_DESK_PATH)}
        legalSignoff={legalSignoff}
        onOpenLienAffidavit={(jobId) => withJob(jobId, (job) => setLienWindow({ job, initialTab: 'affidavit' }))}
        onChanged={refetch}
        onOpenEditJob={openEditJob}
        onOpenCompanySettings={(field) => navigate(`/settings?tab=settings-jobs&focus=issuer.${field}`)}
        // Punch list #305: an affidavit that holds for the GC's address opens the GC's own record; a save re-reads the desk.
        onOpenCustomerRecord={editCustomerModal ? (customerId) => editCustomerModal.openEditCustomerModal(customerId, { onSaved: refetchAll }) : undefined}
        onOpenLienInstruments={(jobId) => {
          const months = data?.queue.entries.find((e) => e.jobId === jobId)?.item?.months ?? []
          withJob(jobId, (job) => setLienWindow({ job, initialTab: 'notice', noticeMonths: months }))
        }}
        onPutGcOnNotice={(gcId) => setGcNotice({ gcId })}
      />
      <LienInstrumentsModal
        open={lienWindow != null}
        onClose={() => setLienWindow(null)}
        job={lienWindow?.job ?? null}
        invoice={null}
        initialTab={lienWindow?.initialTab}
        noticeMonths={lienWindow?.noticeMonths ?? null}
        // v2.7077: the window's header names the step the desk's row names.
        deskNotice={lienWindowDeskNotice(lienWindow ? data?.queue.entries.find((e) => e.jobId === lienWindow.job.id) : null)}
        // v2.7187, punch list #335, row 2: and the step an affidavit is on.
        deskAffidavit={lienWindowDeskAffidavit(lienWindow ? data?.affidavits.entries.find((e) => e.jobId === lienWindow.job.id) : null)}
        openLastWork={lienWindow?.openLastWork ?? false}
        // v2.4735: a day set here moves the By date row, so the clocks and the desk re-read.
        onLastWorkSaved={() => {
          setClocksRefresh((k) => k + 1)
          refetch()
        }}
        signerNameFallback={signerNameFor(lienWindow?.job.master_user_id ?? null)}
        authEmail={user.email?.trim() ?? ''}
        // The next step's door (punch list #82): the window closes and the desk opens on the job, through the address.
        onOpenLienDesk={(jobId, deskKind) => {
          setLienWindow(null)
          navigate(lienDeskHref({ kind: deskKind, job: deskKind === 'notice' ? jobId : null }), { replace: true, state: location.state })
        }}
        onRecorded={() => {
          // A recorded notice that names the desk item's months sends the item (v2.3405).
          const jobId = lienWindow?.job.id
          if (jobId) void syncLienDeskAfterRecord(jobId).finally(refetch)
        }}
      />
      {/* An owner asked for our records (v2.4544): over the desk, which stays open behind it. */}
      <LienOwnerRecordsModal
        open={ownerRecords != null}
        properties={ownerRecordsDesk.properties}
        seedFor={ownerRecordsDesk.seedFor}
        claimsByJob={ownerRecordsDesk.claimsByJob}
        company={issuer?.companyName ?? ''}
        todayYmd={todayYmd}
        authName={authName}
        isLeader={isLienLeader(role)}
        isMobile={isMobile}
        initialJobId={ownerRecords?.jobId ?? null}
        onClose={() => setOwnerRecords(null)}
      />
      <GcOnNoticeModal
        open={gcNotice != null}
        gcId={gcNotice?.gcId ?? null}
        onClose={() => setGcNotice(null)}
        todayYmd={todayYmd}
        authRole={role}
        authUserId={user.id}
        authName={authName}
        issuer={issuer}
        signerNameFor={signerNameFor}
        signerPhoneFor={signerPhoneFor}
        onOpenEditJob={(jobId, focus) => jobFormModal?.openEditJob(jobId, { onSaved: refetchAll, ...lienFocusEditJobOptions(focus) })}
        onOpenJob={(jobId) => jobDetail?.openJobDetail({ jobId, onEditJobSaved: refetchAll })}
        onChanged={refetch}
        rereadKey={gcNoticeRereadKey}
      />
      {/* Bill Customer (v2.4969) opens over the desk through its own provider, and the run (v2.3410) is the desk's own window: nothing more mounts here. */}
    </div>
  )
}
