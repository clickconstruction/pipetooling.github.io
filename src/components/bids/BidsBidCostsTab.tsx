import { useMemo, useState, type CSSProperties, type ReactNode } from 'react'
import type { BidWithBuilder } from '../../types/bidWithBuilder'
import type { TeamLaborBidRow } from '../../utils/teamLabor'
import { calendarYmdInAppTzFromIso } from '../../utils/dateUtils'
import { formatCurrency } from '../../lib/format'
import type { BidAssignedCosts } from '../../lib/bids/bidAssignedCosts'
import {
  DEFAULT_PURSUIT_FILTER,
  PURSUIT_OUTCOMES,
  PURSUIT_OUTCOME_LABELS,
  PURSUIT_WINDOWS,
  buildPursuitRows,
  filterPursuitRows,
  formatPursuitHours,
  formatPursuitPeople,
  formatUsdShort,
  pursuitByEstimator,
  pursuitByOutcome,
  pursuitRowsInWindow,
  pursuitSummary,
  type PursuitFilter,
  type PursuitOutcome,
  type PursuitRow,
  type PursuitWindow,
} from '../../lib/bids/bidPursuit'
import { COST_TO_WIN_GROUP_LABELS, costToWinRows, costToWinTotal, costToWinWords, type CostToWinGroup, type CostToWinRow } from '../../lib/bids/bidCostToWin'

/**
 * Bids → Bid Costs — the Pursuit ledger (v2.3336). What it costs us to bid:
 * clocked estimating time at recorded wages, plus card charges and materials
 * moved onto a bid from a job. One table with the outcome as a filter, a
 * summary strip, and an estimator rail. Every number comes from the pure
 * kernel in `bidPursuit.ts`; this file only lays it out.
 *
 * `showDollars` is the role gate for wages: dev, master and controller read
 * dollars; assistants and estimators read the same ledger in hours.
 *
 * Two lenses (v2.3341): **Pursuit** (the ledger) and **Cost to win** (the
 * economics by estimator or by GC — `bidCostToWin.ts`). A Cost-to-win row
 * opens the ledger filtered to that person or GC.
 */
type Lens = 'pursuit' | 'cost-to-win'
type BidsBidCostsTabProps = {
  bids: BidWithBuilder[]
  teamLaborData: TeamLaborBidRow[]
  /** Costs migrated onto bids (v2.1165 mirrors), keyed by bid id. */
  bidAssignedCosts: Map<string, BidAssignedCosts>
  onSelectBid: (bid: BidWithBuilder) => void
  showDollars: boolean
}

const OUTCOME_COLORS: Record<PursuitOutcome, { fg: string; bg: string }> = {
  open: { fg: '#b8801f', bg: 'rgba(184, 128, 31, 0.14)' },
  won: { fg: '#1e8a57', bg: 'rgba(30, 138, 87, 0.14)' },
  lost: { fg: '#c64b3a', bg: 'rgba(198, 75, 58, 0.14)' },
  unsent: { fg: 'var(--text-muted)', bg: 'var(--bg-subtle)' },
}

const usd = (n: number): string => `$${formatCurrency(n)}`
const pct = (r: number | null): string => (r == null ? '—' : `${Math.round(r * 100)}%`)

const cellStyle: CSSProperties = { padding: '0.5rem 0.6rem', borderBottom: '1px solid var(--border)', verticalAlign: 'top', whiteSpace: 'nowrap' }
const numStyle: CSSProperties = { ...cellStyle, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }
const thStyle: CSSProperties = { padding: '0.5rem 0.6rem', textAlign: 'left', borderBottom: '1px solid var(--border)', fontSize: '0.75rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }
const thNum: CSSProperties = { ...thStyle, textAlign: 'right' }
const subStyle: CSSProperties = { display: 'block', color: 'var(--text-muted)', fontSize: '0.72rem', whiteSpace: 'normal' }
const tileStyle: CSSProperties = { border: '1px solid var(--border)', borderRadius: 6, padding: '0.6rem 0.75rem', background: 'var(--surface)' }
const tileN: CSSProperties = { display: 'block', fontSize: '1.25rem', fontWeight: 600, fontVariantNumeric: 'tabular-nums', lineHeight: 1.2 }
const tileL: CSSProperties = { fontSize: '0.75rem', color: 'var(--text-muted)' }
const chipBase: CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 4, borderRadius: 999, padding: '2px 9px', fontSize: '0.75rem', border: '1px solid var(--border)', background: 'none', color: 'inherit', cursor: 'pointer', whiteSpace: 'nowrap' }

function OutcomeChip({ outcome }: { outcome: PursuitOutcome }) {
  const c = OUTCOME_COLORS[outcome]
  return <span style={{ ...chipBase, cursor: 'default', border: 'none', color: c.fg, background: c.bg, fontWeight: 500 }}>{PURSUIT_OUTCOME_LABELS[outcome]}</span>
}

export function BidsBidCostsTab({ bids, teamLaborData, bidAssignedCosts, onSelectBid, showDollars }: BidsBidCostsTabProps) {
  const [filter, setFilter] = useState<PursuitFilter>(DEFAULT_PURSUIT_FILTER)
  const [lens, setLens] = useState<Lens>('pursuit')
  const [group, setGroup] = useState<CostToWinGroup>('estimator')
  const todayYmd = useMemo(() => calendarYmdInAppTzFromIso(new Date().toISOString()), [])

  const bidById = useMemo(() => new Map(bids.map((b) => [b.id, b])), [bids])
  const laborByBid = useMemo(() => new Map(teamLaborData.map((r) => [r.bidId, r])), [teamLaborData])
  const rows = useMemo(() => buildPursuitRows({ bids, laborByBid, assignedByBid: bidAssignedCosts }), [bids, laborByBid, bidAssignedCosts])

  const inWindow = useMemo(() => pursuitRowsInWindow(rows, filter.window, todayYmd, filter.showRobots), [rows, filter.window, filter.showRobots, todayYmd])
  const summary = useMemo(() => pursuitSummary(inWindow), [inWindow])
  const byEstimator = useMemo(() => pursuitByEstimator(inWindow), [inWindow])
  const byOutcome = useMemo(() => pursuitByOutcome(inWindow), [inWindow])
  const shown = useMemo(() => filterPursuitRows(rows, filter, todayYmd), [rows, filter, todayYmd])
  const costToWin = useMemo(() => costToWinRows(inWindow, group), [inWindow, group])
  const costToWinAll = useMemo(() => costToWinTotal(inWindow), [inWindow])

  const outcomeCounts = useMemo(() => {
    const counts: Record<PursuitOutcome, number> = { unsent: 0, open: 0, won: 0, lost: 0 }
    for (const r of inWindow) if (filter.showEmpty || r.totalUsd > 0 || r.hours > 0) counts[r.outcome]++
    return counts
  }, [inWindow, filter.showEmpty])
  const emptyCount = useMemo(() => inWindow.filter((r) => !(r.totalUsd > 0 || r.hours > 0)).length, [inWindow])
  const robotCount = useMemo(() => rows.filter((r) => r.robot).length, [rows])
  const anyMaterials = useMemo(() => shown.some((r) => r.materialsUsd > 0), [shown])
  const anyCards = useMemo(() => shown.some((r) => r.cardUsd > 0), [shown])

  const totals = useMemo(() => shown.reduce((t, r) => ({ hours: t.hours + r.hours, usd: t.usd + r.totalUsd, card: t.card + r.cardUsd, materials: t.materials + r.materialsUsd, value: t.value + (r.bidValue ?? 0) }), { hours: 0, usd: 0, card: 0, materials: 0, value: 0 }), [shown])

  const toggleOutcome = (o: PursuitOutcome) =>
    setFilter((f) => {
      const next = new Set(f.outcomes)
      if (next.has(o)) next.delete(o)
      else next.add(o)
      return { ...f, outcomes: next }
    })

  const windowLabel = PURSUIT_WINDOWS.find((w) => w.key === filter.window)?.label ?? ''
  const maxEstimator = byEstimator[0]?.usd || byEstimator[0]?.hours || 1
  const openLedgerFor = (row: CostToWinRow) => {
    setFilter((f) => ({ ...f, estimator: group === 'estimator' ? row.key : null, gc: group === 'gc' ? row.key : null, outcomes: new Set(PURSUIT_OUTCOMES), showEmpty: false }))
    setLens('pursuit')
  }
  const windowSeg = (
    <span role="group" aria-label="Window" style={{ display: 'inline-flex', border: '1px solid var(--border)', borderRadius: 5, overflow: 'hidden' }}>
      {PURSUIT_WINDOWS.map((w) => (
        <button key={w.key} type="button" aria-pressed={filter.window === w.key} onClick={() => setFilter((f) => ({ ...f, window: w.key as PursuitWindow }))} style={{ border: 'none', background: filter.window === w.key ? 'var(--bg-subtle)' : 'none', color: filter.window === w.key ? 'inherit' : 'var(--text-muted)', fontWeight: filter.window === w.key ? 600 : 400, padding: '4px 9px', cursor: 'pointer' }}>
          {w.label}
        </button>
      ))}
    </span>
  )
  const robotsBox = (
    <label style={{ color: 'var(--text-muted)', display: 'inline-flex', gap: 4, alignItems: 'center' }}>
      <input type="checkbox" checked={filter.showRobots} onChange={(e) => setFilter((f) => ({ ...f, showRobots: e.target.checked }))} /> robot bids ({robotCount})
    </label>
  )

  return (
    <div>
      <h2 style={{ margin: '0 0 0.25rem', fontSize: '1.25rem' }}>Bid Costs</h2>
      <p style={{ margin: '0 0 0.75rem', color: 'var(--text-muted)', fontSize: '0.875rem' }}>
        {lens === 'pursuit'
          ? <>What it costs us to bid: clocked estimating time{showDollars ? ' at recorded wages' : ''}, plus card charges and materials moved onto a bid from a job (Edit Job → Delete → Reassign). Robot bids and bids with no time are folded.</>
          : <>What bidding costs and what it wins, by estimator or by GC. Counts and values read every bid in the window; {showDollars ? 'spend and ' : ''}hours read the bids someone clocked against. Click a row to open the ledger for that {group === 'estimator' ? 'person' : 'GC'}.</>}
      </p>
      <div role="tablist" aria-label="Bid Costs lens" style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
        {(['pursuit', 'cost-to-win'] as const).map((l) => (
          <button key={l} type="button" role="tab" aria-selected={lens === l} onClick={() => setLens(l)} style={{ ...chipBase, padding: '4px 12px', fontSize: '0.8rem', color: lens === l ? 'var(--text-link)' : 'inherit', background: lens === l ? 'var(--bg-subtle)' : 'none', borderColor: lens === l ? 'var(--text-link)' : 'var(--border)', fontWeight: lens === l ? 600 : 400 }}>
            {l === 'pursuit' ? 'Pursuit' : 'Cost to win'}
          </button>
        ))}
      </div>

      {lens === 'cost-to-win' && (
        <CostToWinView rows={costToWin} total={costToWinAll} group={group} onGroup={setGroup} showDollars={showDollars} windowSeg={windowSeg} robotsBox={robotsBox} windowLabel={windowLabel} onOpen={openLedgerFor} />
      )}

      {lens === 'pursuit' && (<>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 10, marginBottom: 14 }}>
        <div style={tileStyle}>
          <span style={tileN}>{showDollars ? formatUsdShort(summary.spendUsd) : `${Math.round(summary.hours)} h`}</span>
          <span style={tileL}>{showDollars ? `spent bidding · ${Math.round(summary.hours)} h` : 'clocked against bids'}</span>
          <span style={{ ...tileL, display: 'block' }}>{windowLabel.toLowerCase()} · {summary.bidsWithTime} bid{summary.bidsWithTime === 1 ? '' : 's'} with time</span>
        </div>
        <div style={tileStyle}>
          <span style={tileN}>{summary.perBidUsd == null ? '—' : showDollars ? `${usd(summary.perBidUsd)} · ${summary.perBidHours!.toFixed(1)} h` : `${summary.perBidHours!.toFixed(1)} h`}</span>
          <span style={tileL}>per bid with time</span>
        </div>
        <div style={tileStyle}>
          <span style={tileN}>{formatUsdShort(summary.wonValue)} won</span>
          <span style={tileL}>of {formatUsdShort(summary.wonValue + summary.lostValue)} decided · {pct(summary.hitRateByValue)} by value</span>
          <span style={{ ...tileL, display: 'block' }}>{formatUsdShort(summary.openValue)} still open</span>
        </div>
        <div style={tileStyle}>
          <span style={tileN}>{showDollars ? formatUsdShort(summary.lostSpendUsd) : `${Math.round(summary.lostHours)} h`}</span>
          <span style={tileL}>{showDollars ? 'spent on bids we lost' : 'on bids we lost'}</span>
          <span style={{ ...tileL, display: 'block' }}>{showDollars ? `${Math.round(summary.lostHours)} h · ` : ''}{summary.lostBids} bid{summary.lostBids === 1 ? '' : 's'}{summary.lostSpendShare != null ? ` · ${pct(summary.lostSpendShare)} of spend` : ''}</span>
        </div>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', marginBottom: 12, fontSize: '0.8rem' }}>
        {windowSeg}
        {PURSUIT_OUTCOMES.map((o) => {
          const on = filter.outcomes.has(o)
          const c = OUTCOME_COLORS[o]
          return (
            <button key={o} type="button" aria-pressed={on} onClick={() => toggleOutcome(o)} style={{ ...chipBase, color: on ? c.fg : 'var(--text-muted)', background: on ? c.bg : 'none', borderColor: on ? 'transparent' : 'var(--border)', fontWeight: on ? 500 : 400 }}>
              {PURSUIT_OUTCOME_LABELS[o]} · {outcomeCounts[o]}
            </button>
          )
        })}
        <label style={{ color: 'var(--text-muted)', display: 'inline-flex', gap: 4, alignItems: 'center' }}>
          <input type="checkbox" checked={filter.showEmpty} onChange={(e) => setFilter((f) => ({ ...f, showEmpty: e.target.checked }))} /> bids with no time ({emptyCount})
        </label>
        {robotsBox}
        {filter.estimator != null && (
          <button type="button" onClick={() => setFilter((f) => ({ ...f, estimator: null }))} style={{ ...chipBase, borderColor: 'var(--text-link)', color: 'var(--text-link)' }} title="Clear the estimator filter">
            {filter.estimator || 'No estimator'} ×
          </button>
        )}
        {filter.gc != null && (
          <button type="button" onClick={() => setFilter((f) => ({ ...f, gc: null }))} style={{ ...chipBase, borderColor: 'var(--text-link)', color: 'var(--text-link)' }} title="Clear the GC filter">
            {filter.gc || 'No GC'} ×
          </button>
        )}
        <input type="search" value={filter.query} onChange={(e) => setFilter((f) => ({ ...f, query: e.target.value }))} placeholder="Search bids…" aria-label="Search bids" style={{ marginLeft: 'auto', minWidth: 180, padding: '4px 10px', border: '1px solid var(--border)', borderRadius: 5, background: 'var(--surface)', color: 'inherit', fontSize: '0.8rem' }} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 250px', gap: 14, alignItems: 'start' }} className="bid-costs-grid">
        <div style={{ border: '1px solid var(--border)', borderRadius: 6, overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
            <thead style={{ background: 'var(--bg-subtle)' }}>
              <tr>
                <th style={thStyle}>Bid</th>
                <th style={thStyle}>Estimator</th>
                <th style={thNum}>Time</th>
                {showDollars && <th style={thNum}>Cost to bid</th>}
                {showDollars && anyCards && <th style={thNum}>Card charges</th>}
                {showDollars && anyMaterials && <th style={thNum}>Materials</th>}
                <th style={thNum}>Bid value</th>
                {showDollars && <th style={thNum} title="Pursuit dollars per $1,000 of bid value">$ per $1k bid</th>}
                <th style={thStyle}>Outcome</th>
              </tr>
            </thead>
            <tbody>
              {shown.length === 0 ? (
                <tr><td colSpan={9} style={{ ...cellStyle, color: 'var(--text-muted)', whiteSpace: 'normal' }}>No bids match — widen the window or turn an outcome back on.</td></tr>
              ) : (
                shown.map((r) => (
                  <PursuitRowView key={r.bidId} row={r} showDollars={showDollars} anyCards={anyCards} anyMaterials={anyMaterials} onClick={() => { const b = bidById.get(r.bidId); if (b) onSelectBid(b) }} />
                ))
              )}
              {shown.length > 0 && (
                <tr style={{ background: 'var(--bg-subtle)', fontWeight: 600 }}>
                  <td style={cellStyle}>{shown.length} bid{shown.length === 1 ? '' : 's'}</td>
                  <td style={cellStyle} />
                  <td style={numStyle}>{Math.round(totals.hours)} h</td>
                  {showDollars && <td style={numStyle}>{usd(totals.usd)}</td>}
                  {showDollars && anyCards && <td style={numStyle}>{usd(totals.card)}</td>}
                  {showDollars && anyMaterials && <td style={numStyle}>{usd(totals.materials)}</td>}
                  <td style={numStyle}>{totals.value > 0 ? formatUsdShort(totals.value) : '—'}</td>
                  {showDollars && <td style={numStyle}>{totals.value > 0 && totals.usd > 0 ? (totals.usd / (totals.value / 1000)).toFixed(2) : '—'}</td>}
                  <td style={cellStyle} />
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div style={{ border: '1px solid var(--border)', borderRadius: 6, padding: '0.6rem 0.75rem', fontSize: '0.8rem' }}>
          <div style={{ fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)', fontWeight: 600, marginBottom: 6 }}>By estimator · {windowLabel.toLowerCase()}</div>
          {byEstimator.length === 0 ? (
            <div style={{ color: 'var(--text-muted)' }}>No clocked time in this window.</div>
          ) : (
            byEstimator.map((e) => {
              const on = filter.estimator === e.key
              const share = (showDollars ? e.usd : e.hours) / (showDollars ? maxEstimator : byEstimator[0]!.hours || 1)
              return (
                <button key={e.key} type="button" aria-pressed={on} onClick={() => setFilter((f) => ({ ...f, estimator: on ? null : e.key }))} title={`Only ${e.label}'s bids`} style={{ display: 'block', width: '100%', textAlign: 'left', border: 'none', background: on ? 'var(--bg-subtle)' : 'none', color: 'inherit', padding: '5px 4px', cursor: 'pointer', borderRadius: 4 }}>
                  <span style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                    <span>{e.label}<span style={subStyle}>{e.bids} bid{e.bids === 1 ? '' : 's'} · {Math.round(e.hours)} h</span></span>
                    <span style={{ fontVariantNumeric: 'tabular-nums' }}>{showDollars ? usd(e.usd) : `${Math.round(e.hours)} h`}</span>
                  </span>
                  <span style={{ display: 'block', height: 4, background: 'var(--bg-subtle)', borderRadius: 2, marginTop: 4, overflow: 'hidden' }}>
                    <span style={{ display: 'block', height: '100%', width: `${Math.max(2, Math.round(share * 100))}%`, background: 'var(--text-link)' }} />
                  </span>
                </button>
              )
            })
          )}
          <div style={{ fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)', fontWeight: 600, margin: '14px 0 6px' }}>By outcome</div>
          {PURSUIT_OUTCOMES.map((o) => (
            <div key={o} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, padding: '4px 4px', borderTop: '1px solid var(--border)' }}>
              <span><OutcomeChip outcome={o} /> <span style={{ color: 'var(--text-muted)', fontSize: '0.72rem' }}>{byOutcome[o].bids} bid{byOutcome[o].bids === 1 ? '' : 's'}</span></span>
              <span style={{ fontVariantNumeric: 'tabular-nums' }}>{showDollars ? usd(byOutcome[o].usd) : `${Math.round(byOutcome[o].hours)} h`}</span>
            </div>
          ))}
        </div>
      </div>
      </>)}
      <style>{`@media (max-width: 860px) { .bid-costs-grid { grid-template-columns: minmax(0, 1fr) !important; } }`}</style>
    </div>
  )
}

function CostToWinView({ rows, total, group, onGroup, showDollars, windowSeg, robotsBox, windowLabel, onOpen }: {
  rows: CostToWinRow[]
  total: CostToWinRow
  group: CostToWinGroup
  onGroup: (g: CostToWinGroup) => void
  showDollars: boolean
  windowSeg: ReactNode
  robotsBox: ReactNode
  windowLabel: string
  onOpen: (row: CostToWinRow) => void
}) {
  const decided = total.won + total.lost
  return (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 10, marginBottom: 14 }}>
        <div style={tileStyle}>
          <span style={tileN}>{showDollars ? (total.usdPerThousandWon != null ? `$${total.usdPerThousandWon.toFixed(2)}` : '—') : (total.wonValue > 0 && total.hours > 0 ? `${(total.hours / (total.wonValue / 1000)).toFixed(2)} h` : '—')}</span>
          <span style={tileL}>{showDollars ? 'spent per $1k won' : 'clocked per $1k won'}</span>
          <span style={{ ...tileL, display: 'block' }}>{showDollars ? costToWinWords(total) : `${Math.round(total.hours)} h · ${formatUsdShort(total.wonValue)} won`}</span>
        </div>
        <div style={tileStyle}>
          <span style={tileN}>{pct(total.hitRateByValue)}</span>
          <span style={tileL}>won by value · {total.won} of {decided} decided by count</span>
          <span style={{ ...tileL, display: 'block' }}>{formatUsdShort(total.wonValue)} won · {formatUsdShort(total.lostValue)} lost</span>
        </div>
        <div style={tileStyle}>
          <span style={tileN}>{total.bids}</span>
          <span style={tileL}>bids in the window · {total.bidsWithTime} with time</span>
          <span style={{ ...tileL, display: 'block' }}>{total.open} open · {total.unsent} unsent</span>
        </div>
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', marginBottom: 12, fontSize: '0.8rem' }}>
        {windowSeg}
        {(['estimator', 'gc'] as const).map((g) => (
          <button key={g} type="button" aria-pressed={group === g} onClick={() => onGroup(g)} style={{ ...chipBase, color: group === g ? 'var(--text-link)' : 'var(--text-muted)', borderColor: group === g ? 'var(--text-link)' : 'var(--border)', fontWeight: group === g ? 600 : 400 }}>
            {COST_TO_WIN_GROUP_LABELS[g]}
          </button>
        ))}
        {robotsBox}
      </div>
      <div style={{ border: '1px solid var(--border)', borderRadius: 6, overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
          <thead style={{ background: 'var(--bg-subtle)' }}>
            <tr>
              <th style={thStyle}>{group === 'estimator' ? 'Estimator' : 'GC'}</th>
              <th style={thNum}>Bids</th>
              <th style={thNum}>With time</th>
              <th style={thNum}>Hours</th>
              {showDollars && <th style={thNum}>Spent bidding</th>}
              <th style={thNum}>Won</th>
              <th style={thNum}>Lost</th>
              <th style={thNum}>Open</th>
              <th style={thNum}>Won value</th>
              <th style={thNum} title="won ÷ (won + lost), by value">Hit rate</th>
              {showDollars && <th style={thNum} title="Pursuit dollars per $1,000 of value won">$ per $1k won</th>}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr><td colSpan={11} style={{ ...cellStyle, color: 'var(--text-muted)', whiteSpace: 'normal' }}>No bids in this window.</td></tr>
            ) : (
              rows.map((r) => (
                <tr key={r.key} onClick={() => onOpen(r)} style={{ cursor: 'pointer' }} title={`Open the ledger for ${r.label}`}>
                  <td style={{ ...cellStyle, whiteSpace: 'normal' }}>{r.label}</td>
                  <td style={numStyle}>{r.bids}</td>
                  <td style={numStyle}>{r.bidsWithTime || '—'}</td>
                  <td style={numStyle}>{r.hours > 0 ? Math.round(r.hours) : '—'}</td>
                  {showDollars && <td style={numStyle}>{r.usd > 0 ? usd(r.usd) : '—'}</td>}
                  <td style={numStyle}>{r.won || '—'}</td>
                  <td style={numStyle}>{r.lost || '—'}</td>
                  <td style={numStyle}>{r.open || '—'}</td>
                  <td style={numStyle}>{r.wonValue > 0 ? formatUsdShort(r.wonValue) : '—'}</td>
                  <td style={numStyle}>{pct(r.hitRateByValue)}</td>
                  {showDollars && <td style={numStyle}>{r.usdPerThousandWon != null ? r.usdPerThousandWon.toFixed(2) : '—'}</td>}
                </tr>
              ))
            )}
            {rows.length > 0 && (
              <tr style={{ background: 'var(--bg-subtle)', fontWeight: 600 }}>
                <td style={cellStyle}>Everyone · {windowLabel.toLowerCase()}</td>
                <td style={numStyle}>{total.bids}</td>
                <td style={numStyle}>{total.bidsWithTime}</td>
                <td style={numStyle}>{Math.round(total.hours)}</td>
                {showDollars && <td style={numStyle}>{usd(total.usd)}</td>}
                <td style={numStyle}>{total.won}</td>
                <td style={numStyle}>{total.lost}</td>
                <td style={numStyle}>{total.open}</td>
                <td style={numStyle}>{formatUsdShort(total.wonValue)}</td>
                <td style={numStyle}>{pct(total.hitRateByValue)}</td>
                {showDollars && <td style={numStyle}>{total.usdPerThousandWon != null ? total.usdPerThousandWon.toFixed(2) : '—'}</td>}
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  )
}

function PursuitRowView({ row: r, showDollars, anyCards, anyMaterials, onClick }: { row: PursuitRow; showDollars: boolean; anyCards: boolean; anyMaterials: boolean; onClick: () => void }) {
  return (
    <tr onClick={onClick} style={{ cursor: 'pointer' }} title="Select this bid across the workflow tabs">
      <td style={{ ...cellStyle, whiteSpace: 'normal' }}>
        {r.label}
        {r.gcName && <span style={subStyle}>{r.gcName}</span>}
      </td>
      <td style={cellStyle}>{r.estimatorName ?? '—'}</td>
      <td style={numStyle}>
        {r.hours > 0 ? formatPursuitHours(r.hours) : '—'}
        {r.people.length > 0 && (r.people.length > 1 || r.people[0]!.name !== r.estimatorName) && <span style={{ ...subStyle, textAlign: 'right' }}>{formatPursuitPeople(r.people)}</span>}
      </td>
      {showDollars && <td style={numStyle}>{r.totalUsd > 0 ? usd(r.totalUsd) : '—'}</td>}
      {showDollars && anyCards && <td style={numStyle}>{r.cardUsd > 0 ? usd(r.cardUsd) : '—'}</td>}
      {showDollars && anyMaterials && <td style={numStyle}>{r.materialsUsd > 0 ? usd(r.materialsUsd) : '—'}</td>}
      <td style={numStyle}>{r.bidValue != null ? usd(r.bidValue) : '—'}</td>
      {showDollars && <td style={numStyle}>{r.usdPerThousandBid != null ? r.usdPerThousandBid.toFixed(2) : '—'}</td>}
      <td style={cellStyle}><OutcomeChip outcome={r.outcome} /></td>
    </tr>
  )
}
