import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import type { BidWithBuilder } from '../../types/bidWithBuilder'
import { supabase } from '../../lib/supabase'
import {
  buildPulseBandItems,
  buildPulsePeopleView,
  buildPulsePersonRows,
  buildPulseStats,
  buildPulseWeeks,
  formatPulseMoney,
  parsePulseHiddenPeopleState,
  PULSE_SMALL_SAMPLE_DECIDED,
  withAllPulsePeopleShown,
  withPulsePersonHidden,
  type PulseHiddenPeopleState,
  type PulsePersonDirectoryEntry,
  type PulsePersonRow,
  type PulseRoleStats,
} from '../../lib/bids/estimatingPulse'
import { BID_BOARD_WEEKLY_SENT_DEFAULT_MAX_WEEKS } from '../../lib/bidBoardWeeklySentStats'
import { getDefaultWeekRange } from '../../utils/dateUtils'
import { BidBoardWeeklySentCellModal } from './BidBoardWeeklySentCellModal'

/** Chart geometry (px). Bars √-scale so one huge week doesn't flatten the rest. */
const BAR_W = 34
const BAR_GAP = 6
const CHART_H = 244
const CHART_TOP = 40
const CHART_BOTTOM = 34

const STATUS_COLORS = {
  won: '#16a34a',
  wait: '#f59e0b',
  lost: '#fca5a5',
} as const

const CHIP_STYLES: Record<'won' | 'lost' | 'wait', CSSProperties> = {
  won: { background: 'var(--bg-green-100)', color: 'var(--text-green-600)', border: '1px solid var(--border-green)' },
  lost: { background: 'var(--bg-red-100)', color: 'var(--text-red-700)', border: '1px solid #fecaca' },
  wait: { background: 'var(--bg-amber-100)', color: 'var(--text-amber-800)', border: '1px solid var(--border-amber-soft)' },
}

const BAND_GRADIENT =
  'linear-gradient(90deg, var(--bg-red-100) 0 20%, var(--bg-amber-100) 20% 40%, var(--bg-green-100) 40% 60%, var(--bg-amber-100) 60% 80%, var(--bg-red-100) 80% 100%)'

const statCardStyle: CSSProperties = {
  background: 'var(--bg-subtle)',
  border: '1px solid var(--border)',
  borderRadius: 10,
  padding: '0.55rem 0.8rem',
  minWidth: 0,
}

const statLabelStyle: CSSProperties = {
  fontSize: '0.66rem',
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  color: 'var(--text-muted)',
}

const HIDDEN_PEOPLE_KEY = 'bid_board_pulse_hidden_people_v1'

function readHiddenPeopleState(): PulseHiddenPeopleState {
  try {
    return parsePulseHiddenPeopleState(window.localStorage.getItem(HIDDEN_PEOPLE_KEY))
  } catch {
    return { hidden: [], shownArchived: [] }
  }
}

type ListModalState = {
  /** Bold first part of the modal subtitle, e.g. `Wendi` or `Week 32`. */
  heading: string
  /** Second part, e.g. `Won as estimator` or `08/02–08/08`. */
  context: string
  bidIds: string[]
}

function StatCard({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div style={statCardStyle}>
      <div style={statLabelStyle}>{label}</div>
      <div style={{ fontSize: '1.2rem', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{value}</div>
      <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{sub}</div>
    </div>
  )
}

function PersonSparkline({ weekly }: { weekly: number[] }) {
  const W = 260
  const H = 20
  const bw = W / Math.max(1, weekly.length)
  const max = Math.max(...weekly, 1)
  return (
    <svg width={W} height={H} style={{ display: 'block', marginTop: '0.25rem', maxWidth: '100%' }} aria-hidden>
      {weekly.map((v, i) => {
        const h = v > 0 ? Math.max(2, Math.sqrt(v / max) * (H - 2)) : 0
        return (
          <rect
            key={i}
            x={i * bw + 1}
            y={H - (h || 2)}
            width={Math.max(2, bw - 2)}
            height={h || 2}
            rx={1}
            fill={v > 0 ? 'var(--border-strong)' : 'var(--bg-muted)'}
          />
        )
      })}
    </svg>
  )
}

function roleConfShort(r: PulseRoleStats): string {
  const decided = r.wonCount + r.lostCount
  if (decided === 0) return '—'
  const pct = (100 * r.wonCount) / decided
  const byDollar = r.decidedDollars > 0 ? ` · ${((100 * r.wonDollars) / r.decidedDollars).toFixed(0)}% $` : ''
  return `${pct.toFixed(0)}%${decided < PULSE_SMALL_SAMPLE_DECIDED ? '*' : ''}${byDollar}`
}

function roleConfFull(roleLabel: string, r: PulseRoleStats): string {
  const decided = r.wonCount + r.lostCount
  const head = `${roleLabel}: ${r.sentCount} sent · ${formatPulseMoney(r.sentDollars)}`
  if (decided === 0) return `${head} — no decided bids yet`
  const pct = (100 * r.wonCount) / decided
  const byDollar = r.decidedDollars > 0 ? ` · ${((100 * r.wonDollars) / r.decidedDollars).toFixed(0)}% by $` : ''
  const small = decided < PULSE_SMALL_SAMPLE_DECIDED ? ' · small sample' : ''
  return `${head} — Won ${pct.toFixed(1)}% by count (${r.wonCount} of ${decided})${byDollar}${small}`
}

function RoleLine({
  roleKey,
  roleLabel,
  stats,
  onOpenList,
}: {
  roleKey: 'est' | 'am'
  roleLabel: string
  stats: PulseRoleStats
  onOpenList: (kind: 'won' | 'lost' | 'wait') => void
}) {
  const decided = stats.wonCount + stats.lostCount
  const pct = decided > 0 ? (100 * stats.wonCount) / decided : null
  const chip = (kind: 'won' | 'lost' | 'wait', label: string, count: number) => (
    <button
      type="button"
      disabled={count === 0}
      onClick={() => onOpenList(kind)}
      style={{
        font: 'inherit',
        fontSize: '0.68rem',
        fontWeight: 700,
        borderRadius: 999,
        padding: '0.08rem 0.45rem',
        cursor: count > 0 ? 'pointer' : 'default',
        opacity: count > 0 ? 1 : 0.45,
        ...CHIP_STYLES[kind],
      }}
    >
      {label} {count}
    </button>
  )
  return (
    <div
      title={roleConfFull(roleLabel, stats)}
      style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', flexWrap: 'wrap', marginTop: '0.45rem' }}
    >
      <span
        style={{
          fontSize: '0.6rem',
          fontWeight: 800,
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          borderRadius: 4,
          padding: '0.1rem 0.35rem',
          background: roleKey === 'est' ? 'var(--bg-blue-200)' : 'var(--bg-violet-100)',
          color: roleKey === 'est' ? 'var(--text-blue-800)' : 'var(--text-violet-800)',
          flex: '0 0 auto',
        }}
      >
        {roleLabel}
      </span>
      <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', flex: '0 0 auto', fontVariantNumeric: 'tabular-nums' }}>
        {stats.sentCount} · {formatPulseMoney(stats.sentDollars)}
      </span>
      <span style={{ display: 'flex', gap: '0.3rem', flexWrap: 'wrap', flex: '0 0 auto' }}>
        {chip('won', 'W', stats.wonCount)}
        {chip('lost', 'L', stats.lostCount)}
        {chip('wait', '⏳', stats.waitingCount)}
      </span>
      <span
        aria-hidden
        style={{
          position: 'relative',
          height: 7,
          borderRadius: 999,
          flex: '1 1 56px',
          minWidth: 48,
          alignSelf: 'center',
          background: BAND_GRADIENT,
          border: '1px solid var(--border)',
        }}
      >
        {pct !== null ? (
          <span
            style={{
              position: 'absolute',
              top: -3,
              width: 4,
              height: 11,
              borderRadius: 2,
              background: 'var(--text-strong)',
              transform: 'translateX(-50%)',
              left: `${pct}%`,
            }}
          />
        ) : null}
      </span>
      <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', flex: '0 0 auto', fontVariantNumeric: 'tabular-nums' }}>
        {roleConfShort(stats)}
      </span>
    </div>
  )
}

function PersonCard({
  person,
  onOpenList,
  onHide,
}: {
  person: PulsePersonRow
  onOpenList: (m: ListModalState) => void
  onHide: () => void
}) {
  const openRoleList = (roleName: string, stats: PulseRoleStats) => (kind: 'won' | 'lost' | 'wait') => {
    const bidIds = kind === 'won' ? stats.wonBidIds : kind === 'lost' ? stats.lostBidIds : stats.waitingBidIds
    const kindLabel = kind === 'won' ? 'Won' : kind === 'lost' ? 'Lost' : 'Still waiting'
    onOpenList({ heading: person.displayName, context: `${kindLabel} as ${roleName}`, bidIds })
  }
  return (
    <div
      style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 12,
        padding: '0.6rem 0.85rem 0.7rem',
        position: 'relative',
      }}
    >
      <button
        type="button"
        onClick={onHide}
        title={`Hide ${person.displayName} from this view (they still count in company totals)`}
        aria-label={`Hide ${person.displayName} from this view`}
        style={{
          position: 'absolute',
          top: '0.4rem',
          right: '0.45rem',
          border: 'none',
          background: 'transparent',
          color: 'var(--text-muted)',
          cursor: 'pointer',
          borderRadius: 6,
          padding: '0.1rem 0.3rem',
          fontSize: '0.8rem',
          lineHeight: 1,
          opacity: 0.6,
        }}
      >
        ✕
      </button>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '0.5rem', paddingRight: '1.2rem' }}>
        <h4 style={{ margin: 0, fontSize: '0.95rem' }}>{person.displayName}</h4>
        <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontVariantNumeric: 'tabular-nums' }}>
          {person.touchedCount} bid{person.touchedCount !== 1 ? 's' : ''} touched · {formatPulseMoney(person.touchedDollars)}
        </div>
      </div>
      <PersonSparkline weekly={person.weeklyTouchedDollars} />
      {person.estimator ? (
        <RoleLine roleKey="est" roleLabel="Estimator" stats={person.estimator} onOpenList={openRoleList('estimator', person.estimator)} />
      ) : null}
      {person.accountManager ? (
        <RoleLine
          roleKey="am"
          roleLabel="Account Man"
          stats={person.accountManager}
          onOpenList={openRoleList('account manager', person.accountManager)}
        />
      ) : null}
    </div>
  )
}

/**
 * The Health section's "New" view (v2.1918): stat strip + stacked weekly
 * outcome chart + shared won-% field band + one card per person.
 * Same outcome semantics as the Scoreboard; every number drills down.
 */
export function BidBoardEstimatingPulseSection({ filteredBids }: { filteredBids: BidWithBuilder[] }) {
  const [listModal, setListModal] = useState<ListModalState | null>(null)

  const currentWeekStart = useMemo(() => getDefaultWeekRange().start, [])
  const windowWeeks = BID_BOARD_WEEKLY_SENT_DEFAULT_MAX_WEEKS
  const weeks = useMemo(
    () => buildPulseWeeks(filteredBids, currentWeekStart, windowWeeks),
    [filteredBids, currentWeekStart, windowWeeks],
  )
  const stats = useMemo(() => buildPulseStats(filteredBids, currentWeekStart), [filteredBids, currentWeekStart])
  const people = useMemo(
    () => buildPulsePersonRows(filteredBids, currentWeekStart, windowWeeks),
    [filteredBids, currentWeekStart, windowWeeks],
  )

  // Names + archived flags for every person id. The users SELECT policy hides
  // archived accounts from non-dev roles, so the bids join can leave a person
  // nameless ("—"); this RPC names them and tells us who is archived.
  const [directory, setDirectory] = useState<ReadonlyMap<string, PulsePersonDirectoryEntry>>(new Map())
  const personIdsKey = useMemo(() => people.map((p) => p.userId).sort().join(','), [people])
  useEffect(() => {
    const ids = personIdsKey ? personIdsKey.split(',') : []
    if (ids.length === 0) {
      setDirectory(new Map())
      return
    }
    let cancelled = false
    void supabase.rpc('list_user_display_names', { p_user_ids: ids }).then(({ data, error }) => {
      if (cancelled || error || !data) return
      setDirectory(new Map(data.map((r) => [r.id, { name: r.name, archived: r.archived_at != null }])))
    })
    return () => {
      cancelled = true
    }
  }, [personIdsKey])

  const [hiddenState, setHiddenState] = useState<PulseHiddenPeopleState>(readHiddenPeopleState)
  const updateHiddenState = (next: PulseHiddenPeopleState) => {
    setHiddenState(next)
    try {
      window.localStorage.setItem(HIDDEN_PEOPLE_KEY, JSON.stringify(next))
    } catch {
      /* device just won't remember */
    }
  }

  const { visible: visiblePeople, hiddenChips } = useMemo(
    () => buildPulsePeopleView(people, directory, hiddenState),
    [people, directory, hiddenState],
  )
  const bandItems = useMemo(() => buildPulseBandItems(visiblePeople, stats), [visiblePeople, stats])

  const chartWidth = 20 + weeks.length * (BAR_W + BAR_GAP) + 20
  const maxWeekTotal = Math.max(...weeks.map((w) => w.wonDollars + w.waitDollars + w.lostDollars), 1)
  const scaleH = (v: number) => Math.sqrt(v / maxWeekTotal) * (CHART_H - CHART_TOP - CHART_BOTTOM)

  const wonPctCount = stats.decidedCount > 0 ? ((100 * stats.wonCount) / stats.decidedCount).toFixed(1) + '%' : '—'
  const wonPctDollars =
    stats.decidedDollars > 0 ? ((100 * stats.wonDollars) / stats.decidedDollars).toFixed(1) + '%' : '—'

  return (
    <div style={{ marginTop: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>
      {/* 1 · The pulse */}
      <div>
        <h3 style={{ fontSize: '1rem', fontWeight: 600, margin: '0 0 0.15rem 0' }}>The pulse</h3>
        <p style={{ margin: '0 0 0.6rem', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
          Everything sent, and what has happened to it since. One bar per week, oldest → newest; each bar splits by the
          bids&rsquo; <i>current</i> outcome. Click a bar for its bids.
        </p>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
            gap: '0.6rem',
            marginBottom: '0.8rem',
          }}
        >
          <StatCard label="Sent" value={String(stats.sentCount)} sub={`${formatPulseMoney(stats.sentDollars)} total`} />
          <StatCard label="Last 4 weeks" value={String(stats.last4Count)} sub={`${formatPulseMoney(stats.last4Dollars)} sent`} />
          <StatCard label="Won rate (count)" value={wonPctCount} sub={`${stats.wonCount} of ${stats.decidedCount} decided`} />
          <StatCard
            label="Won rate ($)"
            value={wonPctDollars}
            sub={`${formatPulseMoney(stats.wonDollars)} of ${formatPulseMoney(stats.decidedDollars)}`}
          />
          <StatCard
            label="Still waiting"
            value={String(stats.waitingCount)}
            sub={`${formatPulseMoney(stats.waitingDollars)} outstanding`}
          />
        </div>
        {weeks.every((w) => w.count === 0) ? (
          <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.875rem' }}>
            No sent bids in the last {windowWeeks} weeks for this view.
          </p>
        ) : (
          <>
            <div style={{ overflowX: 'auto', border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface)' }}>
              <svg width={chartWidth} height={CHART_H} role="img" aria-label="Weekly sent dollars, split by current outcome">
                {weeks.map((w, i) => {
                  const total = w.wonDollars + w.waitDollars + w.lostDollars
                  const x = 20 + i * (BAR_W + BAR_GAP)
                  const totalH = total > 0 ? Math.max(3, scaleH(total)) : 0
                  let y = CHART_H - CHART_BOTTOM
                  const segs: Array<{ color: string; v: number }> = [
                    { color: STATUS_COLORS.lost, v: w.lostDollars },
                    { color: STATUS_COLORS.wait, v: w.waitDollars },
                    { color: STATUS_COLORS.won, v: w.wonDollars },
                  ]
                  const label = `${w.weekTitle ?? w.dateRange} · ${w.dateRange}: ${w.count} sent, ${formatPulseMoney(total)}`
                  return (
                    <g key={w.weekStart}>
                      {segs.map((s, si) => {
                        if (s.v <= 0 || total <= 0) return null
                        const h = (totalH * s.v) / total
                        y -= h
                        return <rect key={si} x={x} y={y} width={BAR_W} height={h} rx={1} fill={s.color} />
                      })}
                      {total > 0 ? (
                        <text
                          x={x + BAR_W / 2}
                          y={y - 6}
                          textAnchor="middle"
                          fill="var(--text-700)"
                          fontSize={9.5}
                          fontWeight={700}
                        >
                          {formatPulseMoney(total)}
                        </text>
                      ) : null}
                      {w.count > 0 ? (
                        <text x={x + BAR_W / 2} y={y - 17} textAnchor="middle" fill="var(--text-muted)" fontSize={9}>
                          {w.count}
                        </text>
                      ) : null}
                      <text
                        x={x + BAR_W / 2}
                        y={CHART_H - CHART_BOTTOM + 12}
                        textAnchor="middle"
                        fill="var(--text-muted)"
                        fontSize={8.5}
                      >
                        {w.weekTitle ? `W${w.weekTitle.replace('Week ', '')}` : ''}
                      </text>
                      {w.monthLabel ? (
                        <>
                          <line
                            x1={x - BAR_GAP / 2}
                            x2={x - BAR_GAP / 2}
                            y1={CHART_H - CHART_BOTTOM}
                            y2={CHART_H - CHART_BOTTOM + 26}
                            stroke="var(--border-strong)"
                          />
                          <text
                            x={x + 2}
                            y={CHART_H - CHART_BOTTOM + 26}
                            textAnchor="start"
                            fill="var(--text-muted)"
                            fontSize={9.5}
                            fontWeight={700}
                          >
                            {w.monthLabel}
                          </text>
                        </>
                      ) : null}
                      <rect
                        x={x}
                        y={CHART_TOP}
                        width={BAR_W}
                        height={CHART_H - CHART_TOP - CHART_BOTTOM}
                        fill="transparent"
                        style={{ cursor: w.count > 0 ? 'pointer' : 'default' }}
                        onClick={
                          w.count > 0
                            ? () => setListModal({ heading: w.weekTitle ?? w.dateRange, context: w.dateRange, bidIds: w.bidIds })
                            : undefined
                        }
                      >
                        <title>{w.count > 0 ? `${label} — click for the bids` : label}</title>
                      </rect>
                    </g>
                  )
                })}
                <line
                  x1={14}
                  x2={chartWidth - 10}
                  y1={CHART_H - CHART_BOTTOM}
                  y2={CHART_H - CHART_BOTTOM}
                  stroke="var(--border-strong)"
                />
              </svg>
            </div>
            <div
              style={{
                display: 'flex',
                gap: '1rem',
                fontSize: '0.75rem',
                color: 'var(--text-muted)',
                marginTop: '0.4rem',
                flexWrap: 'wrap',
                alignItems: 'center',
              }}
            >
              {(
                [
                  ['Won (incl. started)', STATUS_COLORS.won],
                  ['Still waiting', STATUS_COLORS.wait],
                  ['Lost', STATUS_COLORS.lost],
                ] as const
              ).map(([label, color]) => (
                <span key={label} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
                  <span aria-hidden style={{ width: 9, height: 9, borderRadius: 2, background: color, display: 'inline-block' }} />
                  {label}
                </span>
              ))}
              <span>· Bar height is √-scaled so one huge week doesn&rsquo;t flatten the rest — labels carry the true totals.</span>
            </div>
          </>
        )}
      </div>

      {/* 2 · Field band */}
      {bandItems.length > 0 ? (
        <div>
          <h3 style={{ fontSize: '1rem', fontWeight: 600, margin: '0 0 0.15rem 0' }}>Where everyone stands</h3>
          <p style={{ margin: '0 0 0.6rem', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
            One marker per person on their combined record across both roles; the dark ALL marker is the company. Dashed
            names mean fewer than {PULSE_SMALL_SAMPLE_DECIDED} decided bids — noise, not signal. Hover a name for the record.
          </p>
          <div style={{ position: 'relative', margin: '0.3rem 0 4.6rem' }}>
            <div
              style={{
                display: 'flex',
                height: 34,
                borderRadius: 8,
                overflow: 'hidden',
                border: '1px solid var(--border-strong)',
              }}
            >
              {(
                [
                  ['Charging too much', 'var(--bg-red-100)'],
                  ['Full on work', 'var(--bg-amber-100)'],
                  ['Balanced', 'var(--bg-green-100)'],
                  ['Hungry for work', 'var(--bg-amber-100)'],
                  ['Charging too little', 'var(--bg-red-100)'],
                ] as const
              ).map(([label, bg]) => (
                <div
                  key={label}
                  style={{
                    flex: 1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '0.66rem',
                    fontWeight: 700,
                    color: 'var(--text-700)',
                    background: bg,
                    minWidth: 0,
                    textAlign: 'center',
                  }}
                >
                  {label}
                </div>
              ))}
            </div>
            {bandItems.map((it) => {
              const stemColor = it.smallSample ? 'var(--text-muted)' : 'var(--text-strong)'
              return (
                <div
                  key={`${it.label}-${it.pct.toFixed(3)}`}
                  title={`${it.company ? '' : `${it.label} — `}${it.record} (${it.pct.toFixed(1)}%)${it.smallSample ? ' — small sample' : ''}`}
                  style={{
                    position: 'absolute',
                    top: '100%',
                    transform: 'translateX(-50%)',
                    textAlign: 'center',
                    left: `${Math.min(96, Math.max(4, it.pct))}%`,
                  }}
                >
                  <div aria-hidden style={{ width: 2, height: it.row === 1 ? 34 : 10, background: stemColor, margin: '0 auto' }} />
                  <div
                    style={{
                      borderRadius: 999,
                      display: 'inline-block',
                      padding: '0.08rem 0.5rem',
                      fontSize: '0.68rem',
                      fontWeight: 800,
                      whiteSpace: 'nowrap',
                      background: it.company ? 'var(--text-strong)' : 'var(--surface)',
                      color: it.company ? 'var(--surface)' : it.smallSample ? 'var(--text-muted)' : 'inherit',
                      border: `2px ${it.smallSample ? 'dashed' : 'solid'} ${stemColor}`,
                    }}
                  >
                    {it.label}
                  </div>
                </div>
              )
            })}
          </div>
          <p style={{ margin: '-3.4rem 0 0', fontSize: '0.7rem', color: 'var(--text-muted)' }}>
            0% – 100% Won rate (decided bids only; Won includes Started or complete).
          </p>
        </div>
      ) : null}

      {/* 3 · People */}
      {people.length > 0 ? (
        <div>
          <h3 style={{ fontSize: '1rem', fontWeight: 600, margin: '0 0 0.15rem 0' }}>People</h3>
          <p style={{ margin: '0 0 0.6rem', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
            One card per person — estimator and account-manager sides together. The header counts each bid once even when
            they hold both roles. W / L / ⏳ click through to the bids; hover a role line for the full record. Hide
            someone with the ✕ on their card; bring them back from the Hidden row.
          </p>
          {hiddenChips.length > 0 ? (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.45rem',
                flexWrap: 'wrap',
                margin: '0 0 0.8rem',
                fontSize: '0.75rem',
                color: 'var(--text-muted)',
              }}
            >
              <span style={{ fontWeight: 600 }}>Hidden:</span>
              {hiddenChips.map((c) => (
                <button
                  key={c.userId}
                  type="button"
                  onClick={() => updateHiddenState(withPulsePersonHidden(hiddenState, c.userId, c.archived, false))}
                  title={`Show ${c.label} again`}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.35rem',
                    border: '1px dashed var(--border-strong)',
                    borderRadius: 999,
                    padding: '0.14rem 0.6rem',
                    background: 'var(--bg-subtle)',
                    color: 'var(--text-700)',
                    font: 'inherit',
                    fontSize: '0.72rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  <span aria-hidden style={{ color: 'var(--text-blue-800)', fontWeight: 700 }}>
                    +
                  </span>
                  {c.label}
                  {c.archived ? (
                    <span
                      style={{
                        fontWeight: 500,
                        color: 'var(--text-amber-800)',
                        background: 'var(--bg-amber-100)',
                        borderRadius: 4,
                        padding: '0 0.3rem',
                        fontSize: '0.62rem',
                      }}
                    >
                      archived
                    </span>
                  ) : null}
                </button>
              ))}
              {hiddenChips.length > 1 ? (
                <button
                  type="button"
                  onClick={() => updateHiddenState(withAllPulsePeopleShown(hiddenState, hiddenChips))}
                  style={{
                    border: '1px dashed var(--border-strong)',
                    borderRadius: 999,
                    padding: '0.14rem 0.6rem',
                    background: 'var(--bg-subtle)',
                    color: 'var(--text-700)',
                    font: 'inherit',
                    fontSize: '0.72rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  Show all
                </button>
              ) : null}
            </div>
          ) : null}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '0.85rem' }}>
            {visiblePeople.map((p) => (
              <PersonCard
                key={p.userId}
                person={p}
                onOpenList={setListModal}
                onHide={() => {
                  const archived = directory.get(p.userId)?.archived ?? false
                  updateHiddenState(withPulsePersonHidden(hiddenState, p.userId, archived, true))
                }}
              />
            ))}
          </div>
          <p style={{ margin: '0.7rem 0 0', fontSize: '0.7rem', color: 'var(--text-muted)' }}>
            Hidden people still count in the company totals, the weekly chart, and the ALL marker — hiding only clears
            their card and band marker from your view.
          </p>
        </div>
      ) : (
        <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.875rem' }}>
          No estimator or account manager assigned on these bids.
        </p>
      )}

      <BidBoardWeeklySentCellModal
        open={listModal != null}
        onClose={() => setListModal(null)}
        weekLabel={listModal?.context ?? ''}
        estimatorDisplayName={listModal?.heading ?? ''}
        bidIds={listModal?.bidIds ?? []}
        bids={filteredBids}
      />
    </div>
  )
}
