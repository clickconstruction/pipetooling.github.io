import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useToastContext } from '../../contexts/ToastContext'
import { isAssistantLike } from '../../lib/subcontractorLikeRole'
import { withSupabaseRetry } from '../../utils/errorHandling'
import { TALLY_STALE_MIN_AGE_DAYS } from '../../lib/tallyStaleMinAgeDays'
import {
  canRoleSeeArBankUnallocatedDashboardBanner,
  useArBankUnallocatedCount,
} from '../../hooks/useArBankUnallocatedCount'
import { useStaleTallyStaffFollowUp } from '../../hooks/useStaleTallyStaffFollowUp'
import { useJobFollowupNudge } from '../../hooks/useJobFollowupNudge'
import { useTeamReviewsDue } from '../../hooks/useTeamReviewsDue'
import { useRoadmapNeedsNameNudges } from '../../hooks/useRoadmapNeedsNameNudges'
import { recordNavClickFromEvent } from '../../lib/navClickTelemetry'
import { buildNeedsYouItems } from '../../lib/dashboardNeedsYou'
import { DashboardNeedsYouCard } from './DashboardNeedsYouCard'
import { GcReviewWeekDoneNotice } from '../DashboardGcReviewWeeklyBanner'
import { useGcReviewWeekNudge } from '../../hooks/useGcReviewWeekNudge'
import { gcReviewNudgeState, gcReviewWeekdayIndex } from '../../lib/jobs/gcReviewCertification'
import { buildLostBidNudge, type LostBidNudge } from '../../lib/dashboardLostBidNudge'
import { useBulkDeleteNudge } from '../../hooks/useBulkDeleteNudge'
import { useBidAuditsPendingCount } from '../../hooks/useBidAuditsPendingCount'
import { useLienReleasesOwedNudge } from '../../hooks/useLienReleasesOwedNudge'
import { CLAIM_DEV_LOOKBACK_DAYS, useClaimDevAttemptsNudge } from '../../hooks/useClaimDevAttemptsNudge'
import { DashboardStaleTallyStaffFollowUpModal } from '../DashboardStaleTallyStaffFollowUpModal'
import NewReportModal from '../NewReportModal'
import type { PinnedItem } from '../../lib/pinnedTabs'
import type { UserRole } from '../../hooks/useAuth'
import {
  filterPinsToShow,
  getPinnedChipDisplay,
  getTallyLinkAccessibleName,
} from '../../lib/dashboardPinnedRow'

export interface DashboardPinnedQuickRowProps {
  authUserId: string | undefined
  role: UserRole | null
  /**
   * Role-filtered pins. The parent owns `pinnedRoutes` + the `filterPinnedByRole`
   * call because the `has*Pin` flags derived from these also enable the
   * parent-side financial pin total hooks and the `dashboard-financial-pins`
   * realtime channel.
   */
  visiblePins: PinnedItem[]
  /** Quick-button defs stay parent-side (their visibility map also gates the Upcoming-inspection section, and the top placement renders outside this block). */
  quickActionDefs: Array<{ key: string; label: string; to: string }>
  quickButtonsPlacement: 'top' | 'with_pins'
  showDashboardQuickButtons: boolean
  /** Financial pin totals from the parent-side hooks (keyed on financialRefreshKey there). */
  costMatrixTotal: number | null
  billedCount: number | null
  billedTotal: number | null
  supplyHousesAPTotal: number | null
  subLaborDueTotal: number | null
  /**
   * The tail modals (NewReportModal + staff tally follow-up) historically render
   * only in the main return — the Job Mode early return never mounted them, so
   * their openers are inert there. Pass false at the Job Mode mount to preserve
   * that behavior exactly.
   */
  renderModals: boolean
  /**
   * When true (main dashboard), render the Job Report row ABOVE the notification
   * banners so it sits directly under Clock In. Job Mode leaves it false so the
   * banners keep their original top position.
   */
  jobReportFirst?: boolean
  /**
   * Clock button stack (ClockInOutButton, embedded) rendered in the middle of
   * the action row (v2.1461): [tally square] [clock stack] [Job Report square].
   * The Job Report square stretches to the stack's height — one row tall when
   * clocked out, both rows when clocked in. Absent (Job Mode mount): the
   * classic [tally][wide Job Report] row renders instead.
   */
  clockSlot?: ReactNode
  /** Slot rendered directly BELOW the Job Report row (main dashboard: the My Schedule card). */
  afterJobReportRow?: ReactNode
  /**
   * Slot rendered between the notification banners and the pins/quick-action row
   * (the main dashboard passes the finance section here). Omitted in Job Mode.
   */
  interstitial?: ReactNode
  /**
   * Dispatch Mode Inbox: render ONLY the notification banners (skip the Job
   * Report row, pins/quick actions, and slots). Modals still follow renderModals
   * so banner tap-throughs (e.g. staff tally follow-up) keep working.
   */
  bannersOnly?: boolean
  /**
   * Job Mode Dashboard: skip the notification banners (they render in the Job
   * Mode Inbox tab instead, via bannersOnly) but keep the Job Report row,
   * pins/quick actions, and slots.
   */
  hideBanners?: boolean
}


/**
 * The tally (Job Parts Tally) square flanking the clock stack. Same
 * stretch-and-measure behavior as JobReportSquareButton (v2.1461/v2.1462):
 * icon-only 48px square clocked out; grows with the clocked-in stack and
 * gains the "My / Spend" label when tall. Badge = unlinked transaction count.
 */
function TallySquareLink({ accessibleName, unlinkedCount }: { accessibleName: string; unlinkedCount?: number | null }) {
  const ref = useRef<HTMLDivElement>(null)
  const [tall, setTall] = useState(false)

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const measure = () => setTall(el.getBoundingClientRect().height >= 70)
    measure()
    if (typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  return (
    <div ref={ref} style={{ position: 'relative', width: 48, minHeight: 48, alignSelf: 'stretch', flexShrink: 0 }}>
      <Link
        to="/tally"
        title={accessibleName}
        aria-label={accessibleName}
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: tall ? 6 : 0,
          width: 48,
          height: '100%',
          minHeight: 48,
          background: '#3b82f6',
          color: 'white',
          borderRadius: 8,
          textDecoration: 'none',
          boxSizing: 'border-box',
        }}
      >
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" width={tall ? 24 : 28} height={tall ? 24 : 28} fill="currentColor" style={{ display: 'block' }} aria-hidden>
          <path d="M541.4 162.6C549 155 561.7 156.9 565.5 166.9C572.3 184.6 576 203.9 576 224C576 312.4 504.4 384 416 384C398.5 384 381.6 381.2 365.8 376L178.9 562.9C150.8 591 105.2 591 77.1 562.9C49 534.8 49 489.2 77.1 461.1L264 274.2C258.8 258.4 256 241.6 256 224C256 135.6 327.6 64 416 64C436.1 64 455.4 67.7 473.1 74.5C483.1 78.3 484.9 91 477.4 98.6L388.7 187.3C385.7 190.3 384 194.4 384 198.6L384 240C384 248.8 391.2 256 400 256L441.4 256C445.6 256 449.7 254.3 452.7 251.3L541.4 162.6z" />
        </svg>
        {tall ? (
          <span style={{ fontSize: '0.6875rem', fontWeight: 600, lineHeight: 1.2, textAlign: 'center' }}>
            My
            <br />
            Spend
          </span>
        ) : null}
      </Link>
      {typeof unlinkedCount === 'number' && unlinkedCount > 0 ? (
        <span
          aria-hidden
          style={{
            position: 'absolute',
            top: -4,
            right: -4,
            minWidth: 18,
            padding: '0 5px',
            height: 18,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: 9999,
            background: '#f59e0b',
            color: '#1c1917',
            fontSize: 10,
            fontWeight: 700,
            fontVariantNumeric: 'tabular-nums',
            lineHeight: 1,
            boxSizing: 'border-box',
            pointerEvents: 'none',
          }}
        >
          {unlinkedCount > 99 ? '99+' : unlinkedCount}
        </span>
      ) : null}
    </div>
  )
}

/**
 * The compact Job Report square flanking the clock stack (v2.1461). Stretches
 * to the stack's height; the label is height-aware (same measure pattern as
 * JobAddressText): one line ("Job Report") in the 48px clocked-out square,
 * two lines ("Job" / "Report") once the button grows tall alongside the
 * clocked-in Clock Out + Update Focus stack.
 */
function JobReportSquareButton({ onClick }: { onClick: () => void }) {
  const ref = useRef<HTMLButtonElement>(null)
  const [tall, setTall] = useState(false)

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const measure = () => setTall(el.getBoundingClientRect().height >= 70)
    measure()
    if (typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  return (
    <button
      ref={ref}
      type="button"
      onClick={onClick}
      title="Job Report"
      aria-label="Job Report"
      style={{
        flexShrink: 0,
        width: 64,
        alignSelf: 'stretch',
        minHeight: 48,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: tall ? 6 : 4,
        padding: '0.35rem 0.25rem',
        background: '#3b82f6',
        color: 'white',
        borderRadius: 8,
        border: 'none',
        boxSizing: 'border-box',
        cursor: 'pointer',
      }}
    >
      {tall ? (
        <>
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" width={26} height={26} fill="currentColor" aria-hidden>
            <path d="M128 128C128 92.7 156.7 64 192 64L341.5 64C358.5 64 374.8 70.7 386.8 82.7L493.3 189.3C505.3 201.3 512 217.6 512 234.6L512 512C512 547.3 483.3 576 448 576L192 576C156.7 576 128 547.3 128 512L128 128zM336 122.5L336 216C336 229.3 346.7 240 360 240L453.5 240L336 122.5zM248 320C234.7 320 224 330.7 224 344C224 357.3 234.7 368 248 368L392 368C405.3 368 416 357.3 416 344C416 330.7 405.3 320 392 320L248 320zM248 416C234.7 416 224 426.7 224 440C224 453.3 234.7 464 248 464L392 464C405.3 464 416 453.3 416 440C416 426.7 405.3 416 392 416L248 416z" />
          </svg>
          <span style={{ fontSize: '0.8125rem', fontWeight: 600, lineHeight: 1.2, textAlign: 'center' }}>
            Job
            <br />
            Report
          </span>
        </>
      ) : (
        // Compact state is text-only (v2.1463), stacked like the tall label —
        // "Job" / "Report" on two lines fills the 48px square better.
        <span style={{ fontSize: '0.8125rem', fontWeight: 600, lineHeight: 1.25, textAlign: 'center' }}>
          Job
          <br />
          Report
        </span>
      )}
    </button>
  )
}

/**
 * Dashboard banners + tally icon + Job Report button + quick actions + pins row
 * (the old `tallyAndPinnedBlock`), rendered at two positions: the Job Mode
 * early return and the main return. Extracted from Dashboard.tsx (v2.723) —
 * see docs/DASHBOARD_SECTIONS_ARCHITECTURE.md §3.
 */
export function DashboardPinnedQuickRow({
  authUserId,
  role,
  visiblePins,
  quickActionDefs,
  quickButtonsPlacement,
  showDashboardQuickButtons,
  costMatrixTotal,
  billedCount,
  billedTotal,
  supplyHousesAPTotal,
  subLaborDueTotal,
  renderModals,
  jobReportFirst = false,
  clockSlot,
  afterJobReportRow,
  interstitial,
  bannersOnly = false,
  hideBanners = false,
}: DashboardPinnedQuickRowProps) {
  const navigate = useNavigate()
  const { showToast } = useToastContext()

  const [newReportModalOpen, setNewReportModalOpen] = useState(false)
  const [tallyUnlinkedCount, setTallyUnlinkedCount] = useState<number | null>(null)
  const [tallyStaleUnlinkedCount, setTallyStaleUnlinkedCount] = useState<number | null>(null)
  const [tallyStaffFollowUpModalOpen, setTallyStaffFollowUpModalOpen] = useState(false)
  const [lostBidNudge, setLostBidNudge] = useState<LostBidNudge | null>(null)
  const [lostBidNudgeLoading, setLostBidNudgeLoading] = useState(true)
  const {
    peopleCount: tallyStaffStalePeopleCount,
    transactionCount: tallyStaffStaleTxCount,
    refetch: refetchStaleTallyStaffFollowUp,
  } = useStaleTallyStaffFollowUp(TALLY_STALE_MIN_AGE_DAYS)

  const arBankCountEnabled = Boolean(authUserId) && canRoleSeeArBankUnallocatedDashboardBanner(role)
  const { count: arBankUnallocatedCount } = useArBankUnallocatedCount({
    enabled: arBankCountEnabled,
    authUserId,
    authRole: role,
  })

  const officeEligible = role === 'dev' || role === 'master_technician' || isAssistantLike(role)
  const { count: jobFollowupCount, stageCounts: jobFollowupStageCounts } = useJobFollowupNudge(
    !hideBanners && officeEligible,
  )
  const { overdue: teamReviewsOverdue, cadenceDays: teamReviewCadenceDays } = useTeamReviewsDue(
    hideBanners ? undefined : authUserId,
  )
  const { nudges: roadmapNudges } = useRoadmapNeedsNameNudges(hideBanners ? undefined : authUserId, role)
  const { status: gcReviewStatus } = useGcReviewWeekNudge(!hideBanners && officeEligible)
  const gcReviewNudge = gcReviewStatus != null ? gcReviewNudgeState(gcReviewStatus) : null
  const bulkDelete = useBulkDeleteNudge(hideBanners ? undefined : authUserId)
  const claimDev = useClaimDevAttemptsNudge(hideBanners ? undefined : authUserId)

  // Robot audits (v2.2573): the auditing roles — estimators do the work, dev
  // sees everything. The hook's sealed-shadow hold keeps unworkable audits out.
  const robotAuditsEnabled = !hideBanners && Boolean(authUserId) && (role === 'dev' || role === 'estimator')
  const { pending: robotAuditsPending } = useBidAuditsPendingCount(robotAuditsEnabled)

  // Cleared payments behind conditional lien releases (v2.2582) — office set.
  const lienUnconditionalEnabled = !hideBanners && Boolean(authUserId) && officeEligible
  const { owed: lienUnconditionalOwed } = useLienReleasesOwedNudge(lienUnconditionalEnabled)

  const needsYouItems = buildNeedsYouItems({
    role,
    arBankUnallocatedCount,
    arBankEnabled: arBankCountEnabled,
    tallyStaleUnlinkedCount,
    tallyStaffStalePeopleCount,
    tallyStaffStaleTxCount,
    tallyStaffEligible: officeEligible,
    tallyMinAgeDays: TALLY_STALE_MIN_AGE_DAYS,
    lostBidNudge,
    lostBidNudgeLoading,
    teamReviewsOverdue,
    teamReviewCadenceDays,
    roadmapNudges,
    jobFollowupsEnabled: officeEligible,
    jobFollowupCount,
    jobFollowupStageCounts,
    gcReviewEnabled: officeEligible,
    gcReviewStatus,
    gcReviewNudge,
    gcReviewIsWednesday: gcReviewWeekdayIndex() === 3,
    bulkDeleteAlerts: bulkDelete.visibleAlerts,
    claimDevRefusedCount: claimDev.visibleCount,
    claimDevLookbackDays: CLAIM_DEV_LOOKBACK_DAYS,
    robotAuditsEnabled,
    robotAuditsPending,
    lienUnconditionalEnabled,
    lienUnconditionalOwed,
  })

  const loadTallyUnlinkedCount = useCallback(async () => {
    if (!authUserId || role == null) return
    try {
      const n = await withSupabaseRetry(
        async () => await supabase.rpc('count_unlinked_mercury_transactions_for_tally'),
        'count unlinked tally transactions',
      )
      setTallyUnlinkedCount(typeof n === 'number' && Number.isFinite(n) ? n : 0)
    } catch {
      setTallyUnlinkedCount(null)
    }
  }, [authUserId, role])

  const loadTallyStaleUnlinkedCount = useCallback(async () => {
    if (!authUserId || role == null) return
    try {
      const n = await withSupabaseRetry(
        async () =>
          await supabase.rpc('count_unlinked_mercury_transactions_for_tally_stale', {
            min_age_days: TALLY_STALE_MIN_AGE_DAYS,
          }),
        'count stale unlinked tally transactions',
      )
      setTallyStaleUnlinkedCount(typeof n === 'number' && Number.isFinite(n) ? n : 0)
    } catch {
      setTallyStaleUnlinkedCount(null)
    }
  }, [authUserId, role])

  useEffect(() => {
    if (!authUserId || role == null) {
      setTallyUnlinkedCount(null)
      setTallyStaleUnlinkedCount(null)
      return
    }
    void loadTallyUnlinkedCount()
    void loadTallyStaleUnlinkedCount()
  }, [authUserId, role, loadTallyUnlinkedCount, loadTallyStaleUnlinkedCount])

  useEffect(() => {
    if (!authUserId || role == null) return
    const onFocus = () => {
      void loadTallyUnlinkedCount()
      void loadTallyStaleUnlinkedCount()
    }
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [authUserId, role, loadTallyUnlinkedCount, loadTallyStaleUnlinkedCount])

  useEffect(() => {
    // Why-we-lost nudge (v2.1800): same audience as the lens — the superintendent
    // gate on ?tab=why-we-lost redirects them, so they never see this banner.
    const hasLensAccess =
      role === 'dev' ||
      role === 'master_technician' ||
      isAssistantLike(role) ||
      role === 'estimator' ||
      role === 'primary'
    if (!authUserId || !hasLensAccess) {
      setLostBidNudge(null)
      setLostBidNudgeLoading(false)
      return
    }
    let cancelled = false
    setLostBidNudgeLoading(true)
    void (async () => {
      try {
        // Whole-team queue, matching the Why we lost lens (which is not personal):
        // most lost bids have someone else — or nobody — as estimator/account man,
        // so a personal filter would hide the backlog from the person clearing it.
        const rawRows = await withSupabaseRetry(
          async () =>
            supabase
              .from('bids')
              .select('loss_category, bid_value')
              .eq('outcome', 'lost')
              .limit(1000),
          'dashboard lost bids missing loss reason',
        )
        if (cancelled) return
        const rows = (rawRows ?? []) as Array<{ loss_category: string | null; bid_value: number | null }>
        if (!cancelled) setLostBidNudge(buildLostBidNudge(rows))
      } catch {
        if (!cancelled) setLostBidNudge(null)
      } finally {
        if (!cancelled) setLostBidNudgeLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [authUserId, role])

  const pinsToShow = filterPinsToShow(visiblePins)

  const showPinnedRowWithQuickActions =
    pinsToShow.length > 0 || (quickButtonsPlacement === 'with_pins' && showDashboardQuickButtons)

  const tallyLinkAccessibleName = getTallyLinkAccessibleName(tallyUnlinkedCount)

  /** Pinned-row chips share the quick-button look; slightly tighter padding so many pins still fit one row. */
  const pinnedItemLinkStyle: CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    boxSizing: 'border-box',
    padding: '0.5rem 1rem',
    fontSize: '0.9375rem',
    fontWeight: 600,
    background: '#3b82f6',
    color: 'white',
    border: 'none',
    borderRadius: 8,
    textDecoration: 'none',
  }

  /** Tally icon + Job Report button. Placement (above or below the banners) is controlled by jobReportFirst. */
  const jobReportRow =
    role != null ? (
      <div style={{ display: 'flex', alignItems: 'stretch', gap: '0.5rem', marginBottom: '1rem' }}>
        <TallySquareLink accessibleName={tallyLinkAccessibleName} unlinkedCount={tallyUnlinkedCount} />
        {clockSlot != null ? (
          <>
            <div style={{ flex: 1, minWidth: 0 }}>{clockSlot}</div>
            <JobReportSquareButton onClick={() => setNewReportModalOpen(true)} />
          </>
        ) : (
          <button
            type="button"
            onClick={() => setNewReportModalOpen(true)}
            style={{
              flex: 1,
              padding: '0 1.5rem',
              background: '#3b82f6',
              color: 'white',
              borderRadius: 8,
              border: 'none',
              fontWeight: 600,
              fontSize: '1.125rem',
              textAlign: 'center',
              minHeight: 48,
              height: 48,
              boxSizing: 'border-box',
              cursor: 'pointer',
            }}
          >
            Job Report
          </button>
        )}
      </div>
    ) : null

  return (
    <>
      {!bannersOnly && jobReportFirst && jobReportRow}
      {!bannersOnly && afterJobReportRow}
      {/* Needs You card (v2.2339): the hook-driven banners as one card with
          Cards / Walk-the-list views. The remaining self-gating banners below
          migrate item-by-item (job follow-ups joined in v2.2487). */}
      {!hideBanners && (
        <DashboardNeedsYouCard
          userId={authUserId}
          role={role}
          items={needsYouItems}
          onAction={(item) => {
            if (item.key === 'ar-deposits') {
              showToast('Opening Accounts Receivable…', 'info', 2800)
              navigate('/accounts-receivable')
            } else if (item.key === 'tally-self') {
              navigate('/tally?tab=transactions')
            } else if (item.key === 'tally-team') {
              setTallyStaffFollowUpModalOpen(true)
            } else if (item.key === 'lost-bids') {
              navigate('/bids?tab=why-we-lost')
            } else if (item.key === 'job-followups') {
              navigate('/jobs?tab=stages&followups=1')
            } else if (item.key === 'team-reviews') {
              // Deep link (v2.1564): land the Rate deck ON the first due person, not on card 1 of N.
              const first = teamReviewsOverdue[0]
              navigate(`/prospects?tab=team&stage=review${first ? `&rate=${first.id}` : ''}`)
            } else if (item.key === 'roadmap-needs-person') {
              const first = roadmapNudges[0]
              navigate(
                first
                  ? `/checklist?tab=roadmap&roadmap=${encodeURIComponent(first.roadmapId)}&view=plan`
                  : '/checklist?tab=roadmap',
              )
            } else if (item.key === 'gc-review-weekly') {
              navigate('/jobs?tab=stages&gcReview=1')
            } else if (item.key === 'bulk-delete') {
              navigate('/settings?tab=settings-data#settings-recently-deleted')
            } else if (item.key === 'claim-dev') {
              navigate('/settings?tab=settings-people')
            } else if (item.key === 'robot-audits') {
              navigate('/bids?tab=audits')
            } else if (item.key === 'lien-unconditional') {
              navigate('/jobs?tab=stages')
            }
          }}
          onSecondary={(item, key) => {
            if (item.key === 'bulk-delete') {
              if (key === 'snooze') bulkDelete.snooze24h()
              else if (key === 'dismiss') bulkDelete.dismissUntilCountIncreases()
            } else if (item.key === 'claim-dev') {
              if (key === 'snooze') claimDev.snooze24h()
              else if (key === 'dismiss') claimDev.dismissUntilItHappensAgain()
            }
          }}
        />
      )}
      {/* Wednesday GC certification (v2.1984): the due state lives in the card
          (v2.2490); the green rest-of-Wednesday confirmation stays a notice. */}
      {!hideBanners && officeEligible && gcReviewStatus != null && gcReviewNudge === 'done' && (
        <GcReviewWeekDoneNotice status={gcReviewStatus} />
      )}
      {!bannersOnly && !jobReportFirst && jobReportRow}
      {!bannersOnly && interstitial}
      {!bannersOnly && showPinnedRowWithQuickActions && (
        <div style={{ marginBottom: '1rem' }}>
          <div
            style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', alignItems: 'center' }}
            onClickCapture={(e) => recordNavClickFromEvent(authUserId, role, e)}
          >
            {quickButtonsPlacement === 'with_pins' &&
              showDashboardQuickButtons &&
              quickActionDefs.map((b) => (
                <Link key={b.key} to={b.to} style={pinnedItemLinkStyle} data-navtrack="quick-button">
                  {b.label}
                </Link>
              ))}
            {pinsToShow.map((item) => {
              const { to, label: displayLabel } = getPinnedChipDisplay(item, {
                costMatrixTotal,
                billedCount,
                billedTotal,
                supplyHousesAPTotal,
                subLaborDueTotal,
              })
              return (
                <Link key={item.path + (item.tab ?? '') + (item.bidId ?? '')} to={to} style={pinnedItemLinkStyle} data-navtrack="pin">
                  {displayLabel}
                </Link>
              )
            })}
          </div>
        </div>
      )}
      {renderModals && (
        <NewReportModal
          open={newReportModalOpen}
          onClose={() => setNewReportModalOpen(false)}
          onSaved={() => setNewReportModalOpen(false)}
          authUserId={authUserId ?? null}
          userRole={role}
        />
      )}
      {renderModals && (role === 'dev' || role === 'master_technician' || isAssistantLike(role)) && (
        <DashboardStaleTallyStaffFollowUpModal
          open={tallyStaffFollowUpModalOpen}
          onClose={() => setTallyStaffFollowUpModalOpen(false)}
          minAgeDays={TALLY_STALE_MIN_AGE_DAYS}
          onDataChanged={() => void refetchStaleTallyStaffFollowUp()}
        />
      )}
    </>
  )
}
