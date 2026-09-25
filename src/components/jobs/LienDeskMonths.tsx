import type { ReactNode } from 'react'
import { workMonthLabel, workMonthShort } from '../../lib/jobs/forecastWorkMonths'
import { formatYmdMonthDay } from '../../lib/jobs/billedExpectedPay'
import { DATED_FROM_CREATION_WORDS } from '../../lib/jobs/lienDesk'
import { formatUsdNoCents } from '../../lib/jobs/jobFormatting'
import { documentLinkWords } from '../../lib/jobs/lienFilingDocumentLink'
import { lienGridPaperTitle, lienGridPaperWords, type LienGridRow, type LienMonthGrid } from '../../lib/jobs/lienMonthGrid'
import { lienNoticeOpensOn } from '../../lib/jobs/lienTimeline'
import { daysBetweenYmd } from '../../lib/jobs/billedExpectedPay'
import { useLienTimelineView, type LienTimelineView } from '../../hooks/useLienTimelineView'

/**
 * The Lien desk's Months card — the grid (punch list #38; the tick cards and the
 * "Earlier months" dots were v2.3661). Months down, papers across: one row per month
 * the job has, with its window; one column per § 53.056 paper that went out (the
 * run's or one recorded by hand), lettered A, B…; this notice as the last column,
 * whose checks are the office's ticks. A cell is a paper that names the month —
 * "as information" when it went out after the window closed. The claim sits under it.
 * The timeline's Windows view (v2.3815) reaches the Window column: each month's first day
 * and a bar of the days already gone; Steps leaves the column as it was.
 */

/** A month the notice could name — kept for the pane's one-line summary above the grid. */
export type LienDeskMonthCard = {
  key: string
  on: boolean
  locked: boolean
  hours: number
  crew: string
  deadline: string
  daysLeft: number
  noticed: boolean
  closed: boolean
  fromCreation?: boolean
}

const METHOD_LABELS: Record<string, string> = { certified_mail: 'certified mail', mail: 'mail', traceable_courier: 'courier', email: 'email', hand: 'hand delivery' }

function daysLeftWords(d: number): string {
  if (d === 0) return 'due today'
  if (d === 1) return 'due tomorrow'
  return `${d} days left`
}

const chip = (bg: string, fg: string): React.CSSProperties => ({ display: 'inline-block', padding: '0 7px', borderRadius: 999, fontSize: '0.7rem', fontWeight: 700, lineHeight: '18px', background: bg, color: fg, whiteSpace: 'nowrap' })
const th: React.CSSProperties = { textAlign: 'left', fontWeight: 600, color: 'var(--text-muted)', fontSize: '0.62rem', letterSpacing: '0.04em', textTransform: 'uppercase', padding: '0.3rem 0.5rem', borderBottom: '1px solid var(--border)', verticalAlign: 'bottom' }
const td: React.CSSProperties = { padding: '0.45rem 0.5rem', borderBottom: '1px solid var(--border)', verticalAlign: 'top', fontSize: '0.8125rem' }
const faint: React.CSSProperties = { color: 'var(--text-muted)', fontSize: '0.72rem' }

/** The Windows view's bar: how much of a month's window is gone (v2.3815). */
function spentBar(usedPct: number, gone: boolean): ReactNode {
  return (
    <div aria-hidden data-lien-month-spent style={{ position: 'relative', height: 6, maxWidth: 180, margin: '4px 0 2px', borderRadius: 3, border: `1px solid ${gone ? 'var(--text-red-600)' : 'var(--text-amber-800)'}`, background: gone ? 'var(--bg-red-tint)' : 'var(--bg-amber-tint)', overflow: 'hidden' }}>
      <span style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${Math.max(0, Math.min(100, usedPct))}%`, background: gone ? 'var(--text-red-600)' : 'var(--text-amber-800)', opacity: 0.55 }} />
    </div>
  )
}

function windowCell(r: LienGridRow, onNoteMissed: ((month: string) => void) | undefined, view: LienTimelineView): ReactNode {
  const w = r.window
  const opensOn = view === 'windows' ? lienNoticeOpensOn(r.month) : ''
  const totalDays = opensOn && w.deadline ? daysBetweenYmd(opensOn, w.deadline) : null
  if (w.state === 'none') return <><span style={chip('var(--bg-muted)', 'var(--text-muted)')}>not a work month yet</span>{w.deadline ? <div style={faint}>would be due {formatYmdMonthDay(w.deadline)}</div> : null}</>
  if (w.state === 'open') {
    if (opensOn && totalDays != null && totalDays > 0 && w.daysLeft != null) {
      const left = Math.min(totalDays, w.daysLeft)
      return (
        <>
          <span style={{ fontWeight: 700, color: 'var(--text-strong)' }}>{w.daysLeft <= totalDays ? 'open since' : 'opens'} {formatYmdMonthDay(opensOn)}</span>{' '}
          <span style={chip('var(--bg-blue-tint)', 'var(--text-blue-700)')}>mail by {formatYmdMonthDay(w.deadline)}</span>
          {spentBar(((totalDays - left) / totalDays) * 100, false)}
          <div style={faint}>{left} of {totalDays} days left</div>
        </>
      )
    }
    return <><span style={chip('var(--bg-blue-tint)', 'var(--text-blue-700)')}>mail by {formatYmdMonthDay(w.deadline)}</span>{w.daysLeft != null ? <div style={faint}>{daysLeftWords(w.daysLeft)}</div> : null}</>
  }
  // closed
  if (w.skipped) return <><span style={chip('var(--bg-amber-tint)', 'var(--text-amber-800)')}>skipped</span><div style={faint}>{w.skippedBy ? `${w.skippedBy}: ` : ''}“{w.skipReason}”</div></>
  if (w.noticed) return <><span style={chip('var(--bg-muted)', 'var(--text-muted)')}>closed {formatYmdMonthDay(w.deadline)}</span><div style={faint}>named after the window — information</div></>
  return (
    <>
      <span style={chip('var(--bg-red-tint)', 'var(--text-red-700)')}>closed {w.deadline ? formatYmdMonthDay(w.deadline) : ''}</span>{' '}
      {w.noted ? <span style={faint}>noted{w.notedBy ? ` by ${w.notedBy}` : ''}{w.notedAt ? ` ${formatYmdMonthDay(w.notedAt.slice(0, 10))}` : ''}</span> : <span style={chip('var(--bg-amber-tint)', 'var(--text-amber-800)')}>not noted</span>}
      {opensOn && w.deadline ? spentBar(100, true) : null}
      <div style={faint}>
        {opensOn && w.deadline ? `it was open ${formatYmdMonthDay(opensOn)} → ${formatYmdMonthDay(w.deadline)} · ` : ''}lien right gone · the money still rides
        {!w.noted && onNoteMissed ? (
          <>
            {' · '}
            <button type="button" onClick={() => onNoteMissed(r.month)} data-lien-desk-note-missed style={{ padding: '1px 8px', borderRadius: 6, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--text-700)', fontWeight: 600, fontSize: '0.7rem', cursor: 'pointer' }} title="Write the closed window down with your name — not a skip, just that it was seen">
              Note it as missed
            </button>
          </>
        ) : null}
      </div>
    </>
  )
}

export default function LienDeskMonths({
  grid,
  claim,
  onToggle,
  onNoteMissed,
  claimNode,
  claimTail,
  onPreviewThis,
  onRecordByHand,
  tail,
}: {
  grid: LienMonthGrid
  claim: string
  onToggle: (key: string, on: boolean) => void
  /** Write a closed window down (v2.3679) — the office's door; absent for a role that cannot. */
  onNoteMissed?: (month: string) => void
  /** The claim box, corrected by hand (v2.3682) — replaces the plain figure when given. */
  claimNode?: ReactNode
  /** One line under the claim (v2.3753): the retainage named inside it, or the door to record it. */
  claimTail?: ReactNode
  /** Read this notice as the paper prints it. */
  onPreviewThis?: () => void
  /** A paper that went out by hand (v2.3770) — record it, and it becomes a column. */
  onRecordByHand?: () => void
  /** Lines under the grid beside the claim — the affidavit's state, for one. */
  tail?: ReactNode
}) {
  const view = useLienTimelineView()
  const filings = grid.papers.filter((p) => p.kind === 'filing')
  const thisPaper = grid.papers.find((p) => p.kind === 'this') ?? null
  const onCount = grid.rows.filter((r) => r.thisNotice.on).length
  return (
    <div className="lienMonths" data-lien-desk-months data-lien-desk-month-grid>
      <div className="lienMonthsHead">
        <strong>Months on this job</strong>
        <span>Every month worked, oldest first. A check is a paper that names the month; the last column is this notice — tick a month to put it on.</span>
      </div>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0 }}>
          <thead>
            <tr>
              <th style={th}>Month</th>
              <th style={th}>Window</th>
              {filings.map((p) => (
                <th key={p.key} style={{ ...th, textTransform: 'none', letterSpacing: 0, color: 'var(--text-700)', fontSize: '0.75rem', minWidth: 150 }} data-lien-grid-paper={p.letter}>
                  <span style={{ display: 'inline-block', width: 18, height: 18, borderRadius: 4, textAlign: 'center', lineHeight: '18px', fontWeight: 800, fontSize: '0.68rem', marginRight: 5, background: 'var(--bg-green-tint)', color: 'var(--text-green-800)' }}>{p.letter}</span>
                  {lienGridPaperTitle(p, formatYmdMonthDay)}
                  <span style={{ display: 'block', fontWeight: 500, ...faint }}>
                    {lienGridPaperWords(p, formatUsdNoCents, (m) => METHOD_LABELS[m] ?? m)}
                    {p.documentUrl ? <> · <a href={p.documentUrl} target="_blank" rel="noreferrer" style={{ color: 'var(--text-link)', fontWeight: 600 }}>{documentLinkWords({ document_url: p.documentUrl, document_note: p.documentNote })} ›</a></> : null}
                  </span>
                </th>
              ))}
              {thisPaper ? (
                <th style={{ ...th, textTransform: 'none', letterSpacing: 0, color: 'var(--text-700)', fontSize: '0.75rem', minWidth: 130, background: 'var(--bg-blue-tint)', borderTop: '2px solid var(--text-blue-700)', borderRadius: '6px 6px 0 0' }} data-lien-grid-paper="this">
                  <span style={{ display: 'inline-block', width: 18, height: 18, borderRadius: 4, textAlign: 'center', lineHeight: '18px', fontWeight: 800, fontSize: '0.68rem', marginRight: 5, background: 'var(--surface)', color: 'var(--text-blue-700)' }}>{thisPaper.letter}</span>
                  This notice
                  <span style={{ display: 'block', fontWeight: 500, ...faint }}>
                    {claim}{onCount ? ` · ${onCount} ${onCount === 1 ? 'month' : 'months'}` : ''}
                    {onPreviewThis ? <> · <button type="button" onClick={onPreviewThis} style={{ border: 'none', background: 'none', color: 'var(--text-link)', fontWeight: 600, cursor: 'pointer', font: 'inherit', padding: 0 }}>Preview ›</button></> : null}
                  </span>
                </th>
              ) : null}
            </tr>
          </thead>
          <tbody>
            {grid.rows.map((r) => (
              <tr key={r.month} data-lien-grid-row={r.month} data-window={r.window.state} data-on={r.thisNotice.on ? 'yes' : 'no'} style={r.window.state === 'closed' && !r.window.noticed && !r.window.skipped ? { background: 'var(--bg-red-tint)' } : r.window.state === 'none' ? { color: 'var(--text-muted)' } : undefined}>
                <td style={td}>
                  <div style={{ fontWeight: 700 }}>{workMonthLabel(r.month)}</div>
                  <div style={faint}>{r.fromCreation ? DATED_FROM_CREATION_WORDS : r.pendingOnly ? 'sessions await approval' : <>{r.hours.toLocaleString(undefined, { maximumFractionDigits: 1 })} h{r.crew ? ` · ${r.crew}` : ''}</>}</div>
                </td>
                <td style={td}>{windowCell(r, onNoteMissed, view)}</td>
                {filings.map((p) => {
                  const c = r.cells[p.key] ?? 'blank'
                  return (
                    <td key={p.key} style={td} data-cell={c}>
                      {c === 'named' ? <span style={{ color: 'var(--text-green-800)', fontWeight: 800 }}>✓</span> : c === 'info' ? <span style={{ ...faint, fontWeight: 600 }}>✓ as information</span> : null}
                    </td>
                  )
                })}
                {thisPaper ? (
                  <td style={{ ...td, background: 'var(--bg-blue-tint)' }} data-cell={r.cells.this ?? 'blank'}>
                    <label style={{ display: 'inline-flex', gap: 6, alignItems: 'center', cursor: r.thisNotice.locked ? 'default' : 'pointer' }}>
                      <input type="checkbox" checked={r.thisNotice.on} disabled={r.thisNotice.locked} onChange={(ev) => onToggle(r.month, ev.target.checked)} aria-label={workMonthLabel(r.month)} title={r.thisNotice.locked ? (r.window.noticed && !r.thisNotice.on ? 'Already noticed' : r.window.state === 'closed' ? 'The window closed' : r.pendingOnly ? 'Nothing approved yet' : 'The draft is past editing') : undefined} />
                      {r.thisNotice.info ? <span style={faint}>as information</span> : null}
                    </label>
                  </td>
                ) : null}
              </tr>
            ))}
            {grid.rows.length === 0 ? <tr><td colSpan={3 + grid.papers.length} style={{ ...td, ...faint }}>No months on this job yet.</td></tr> : null}
          </tbody>
        </table>
      </div>
      <div className="lienMonthsBody" style={{ gridTemplateColumns: 'auto minmax(0, 1fr)' }}>
        <div className="lienMonthsClaimCol">
          {claimNode ?? (
            <div className="lienMonthsClaim">
              <span>Claim amount on the notice</span>
              <strong>{claim}</strong>
              <span>Still unpaid on this job</span>
            </div>
          )}
          {claimTail ? <div className="lienMonthsClaimTail">{claimTail}</div> : null}
        </div>
        <div style={{ display: 'grid', gap: '0.3rem', alignContent: 'start', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
          {tail}
          {onRecordByHand ? <div><strong style={{ color: 'var(--text-700)' }}>A paper that went out by hand?</strong> <button type="button" onClick={onRecordByHand} data-lien-desk-by-hand style={{ border: 'none', background: 'none', color: 'var(--text-link)', fontWeight: 600, cursor: 'pointer', font: 'inherit', padding: 0 }}>Record it…</button> — it becomes a column here.</div> : null}
          {onCount > 1 && grid.earliestOpen ? <div className="lienMonthsNote" style={{ margin: 0 }}>One notice can cover several months. <strong style={{ color: 'var(--text-700)' }}>{formatYmdMonthDay(grid.earliestOpen)}</strong> is the date this one has to beat.</div> : null}
          {grid.rows.some((r) => r.thisNotice.info) ? <div>{grid.rows.filter((r) => r.thisNotice.info).map((r) => workMonthShort(r.month)).join(', ')} closed with nothing sent — named on this notice as information only.</div> : null}
        </div>
      </div>
    </div>
  )
}
