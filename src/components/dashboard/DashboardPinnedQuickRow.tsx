import { useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { Link, useNavigate } from 'react-router-dom'
import { recordNavClick, recordNavClickFromEvent } from '../../lib/navClickTelemetry'
import { needsYouDoorWords } from '../../lib/dashboard/phoneFolds'
import { DashboardNeedsYouCard } from './DashboardNeedsYouCard'
import { DashboardOfficeRoundCard } from './DashboardOfficeRoundCard'
import { GcReviewWeekDoneNotice } from '../DashboardGcReviewWeeklyBanner'
import { planQueueRecord, readRecordedToday, writeRecordedToday, type QueueKind } from '../../lib/people/dayBookQueueRecorder'
import { toLocalDateString } from '../../lib/dailyGoalsGate'
import type { DispatchAgingSummary } from '../../lib/dispatchInboxAging'
import NewReportModal from '../NewReportModal'
import type { PinnedItem } from '../../lib/pinnedTabs'
import type { UserRole } from '../../hooks/useAuth'
import { filterPinsToShow, getPinnedChipDisplay, getTallyLinkAccessibleName } from '../../lib/dashboardPinnedRow'
import { useNeedsYouInputs } from '../../hooks/useNeedsYouInputs'
import { useNeedsYouPress } from '../needsYou/useNeedsYouPress'
import { ORANGE_UNDER_WORDS, WORDS_ON_ORANGE } from '../../lib/orangeUnderWords'

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
  /**
   * Ready to Bill's count from the Dashboard's billing engine (v2.3801) — null until it
   * has loaded once. The Day book's queue recorder writes it as the `billing` kind, so a
   * past Billed line can end with what was still left to bill that day.
   */
  readyToBillCount?: number | null
  /** Financial pin totals from the parent-side hooks (keyed on financialRefreshKey there). */
  costMatrixTotal: number | null
  billedCount: number | null
  billedTotal: number | null
  supplyHousesAPTotal: number | null
  subLaborDueTotal: number | null
  /**
   * Open dispatch requests past the min age (journey-map
   * #40), summarised by the parent from its `useDispatchInbox` rows — null when
   * nothing has aged, the viewer isn't dispatch-eligible, or the inbox hasn't
   * loaded. The Needs-You action scrolls to the Teams Inbox card on this page.
   */
  dispatchAged?: DispatchAgingSummary | null
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
  /** The office person's phone with Dispatch Mode on (v2.3883): Needs You is a one-line door to the Inbox tab's deck, not the card. */
  needsYouDoor?: boolean
  /** The office person's phone (v2.3891, the owner's pick 2026-09-27): no Tally and Job Report squares beside the clock — two quiet links under it instead, so both stay one tap away. */
  quietSquares?: boolean
  /**
   * Job Mode on a phone (punch list #189, PR 2): the classic row keeps its Tally square and drops the
   * wide Job Report button — with `renderModals={false}` it opened nothing, and the press bar's
   * Leave report is the same door. Only read when there is no `clockSlot`.
   */
  hideJobReport?: boolean
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
        to="/tally?tab=transactions"
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
        {/* A receipt (v2.4040, the owner's pick 2026-09-28): the square is the door to Tally, the spend ledger. */}
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width={tall ? 24 : 28} height={tall ? 24 : 28} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" style={{ display: 'block' }} aria-hidden>
          <path d="M5 21V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16l-3-2-2 2-2-2-2 2-2-2-3 2" />
          <path d="M9 8h6M9 12h6" />
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
            background: ORANGE_UNDER_WORDS,
            color: WORDS_ON_ORANGE,
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
  readyToBillCount = null,
  dispatchAged = null,
  renderModals,
  jobReportFirst = false,
  clockSlot,
  afterJobReportRow,
  interstitial,
  bannersOnly = false,
  hideBanners = false,
  needsYouDoor = false,
  quietSquares = false,
  hideJobReport = false,
}: DashboardPinnedQuickRowProps) {
  const navigate = useNavigate()
  const [newReportModalOpen, setNewReportModalOpen] = useState(false)

  // Every Needs You source, read once for this host (v2.5771, punch list #146): the gates live in
  // `needsYouSourceGates`, the hooks in `useNeedsYouInputs`, the doors in `needsYouDoor` — shared
  // with Quickfill's station, so the two hosts cannot drift.
  const needsYou = useNeedsYouInputs({ authUserId, role, host: 'dashboard', enabled: !hideBanners, dispatchAged })
  const needsYouItems = needsYou.items
  const { officeEligible, handles } = needsYou
  const { tallyUnlinkedCount, arBankUnallocatedCount, contractNudge, gcReviewStatus, gcReviewNudge } = handles
  const press = useNeedsYouPress({
    host: 'dashboard',
    doorData: needsYou.doorData,
    handles,
    renderWindows: renderModals,
    officeEligible,
    onStation: (station) => {
      if (station !== 'dispatch-inbox') return false
      // The inbox lives further down this page (Teams Inbox card); Dispatch Mode users get its Inbox tab.
      const card = document.getElementById('dash-teams-inbox')
      if (!card) return false
      card.scrollIntoView({ behavior: 'smooth', block: 'start' })
      return true
    },
  })

  // The Day book's queue snapshot (decision 6, v2.3736; per kind since v2.3743): a dev or
  // controller's Dashboard records what the card counted — deposits to match, jobs without
  // a contract, and (v2.3801) the Ready to Bill stage's count — each kind the day it
  // resolves, so the Day book's history can say what was still waiting. Never blocks the card.
  useEffect(() => {
    const today = toLocalDateString(new Date())
    const store = typeof window !== 'undefined' ? window.localStorage : null
    const counts = planQueueRecord({
      role,
      today,
      counts: { deposits: arBankUnallocatedCount, contracts: contractNudge ? contractNudge.missing.count : null, billing: readyToBillCount },
      recorded: readRecordedToday(store, today),
    })
    if (!counts) return
    let cancelled = false
    void (async () => {
      try {
        const { error } = await supabase.rpc('record_day_book_queue' as never, { p_day: today, p_counts: counts } as never)
        if (!cancelled && !error) writeRecordedToday(store, today, Object.keys(counts) as QueueKind[])
      } catch {
        /* an RPC not yet pushed, or offline — the next load tries again */
      }
    })()
    return () => {
      cancelled = true
    }
  }, [role, arBankUnallocatedCount, contractNudge, readyToBillCount])

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
      quietSquares && clockSlot != null ? (
      <div data-quiet-squares style={{ marginBottom: '1rem', display: 'grid', gap: '0.35rem' }}>
        {clockSlot}
        <div style={{ display: 'flex', gap: '1rem', fontSize: '0.8125rem' }}>
          <button type="button" onClick={() => setNewReportModalOpen(true)} style={{ minHeight: 36, padding: 0, border: 'none', background: 'none', color: 'var(--text-link)', font: 'inherit', cursor: 'pointer', textDecoration: 'underline' }}>
            Job report
          </button>
          <Link to="/tally?tab=transactions" aria-label={tallyLinkAccessibleName} style={{ minHeight: 36, display: 'inline-flex', alignItems: 'center', color: 'var(--text-link)' }}>
            Tally{(tallyUnlinkedCount ?? 0) > 0 ? ` · ${tallyUnlinkedCount}` : ''}
          </Link>
        </div>
      </div>
      ) : (
      <div style={{ marginBottom: '1rem' }}>
      <div style={{ display: 'flex', alignItems: 'stretch', gap: '0.5rem' }}>
        <TallySquareLink accessibleName={tallyLinkAccessibleName} unlinkedCount={tallyUnlinkedCount} />
        {clockSlot != null ? (
          <>
            <div style={{ flex: 1, minWidth: 0 }}>{clockSlot}</div>
            <JobReportSquareButton onClick={() => setNewReportModalOpen(true)} />
          </>
        ) : hideJobReport ? null : (
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
      </div>
      )
    ) : null

  return (
    <>
      {!bannersOnly && jobReportFirst && jobReportRow}
      {!bannersOnly && afterJobReportRow}
      {/* Needs You card (v2.2339): the hook-driven banners as one card with
          Cards / Walk-the-list views. The remaining self-gating banners below
          migrate item-by-item (job follow-ups joined in v2.2487). */}
      {!hideBanners && needsYouDoor && needsYouDoorWords(needsYouItems) ? (
        <button
          type="button"
          data-needs-you-door
          onClick={() => {
            recordNavClick(authUserId, role, 'needs-you', '#door-inbox')
            navigate('/dispatch-mode/inbox')
          }}
          style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', width: '100%', minHeight: 48, padding: '0.6rem 0.85rem', marginBottom: '1rem', border: '1px solid var(--border-amber)', borderRadius: 10, background: 'var(--bg-amber-tint)', color: 'var(--text)', font: 'inherit', fontSize: '0.9375rem', textAlign: 'left', cursor: 'pointer', boxSizing: 'border-box' }}
        >
          <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            <strong>Needs you · {needsYouItems.length}</strong>
            <span style={{ color: 'var(--text-muted)' }}> · {needsYouItems[0]?.title}</span>
          </span>
          <span style={{ color: 'var(--text-link)', fontSize: '0.8125rem', fontWeight: 600, whiteSpace: 'nowrap' }}>Inbox ›</span>
        </button>
      ) : null}
      {!hideBanners && !needsYouDoor && (
        <DashboardNeedsYouCard
          userId={authUserId}
          role={role}
          items={needsYouItems}
          onAction={press.onAction}
          onSecondary={press.onSecondary}
        />
      )}
      {/* The office's round (v2.5845, punch list #176, change 5): the round's close sheet in two lines, for the office. */}
      {!hideBanners && !needsYouDoor ? <DashboardOfficeRoundCard enabled={officeEligible} /> : null}
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
      {press.windows}
    </>
  )
}
