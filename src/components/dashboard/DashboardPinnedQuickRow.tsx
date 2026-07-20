import { useCallback, useEffect, useState, type CSSProperties, type ReactNode } from 'react'
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
import DashboardArBankUnallocatedBanner from '../DashboardArBankUnallocatedBanner'
import DashboardTallyStaleBanner from '../DashboardTallyStaleBanner'
import DashboardTallyStaleStaffBanner from '../DashboardTallyStaleStaffBanner'
import DashboardLostBidsMissingReasonBanner from '../DashboardLostBidsMissingReasonBanner'
import DashboardBulkDeleteAlertBanner from '../DashboardBulkDeleteAlertBanner'
import DashboardClaimDevAttemptsBanner from '../DashboardClaimDevAttemptsBanner'
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
  /** Slot rendered directly BELOW the Job Report row (main dashboard: the My Schedule card). */
  afterJobReportRow?: ReactNode
  /**
   * Slot rendered between the notification banners and the pins/quick-action row
   * (the main dashboard passes the finance section here). Omitted in Job Mode.
   */
  interstitial?: ReactNode
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
  afterJobReportRow,
  interstitial,
}: DashboardPinnedQuickRowProps) {
  const navigate = useNavigate()
  const { showToast } = useToastContext()

  const [newReportModalOpen, setNewReportModalOpen] = useState(false)
  const [tallyUnlinkedCount, setTallyUnlinkedCount] = useState<number | null>(null)
  const [tallyStaleUnlinkedCount, setTallyStaleUnlinkedCount] = useState<number | null>(null)
  const [tallyStaffFollowUpModalOpen, setTallyStaffFollowUpModalOpen] = useState(false)
  const [lostMissingLossReasonCount, setLostMissingLossReasonCount] = useState(0)
  const [lostMissingLossReasonLoading, setLostMissingLossReasonLoading] = useState(true)
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
    const hasBidsAccess =
      role === 'dev' ||
      role === 'master_technician' ||
      isAssistantLike(role) ||
      role === 'estimator' ||
      role === 'primary' ||
      role === 'superintendent'
    if (!authUserId || !hasBidsAccess) {
      setLostMissingLossReasonCount(0)
      setLostMissingLossReasonLoading(false)
      return
    }
    let cancelled = false
    setLostMissingLossReasonLoading(true)
    const uidForFilter = authUserId
    void (async () => {
      try {
        const rawRows = await withSupabaseRetry(
          async () =>
            supabase
              .from('bids')
              .select('loss_reason')
              .eq('outcome', 'lost')
              .or(`estimator_id.eq.${uidForFilter},account_manager_id.eq.${uidForFilter}`)
              .limit(500),
          'dashboard lost bids missing loss reason',
        )
        if (cancelled) return
        const rows = (rawRows ?? []) as Array<{ loss_reason: string | null }>
        const n = rows.filter((r) => !String(r.loss_reason ?? '').trim()).length
        if (!cancelled) setLostMissingLossReasonCount(n)
      } catch {
        if (!cancelled) setLostMissingLossReasonCount(0)
      } finally {
        if (!cancelled) setLostMissingLossReasonLoading(false)
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
        <div style={{ position: 'relative', width: 48, height: 48, flexShrink: 0 }}>
          <Link
            to="/tally"
            title={tallyLinkAccessibleName}
            aria-label={tallyLinkAccessibleName}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 48,
              height: 48,
              background: '#3b82f6',
              color: 'white',
              borderRadius: 8,
              textDecoration: 'none',
              boxSizing: 'border-box',
            }}
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" width={28} height={28} fill="currentColor" style={{ display: 'block' }} aria-hidden>
              <path d="M541.4 162.6C549 155 561.7 156.9 565.5 166.9C572.3 184.6 576 203.9 576 224C576 312.4 504.4 384 416 384C398.5 384 381.6 381.2 365.8 376L178.9 562.9C150.8 591 105.2 591 77.1 562.9C49 534.8 49 489.2 77.1 461.1L264 274.2C258.8 258.4 256 241.6 256 224C256 135.6 327.6 64 416 64C436.1 64 455.4 67.7 473.1 74.5C483.1 78.3 484.9 91 477.4 98.6L388.7 187.3C385.7 190.3 384 194.4 384 198.6L384 240C384 248.8 391.2 256 400 256L441.4 256C445.6 256 449.7 254.3 452.7 251.3L541.4 162.6z" />
            </svg>
          </Link>
          {typeof tallyUnlinkedCount === 'number' && tallyUnlinkedCount > 0 ? (
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
              {tallyUnlinkedCount > 99 ? '99+' : tallyUnlinkedCount}
            </span>
          ) : null}
        </div>
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
      </div>
    ) : null

  return (
    <>
      {jobReportFirst && jobReportRow}
      {afterJobReportRow}
      {arBankCountEnabled && (
        <DashboardArBankUnallocatedBanner
          count={arBankUnallocatedCount ?? 0}
          loading={arBankUnallocatedCount === null}
          onGoToAr={() => {
            showToast('Opening Accounts Receivable…', 'info', 2800)
            navigate('/accounts-receivable')
          }}
        />
      )}
      {role != null && (
        <DashboardTallyStaleBanner
          staleCount={typeof tallyStaleUnlinkedCount === 'number' ? tallyStaleUnlinkedCount : 0}
          loading={tallyStaleUnlinkedCount === null}
          minAgeDays={TALLY_STALE_MIN_AGE_DAYS}
          onGoToTally={() => navigate('/tally?tab=transactions')}
        />
      )}
      <DashboardLostBidsMissingReasonBanner
        count={lostMissingLossReasonCount}
        loading={lostMissingLossReasonLoading}
        onGoToLostSummary={() => {
          if (!authUserId) return
          navigate(
            `/bids?tab=bid-board&lostSummary=1&lostSummaryTab=${encodeURIComponent(authUserId)}`,
          )
        }}
      />
      {(role === 'dev' || role === 'master_technician' || isAssistantLike(role)) && (
        <DashboardTallyStaleStaffBanner
          peopleCount={typeof tallyStaffStalePeopleCount === 'number' ? tallyStaffStalePeopleCount : 0}
          transactionCount={typeof tallyStaffStaleTxCount === 'number' ? tallyStaffStaleTxCount : 0}
          loading={tallyStaffStalePeopleCount === null || tallyStaffStaleTxCount === null}
          minAgeDays={TALLY_STALE_MIN_AGE_DAYS}
          onOpen={() => setTallyStaffFollowUpModalOpen(true)}
        />
      )}
      {/* Dev-only and self-gating: renders nothing unless a burst of deletions was detected. */}
      <DashboardBulkDeleteAlertBanner />
      {/* Dev-only and self-gating: renders nothing unless someone was refused the break-glass dev code. */}
      <DashboardClaimDevAttemptsBanner />
      {!jobReportFirst && jobReportRow}
      {interstitial}
      {showPinnedRowWithQuickActions && (
        <div style={{ marginBottom: '1rem' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', alignItems: 'center' }}>
            {quickButtonsPlacement === 'with_pins' &&
              showDashboardQuickButtons &&
              quickActionDefs.map((b) => (
                <Link key={b.key} to={b.to} style={pinnedItemLinkStyle}>
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
                <Link key={item.path + (item.tab ?? '')} to={to} style={pinnedItemLinkStyle}>
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
