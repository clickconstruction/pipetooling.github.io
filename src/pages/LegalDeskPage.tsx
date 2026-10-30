/**
 * The Legal desk as a page (punch list #182, PR 1): `/legal-desk`, with the account, the tab and
 * the view in the address (`lib/legal/legalDeskRoute.ts`), so a reload keeps your place, Back
 * returns to the Pipeline, and the address bar is the link to paste. Until this PR the desk was a
 * window over the Pipeline, opened by a one-shot `?legal=` link the board stripped on arrival;
 * `Jobs.tsx` sends every such link here.
 *
 * The page reads for itself what the board used to hand the window: the Collections and given-up
 * jobs from the app-wide jobs cache (every one of them, as a money surface should read, never the
 * board's filtered rows), the contract coverage, the users and the legal matters. The doors back:
 * the job form and the job window through their app-wide contexts, the Pipeline at the job's row,
 * Accounts Receivable, call mode and a job's Lien window by the addresses the board already
 * answers, and the three windows the desk opens over itself, mounted here as `/accounts-receivable`
 * mounts its own. The gate is the collections roles (`canManageCollections`), as the window's
 * doors were; anyone else lands on the Dashboard once their role is known.
 */
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { Navigate, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useIsMobile } from '../hooks/useIsMobile'
import { buildJobsListCacheKey, useJobsListCache } from '../contexts/JobsListCacheContext'
import { useJobFormModal } from '../contexts/JobFormModalContext'
import { useJobDetailModal } from '../contexts/JobDetailModalContext'
import { useJobContractCoverage } from '../hooks/useStagesRowFlags'
import { useLegalMatters } from '../hooks/useLegalMatters'
import { buildJobsStagesBoardLists } from '../lib/jobsStagesBoard'
import { canManageCollections, isStagesOfficeRole } from '../lib/jobs/stagesRoleGates'
import { fetchActiveUsers } from '../lib/people/fetchActiveUsers'
import { hasInAppHistory } from '../lib/inAppHistory'
import { LEGAL_DESK_PATH, legalDeskFromSearch, legalDeskHref, PIPELINE_HREF, pipelineJobHref } from '../lib/legal/legalDeskRoute'
import { lienWindowHref } from '../lib/jobs/stagesDeepLinks'
import { PORTAL_COMPANY } from '../../supabase/functions/_shared/portalCompany'
import LegalDesk from '../components/jobs/legal/LegalDesk'
import JobContractModal from '../components/jobs/JobContractModal'
import SessionNotesModal from '../components/jobs/SessionNotesModal'
import SetPromisedPayDateModal from '../components/jobs/SetPromisedPayDateModal'
import type { JobWithDetails } from '../types/jobWithDetails'
import type { DeskView, Tab } from '../components/jobs/legal/legalDeskShared'
import type { LegalPayerKey } from '../lib/legal/legalPacket'

type DeskUser = { id: string; name: string | null }

/** The same people the Jobs page shows the desk: the office and the field, and a dev's fellow devs. */
const DESK_USER_ROLES = ['assistant', 'controller', 'master_technician', 'subcontractor', 'helpers', 'estimator', 'primary', 'superintendent']

const BACK_DOOR: CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 6, height: 30, padding: '0 10px', borderWidth: 1, borderStyle: 'solid', borderColor: 'var(--border-strong)', borderRadius: 8, background: 'var(--surface)', color: 'var(--text-700)', font: 'inherit', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap', flex: 'none' }

/** The room under the page's top edge, so the desk's rail and account scroll inside the screen and the page itself never does. */
const PAGE_BOTTOM_GAP_PX = 8

export default function LegalDeskPage() {
  const { user, role, loading: authLoading } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const jobFormModal = useJobFormModal()
  const jobDetail = useJobDetailModal()
  const allowed = Boolean(user?.id) && canManageCollections(role)
  const { jobs, jobsListLoading, jobsListDataKey, fetchScopeIfNeeded, runFetchScopes, mergedScopes, refreshMergedScopes } = useJobsListCache()

  // The Collections rows are billed-status jobs the board loads lazily (`billed_all`). On a cold open, or when the
  // cache holds another customer filter's board, the page takes the Pipeline's own scoped first load for that one
  // scope (a scope fetch alone is a no-op until a board snapshot exists); on a warm cache it asks for the scope the
  // way the Pipeline's doors did. Either way the desk's rows and nothing else.
  const userId = user?.id ?? null
  const cacheWarm = userId != null && jobsListDataKey === buildJobsListCacheKey(userId, null)
  useEffect(() => {
    if (!allowed) return
    if (cacheWarm) void fetchScopeIfNeeded('billed_all', null)
    else void runFetchScopes(['billed_all'], null)
  }, [allowed, cacheWarm, fetchScopeIfNeeded, runFetchScopes])
  const jobsLoading = jobsListLoading || !mergedScopes.has('billed_all')
  const lists = useMemo(() => buildJobsStagesBoardLists(jobs, ''), [jobs])
  const canSeeJobContracts = isStagesOfficeRole(role)
  const { jobContractCoverageByJobId, loadJobContractCoverage } = useJobContractCoverage(jobs, canSeeJobContracts)
  const legal = useLegalMatters(allowed)

  const [users, setUsers] = useState<DeskUser[]>([])
  useEffect(() => {
    if (!allowed) return
    let live = true
    void (async () => {
      const [people, devs] = await Promise.all([
        fetchActiveUsers<DeskUser>('id, name', { roles: DESK_USER_ROLES }),
        role === 'dev' ? fetchActiveUsers<DeskUser>('id, name', { roles: [], includeDev: true }) : Promise.resolve({ data: [] as DeskUser[], error: null }),
      ])
      if (!live) return
      const seen = new Set(people.data.map((u) => u.id))
      setUsers([...people.data, ...devs.data.filter((u) => !seen.has(u.id))])
    })()
    return () => {
      live = false
    }
  }, [allowed, role])

  // The address is the truth: the desk opens on what it names and tells the page every change, which it writes with
  // `replace`, so Back is one press to wherever you came from.
  const address = useMemo(() => legalDeskFromSearch(searchParams), [searchParams])
  const here = `${location.pathname}${location.search}`
  const onAddressChange = useCallback(
    (next: { account: LegalPayerKey | null; tab: Tab; view: DeskView; doc: string | null }) => {
      // No account open (a phone's list, v2.5984) has no tab to name: the address is the list and its view.
      const href = legalDeskHref(next.account ? next : { view: next.view })
      // The entry's state rides along: on a phone it says the account was opened from the list.
      if (href !== here) navigate(href, { replace: true, state: location.state })
    },
    [here, navigate, location.state],
  )

  // A phone (punch list #182, PR 3): the list, then one account at a time. Opening an account is a new entry, so Back
  // and ← Accounts return to the list; an account reached by a link goes to the list in its own place.
  const isPhone = useIsMobile()
  const openedFromList = Boolean((location.state as { fromList?: boolean } | null)?.fromList)
  const onOpenAccount = useCallback((key: LegalPayerKey) => navigate(legalDeskHref({ account: key }), { state: { fromList: true } }), [navigate])
  const onShowList = useCallback(() => {
    if (openedFromList) navigate(-1)
    else navigate(LEGAL_DESK_PATH, { replace: true })
  }, [openedFromList, navigate])

  // A way back: the page behind when there is one, else the Pipeline, as `/accounts-receivable` does.
  const canGoBack = hasInAppHistory(typeof window !== 'undefined' ? window.history.state : null, location.key)
  const goBack = useCallback(() => {
    if (canGoBack) navigate(-1)
    else navigate(PIPELINE_HREF)
  }, [canGoBack, navigate])

  // The page is the whole screen under the app's top chrome: measured once drawn, so the desk's two columns scroll
  // inside it and the document never scrolls. `--app-bottom-chrome` is the phone dock when a mode shows one.
  const rootRef = useRef<HTMLDivElement | null>(null)
  const [top, setTop] = useState(0)
  useLayoutEffect(() => {
    const measure = () => {
      const el = rootRef.current
      if (el) setTop(Math.max(0, Math.round(el.getBoundingClientRect().top)))
    }
    measure()
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [])

  const refreshRows = useCallback(() => void refreshMergedScopes(null), [refreshMergedScopes])
  const openEditJob = useCallback((jobId: string) => jobFormModal?.openEditJob(jobId, { onSaved: refreshRows }), [jobFormModal, refreshRows])
  /** Reports and the thread both live on the job window's Job tab; it opens over the page as it opens over every page. */
  const openJobWindow = useCallback((jobId: string) => jobDetail?.openJobDetail({ jobId, onClosed: refreshRows }), [jobDetail, refreshRows])

  const [contractJob, setContractJob] = useState<JobWithDetails | null>(null)
  const [sessionNotesJob, setSessionNotesJob] = useState<JobWithDetails | null>(null)
  const [promisedPay, setPromisedPay] = useState<{ jobId: string; jobLabel: string; initialYmd: string | null } | null>(null)

  if (authLoading) return <div style={{ padding: '2rem', textAlign: 'center' }}>Loading…</div>
  if (!user) return <Navigate to="/sign-in" replace />
  // The role lands after the user on a cold load; bounce only a role that is known and outside the collections set.
  if (role == null) return <div style={{ padding: '2rem', textAlign: 'center' }}>Loading…</div>
  if (!canManageCollections(role)) return <Navigate to="/dashboard" replace />

  const backDoor = (
    <button type="button" onClick={goBack} data-legal-desk-back aria-label={canGoBack ? 'Back' : 'Back to the Pipeline'} style={BACK_DOOR}>
      <span aria-hidden="true">←</span> {canGoBack ? 'Back' : 'Pipeline'}
    </button>
  )

  return (
    <div ref={rootRef} data-legal-desk-page-root style={{ height: `calc(100dvh - ${top}px - var(--app-bottom-chrome, 0px) - ${PAGE_BOTTOM_GAP_PX}px)`, minHeight: 360, display: 'grid', gridTemplateRows: 'minmax(0, 1fr)' }}>
      <LegalDesk
        layout={isPhone ? 'stacked' : 'columns'}
        onOpenAccount={onOpenAccount}
        onShowList={onShowList}
        backDoor={backDoor}
        collectionsJobs={lists.collectionsJobs}
        uncollectibleJobs={lists.uncollectibleJobs}
        jobsLoading={jobsLoading}
        contractCoverage={jobContractCoverageByJobId}
        users={users}
        companyName={PORTAL_COMPANY.name}
        initialPayerKey={address.account}
        initialTab={address.tab}
        initialDoc={address.doc}
        initialView={address.view}
        onAddressChange={onAddressChange}
        legal={legal}
        canMarkReady={role === 'dev'}
        canEditReview={isStagesOfficeRole(role)}
        canEditFirm={role === 'dev'}
        onOpenContract={(job) => {
          if (canSeeJobContracts) setContractJob(job)
        }}
        onOpenLienInstruments={(job, door) =>
          // v2.6104: the Paper tab's next-step door opens the Lien desk on the job (a notice) or the Lien window on its tab; every other press, the window as before.
          navigate(door?.to === 'desk' ? `${PIPELINE_HREF}&liendesk=1&liendeskJob=${encodeURIComponent(job.id)}&kind=notice` : door?.to === 'window' ? lienWindowHref(job.id, door.tab) : `${PIPELINE_HREF}&lienwindow=${encodeURIComponent(job.id)}`)
        }
        onOpenEditJob={openEditJob}
        onOpenCallMode={() => navigate(`${PIPELINE_HREF}&chase=1`)}
        onOpenAccountsReceivable={() => navigate('/accounts-receivable')}
        onOpenSessionNotes={setSessionNotesJob}
        onOpenReports={(job) => openJobWindow(job.id)}
        onOpenJobThread={openJobWindow}
        onOpenPromisedPay={setPromisedPay}
        onFocusJob={(jobId) => navigate(pipelineJobHref(jobId))}
        onAfterWriteDown={refreshRows}
      />
      <JobContractModal
        open={contractJob != null}
        onClose={() => setContractJob(null)}
        job={contractJob}
        onChanged={() => void loadJobContractCoverage()}
        onJobChanged={refreshRows}
        onEditJob={(j) => openEditJob(j.id)}
        coverage={contractJob ? jobContractCoverageByJobId.get(contractJob.id) ?? null : null}
      />
      {sessionNotesJob ? (
        <SessionNotesModal initialJob={sessionNotesJob} users={users} jobs={jobs} onOpenJobOnBoard={(jobId) => navigate(pipelineJobHref(jobId))} onClose={() => setSessionNotesJob(null)} />
      ) : null}
      {promisedPay ? (
        <SetPromisedPayDateModal
          jobId={promisedPay.jobId}
          jobLabel={promisedPay.jobLabel}
          initialYmd={promisedPay.initialYmd}
          onClose={() => setPromisedPay(null)}
          onSaved={() => {
            setPromisedPay(null)
            refreshRows()
          }}
        />
      ) : null}
    </div>
  )
}
