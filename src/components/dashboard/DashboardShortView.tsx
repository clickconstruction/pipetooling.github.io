import { useEffect, useState, type CSSProperties, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import type { UserRole } from '../../hooks/useAuth'
import { useIsMobile } from '../../hooks/useIsMobile'
import { useNeedsYouInputs } from '../../hooks/useNeedsYouInputs'
import { needsYouClickTarget, type NeedsYouItem } from '../../lib/dashboardNeedsYou'
import { NEEDS_YOU_ACTION_BG, NEEDS_YOU_ACTION_FG, NEEDS_YOU_RAIL } from '../../lib/dashboard/needsYouPalette'
import { SHORT_DASHBOARD_WORDS, shortDashboardGreeting, shortDashboardRead, splitForShortDashboard, type ShortDashboardRead } from '../../lib/dashboard/shortDashboard'
import type { DispatchAgingSummary } from '../../lib/dispatchInboxAging'
import { LIEN_DESK_PATH } from '../../lib/lien/lienDeskRoute'
import { recordNavClick } from '../../lib/navClickTelemetry'
import { EmptyState } from '../EmptyState'
import { useNeedsYouPress } from '../needsYou/useNeedsYouPress'
import LienLeaderSignCardView from './LienLeaderSignCardView'

/**
 * The short Dashboard: what a leader on the Short view sees in place of the page's forty cards. Write someone up
 * under the greeting, then one list of the lines that wait on him alone, each with one press, then his day, then one
 * line for what the office is carrying and one door to everything else. `shortDashboard.ts` decides which lines are his and every word; this draws them.
 *
 * `ShortDashboardBody` takes everything as props, so a test and a look can mount it with sample rows.
 * `DashboardShortHome` is the page's part: it reads Needs you once, as the full Dashboard's card would, and opens
 * each line through the same doors, so a press here lands exactly where the card's press lands.
 */

const CARD: CSSProperties = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '0.9rem 1rem', marginBottom: '0.9rem', boxSizing: 'border-box' }
const HEAD: CSSProperties = { display: 'flex', alignItems: 'baseline', gap: '0.5rem', margin: '0 0 0.6rem', fontSize: '0.75rem', fontWeight: 800, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--text-muted)' }
const PILL: CSSProperties = { marginLeft: 'auto', background: 'var(--bg-amber-100)', color: 'var(--text-amber-800)', borderRadius: 999, padding: '1px 9px', fontSize: '0.8125rem', fontWeight: 700, letterSpacing: 0 }
const ROW: CSSProperties = { display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto', gap: '4px 12px', alignItems: 'center', padding: '0.7rem 0 0.7rem 0.75rem', borderLeft: '4px solid transparent', borderTop: '1px solid var(--border)' }
const TITLE: CSSProperties = { fontSize: '1rem', fontWeight: 700, color: 'var(--text-strong)', minWidth: 0 }
const DETAIL: CSSProperties = { gridColumn: '1 / -1', fontSize: '0.8125rem', color: 'var(--text-muted)', lineHeight: 1.45 }
const PRESS: CSSProperties = { font: 'inherit', minHeight: 44, minWidth: 84, padding: '0 16px', border: 'none', borderRadius: 8, fontSize: '0.9375rem', fontWeight: 700, cursor: 'pointer' }

export type ShortDashboardBodyProps = {
  firstName: string
  /** The hour of the day in the viewer's clock, for the greeting. */
  hour: number
  /** The lines that wait on him alone, worst first. */
  waiting: NeedsYouItem[]
  /** How many more of his own lines sit behind the door. */
  alsoYours: number
  /** The viewer's role, for the door's second line: a superintendent's names what is behind it for him. */
  role?: string | null
  /** How many lines someone else is pressing. */
  office: number
  read: ShortDashboardRead
  phone: boolean
  onAct: (item: NeedsYouItem) => void
  /** A press on the leader's lien card: the notice's address and which press it was. */
  onOpenLien: (item: NeedsYouItem, href: string, press: 'sign' | 'row' | 'more') => void
  onOpenLienDesk: () => void
  /** Rate your crew, when the round is open for him: a row of the list, since only he can answer it. */
  onRateCrew?: () => void
  /** Above the greeting: a trial helper's verdict, which shows itself only when one is owed. */
  top?: ReactNode
  /** Between the greeting and the list: Write someone up, which the list must never push off the first screen. */
  underGreeting?: ReactNode
  /** His day: My Schedule as the full Dashboard draws it. */
  schedule?: ReactNode
  /** Under the door: required training, which shows itself only when something is required. */
  foot?: ReactNode
  onEverythingElse: () => void
}

export function ShortDashboardBody({ firstName, hour, waiting, alsoYours, role, office, read, phone, onAct, onOpenLien, onOpenLienDesk, onRateCrew, top, underGreeting, schedule, foot, onEverythingElse }: ShortDashboardBodyProps) {
  const w = SHORT_DASHBOARD_WORDS
  const rows = waiting.length + (onRateCrew ? 1 : 0)
  // The count is a promise that the list is whole, so it waits for a read that is in.
  const countLine = read === 'ready' ? w.count(rows) : ''

  return (
    <div data-short-dashboard data-read={read} style={{ maxWidth: 560, margin: '0 auto' }}>
      {top}
      <div style={{ margin: '0.25rem 0 0.9rem' }}>
        <div data-short-greeting style={{ fontSize: '1.375rem', fontWeight: 800, color: 'var(--text-strong)', lineHeight: 1.2 }}>
          {shortDashboardGreeting(firstName, hour)}
        </div>
        {countLine ? (
          <div data-short-count style={{ marginTop: 2, fontSize: '0.9375rem', color: 'var(--text-muted)' }}>
            {countLine}
          </div>
        ) : null}
      </div>
      {underGreeting}

      <section aria-label={w.title} style={CARD}>
        <h2 style={HEAD}>
          <span>{w.title}</span>
          {read === 'ready' && rows > 0 ? (
            <span data-short-waiting-count style={PILL}>
              {rows}
            </span>
          ) : null}
        </h2>
        {read === 'reading' ? (
          <p role="status" data-short-reading style={{ margin: 0, padding: '0.5rem 0', color: 'var(--text-muted)', fontSize: '0.9375rem' }}>
            {w.reading}
          </p>
        ) : (
          <>
            {read === 'failed' ? (
              <p role="alert" data-short-failed style={{ margin: '0 0 0.6rem', padding: '0.6rem 0.75rem', borderRadius: 8, background: 'var(--bg-red-tint)', color: 'var(--text-red-700)', fontSize: '0.875rem' }}>
                {w.failed}{' '}
                <button type="button" onClick={onOpenLienDesk} style={{ font: 'inherit', fontWeight: 700, color: 'inherit', background: 'none', border: 'none', padding: 0, textDecoration: 'underline', cursor: 'pointer' }}>
                  {w.failedPress}
                </button>
              </p>
            ) : null}
            {waiting.map((item, i) =>
              item.lienSign ? (
                <div key={item.key} data-short-row={item.key} style={{ marginTop: i === 0 ? 0 : '0.6rem', marginBottom: '0.6rem' }}>
                  <LienLeaderSignCardView card={item.lienSign} phone={phone} rail={NEEDS_YOU_RAIL[item.severity]} onOpen={(href, press) => onOpenLien(item, href, press)} />
                </div>
              ) : (
                <div key={item.key} data-short-row={item.key} style={{ ...ROW, borderLeftColor: NEEDS_YOU_RAIL[item.severity], ...(i === 0 ? { borderTop: 'none' } : null) }}>
                  <span style={TITLE}>{item.title}</span>
                  <button type="button" data-short-press={item.key} onClick={() => onAct(item)} style={{ ...PRESS, background: NEEDS_YOU_ACTION_BG[item.severity], color: NEEDS_YOU_ACTION_FG[item.severity] }}>
                    {item.actionLabel}
                  </button>
                  <span style={DETAIL}>{item.detail}</span>
                </div>
              ),
            )}
            {onRateCrew ? (
              <div data-short-row="rate-crew" style={{ ...ROW, borderLeftColor: NEEDS_YOU_RAIL.amber, ...(waiting.length === 0 ? { borderTop: 'none' } : null) }}>
                <span style={TITLE}>{w.rateCrew.title}</span>
                <button type="button" data-short-press="rate-crew" onClick={onRateCrew} style={{ ...PRESS, background: NEEDS_YOU_ACTION_BG.amber, color: NEEDS_YOU_ACTION_FG.amber }}>
                  {w.rateCrew.press}
                </button>
                <span style={DETAIL}>{w.rateCrew.detail}</span>
              </div>
            ) : null}
            {rows === 0 && read === 'ready' ? <EmptyState {...w.empty} compact /> : null}
          </>
        )}
      </section>

      {schedule}

      <p data-short-office style={{ margin: '0.25rem 0 0.6rem', textAlign: 'center', fontSize: '0.875rem', color: 'var(--text-muted)' }}>
        {w.office(office)}
      </p>
      <button
        type="button"
        data-short-door
        onClick={onEverythingElse}
        style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', width: '100%', minHeight: 56, padding: '0.6rem 1rem', marginBottom: '0.9rem', border: '1px solid var(--border-strong)', borderRadius: 12, background: 'var(--surface)', color: 'var(--text)', font: 'inherit', textAlign: 'left', cursor: 'pointer', boxSizing: 'border-box' }}
      >
        <span style={{ flex: 1, minWidth: 0 }}>
          <span style={{ display: 'block', fontSize: '1rem', fontWeight: 700 }}>{w.door}</span>
          <span data-short-door-note style={{ display: 'block', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
            {w.doorNote(alsoYours, role)}
          </span>
        </span>
        <span aria-hidden="true" style={{ fontSize: '1.25rem', color: 'var(--text-link)' }}>
          ›
        </span>
      </button>
      {foot}
    </div>
  )
}

export default function DashboardShortHome({
  authUserId,
  role,
  displayName,
  dispatchAged = null,
  onRateCrew,
  top,
  underGreeting,
  schedule,
  foot,
  onEverythingElse,
}: {
  authUserId: string
  role: UserRole | null
  displayName: string
  dispatchAged?: DispatchAgingSummary | null
  onRateCrew?: () => void
  top?: ReactNode
  underGreeting?: ReactNode
  schedule?: ReactNode
  foot?: ReactNode
  onEverythingElse: () => void
}) {
  const phone = useIsMobile()
  const navigate = useNavigate()
  // The same read as the full Dashboard's Needs you card: every source, so the office's count is the true one.
  const needsYou = useNeedsYouInputs({ authUserId, role, host: 'dashboard', dispatchAged })
  const press = useNeedsYouPress({ host: 'dashboard', doorData: needsYou.doorData, handles: needsYou.handles, officeEligible: needsYou.officeEligible })
  const split = splitForShortDashboard(needsYou.items, role)

  const lienLoading = needsYou.reading.lienDesk
  const [lienStarted, setLienStarted] = useState(false)
  const [settled, setSettled] = useState(false)
  useEffect(() => {
    if (lienLoading) setLienStarted(true)
  }, [lienLoading])
  const read = shortDashboardRead({
    lienOn: needsYou.inputs.lienDeskEnabled === true,
    lienHasData: needsYou.inputs.lienDesk != null,
    lienLoading,
    lienStarted,
    waiversLoading: needsYou.reading.lienWaivers,
    settled,
  })
  useEffect(() => {
    if (read === 'ready') setSettled(true)
  }, [read])

  return (
    <>
      <ShortDashboardBody
        firstName={displayName.trim().split(/\s+/)[0] ?? ''}
        hour={new Date().getHours()}
        waiting={split.waiting}
        alsoYours={split.alsoYours.length}
        role={role}
        office={split.office.length}
        read={read}
        phone={phone}
        onAct={(item) => {
          recordNavClick(authUserId, role, 'short-dashboard', needsYouClickTarget(item))
          press.onAction(item)
        }}
        onOpenLien={(item, href, which) => {
          recordNavClick(authUserId, role, 'short-dashboard', `#${item.key}-${which}`)
          press.onAction({ ...item, openHref: href })
        }}
        onOpenLienDesk={() => navigate(LIEN_DESK_PATH)}
        onRateCrew={onRateCrew}
        top={top}
        underGreeting={underGreeting}
        schedule={schedule}
        foot={foot}
        onEverythingElse={() => {
          recordNavClick(authUserId, role, 'short-dashboard', '#everything-else')
          onEverythingElse()
        }}
      />
      {press.windows}
    </>
  )
}
