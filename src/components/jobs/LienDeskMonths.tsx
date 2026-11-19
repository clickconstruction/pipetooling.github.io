import type { ReactNode } from 'react'
import { workMonthLabel, workMonthShort } from '../../lib/jobs/forecastWorkMonths'
import { formatYmdMonthDay } from '../../lib/jobs/billedExpectedPay'
import { calendarYmdInAppTzFromIso } from '../../utils/dateUtils'
import { lienStandInWords } from '../../lib/jobs/lienBillMonths'
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
 * A closed month is one line (Taunya's ask of 2026-11-15): nothing is left to do on it, so it
 * gives its height to the months that can still go out. What a missed window costs is the same
 * for every missed month of a job, so it is said once, in a line under the grid that names them.
 * This notice's total sits at the foot of its column, under the ticks that make it; the column
 * keeps its name on top.
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
  /** The stand-in month came from a sent, unpaid bill (v2.7224). */
  fromBill?: boolean
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
/** A closed month's cell: tighter, and centred on its one line (the line itself is `.lienMonthOne` / `.lienMonthClosed` in index.css). */
const tdOne: React.CSSProperties = { ...td, padding: '0.24rem 0.5rem', verticalAlign: 'middle' }

/** The Windows view's bar: how much of a month's window is gone (v2.3815). */
function spentBar(usedPct: number): ReactNode {
  return (
    <div aria-hidden data-lien-month-spent style={{ position: 'relative', height: 6, maxWidth: 180, margin: '4px 0 2px', borderRadius: 3, border: '1px solid var(--text-amber-800)', background: 'var(--bg-amber-tint)', overflow: 'hidden' }}>
      <span style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${Math.max(0, Math.min(100, usedPct))}%`, background: 'var(--text-amber-800)', opacity: 0.55 }} />
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
          <span style={{ fontWeight: 700, color: 'var(--text-strong)' }}>{w.daysLeft <= totalDays ? 'open since' : 'opens'} {formatYmdMonthDay(opensOn).replace(' ', '\u00a0')}</span>{' '}
          <span style={chip('var(--bg-blue-tint)', 'var(--text-blue-700)')}>mail by {formatYmdMonthDay(w.deadline).replace(' ', '\u00a0')}</span>
          {spentBar(((totalDays - left) / totalDays) * 100)}
          <div style={faint}>{left} of {totalDays} days left</div>
        </>
      )
    }
    return <><span style={chip('var(--bg-blue-tint)', 'var(--text-blue-700)')}>mail by {formatYmdMonthDay(w.deadline).replace(' ', '\u00a0')}</span>{w.daysLeft != null ? <div style={faint}>{daysLeftWords(w.daysLeft)}</div> : null}</>
  }
  // closed: one line where the card has room. The chips and the press always show; the trailing words
  // give way first, cut with … and whole in the tip. A skip's reason is its own, so it wraps. What a missed
  // window costs is not here: the line under the grid says it once for every missed month.
  if (w.skipped) return <><span style={chip('var(--bg-amber-tint)', 'var(--text-amber-800)')}>skipped</span>{' '}<span style={faint}>{w.skippedBy ? `${w.skippedBy}: ` : ''}“{w.skipReason}”</span></>
  if (w.noticed) {
    return (
      <div className="lienMonthClosed">
        <span style={chip('var(--bg-muted)', 'var(--text-muted)')}>closed {formatYmdMonthDay(w.deadline)}</span>
        <span className="lienMonthClosedTail" style={faint} title="named after the window — information">named after the window — information</span>
      </div>
    )
  }
  const openWords = opensOn && w.deadline ? `it was open ${formatYmdMonthDay(opensOn)} → ${formatYmdMonthDay(w.deadline)}` : ''
  return (
    <div className="lienMonthClosed">
      <span style={chip('var(--bg-red-tint)', 'var(--text-red-700)')}>closed {w.deadline ? formatYmdMonthDay(w.deadline) : ''}</span>
      {w.noted ? <span style={{ ...faint, whiteSpace: 'nowrap' }}>noted{w.notedBy ? ` by ${w.notedBy}` : ''}{w.notedAt ? ` ${formatYmdMonthDay(calendarYmdInAppTzFromIso(w.notedAt))}` : ''}</span> : <span style={chip('var(--bg-amber-tint)', 'var(--text-amber-800)')}>not noted</span>}
      {openWords ? <span className="lienMonthClosedTail" style={faint} title={openWords}>{w.noted ? '· ' : ''}{openWords}</span> : null}
      {!w.noted && onNoteMissed ? (
        <button type="button" onClick={() => onNoteMissed(r.month)} data-lien-desk-note-missed style={{ padding: '1px 8px', borderRadius: 6, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--text-700)', fontWeight: 600, fontSize: '0.7rem', cursor: 'pointer', whiteSpace: 'nowrap' }} title="Write the closed window down with your name — not a skip, just that it was seen">
          Note it as missed
        </button>
      ) : null}
    </div>
  )
}

export default function LienDeskMonths({
  grid,
  claim,
  onToggle,
  onNoteMissed,
  claimNode,
  claimTail,
  bills,
  onPreviewThis,
  onRecordByHand,
  tail,
  lastWork,
  headless = false,
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
  /** The bills behind the claim (v2.4969): drawn full width under the claim and the notes. */
  bills?: ReactNode
  /** Read this notice as the paper prints it. */
  onPreviewThis?: () => void
  /** A paper that went out by hand (v2.3770) — record it, and it becomes a column. */
  onRecordByHand?: () => void
  /** Lines under the grid beside the claim — the affidavit's state, for one. */
  tail?: ReactNode
  /** The last day of work line (v2.4676), above the grid. */
  lastWork?: ReactNode
  /** The title is drawn by the pane's stacked head instead (v2.4733); the helper sentence stays. */
  headless?: boolean
}) {
  const view = useLienTimelineView()
  const filings = grid.papers.filter((p) => p.kind === 'filing')
  const thisPaper = grid.papers.find((p) => p.kind === 'this') ?? null
  const onRows = grid.rows.filter((r) => r.thisNotice.on)
  const onCount = onRows.length
  const onNames = onRows.map((r) => workMonthShort(r.month)).join(', ')
  const canTick = grid.rows.some((r) => !r.thisNotice.locked)
  // The months whose window closed with nothing sent and nothing skipped: the red rows.
  const missed = grid.rows.filter((r) => r.window.state === 'closed' && !r.window.noticed && !r.window.skipped)
  return (
    <div className="lienMonths" data-lien-desk-months data-lien-desk-month-grid>
      <div className="lienMonthsHead">
        {headless ? null : <strong>Months on this job</strong>}
        <span>Every month worked, oldest first. A check is a paper that names the month; the last column is this notice — tick a month to put it on.</span>
      </div>
      {lastWork ? <div style={{ margin: '0.5rem 0 0.25rem' }}>{lastWork}</div> : null}
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
                </th>
              ) : null}
            </tr>
          </thead>
          <tbody>
            {grid.rows.map((r) => {
              const oneLine = r.window.state === 'closed'
              const cell = oneLine ? tdOne : td
              const standIn = r.fromCreation || r.pendingOnly
              const worked = r.fromCreation ? lienStandInWords(r.fromBill === true) : r.pendingOnly ? 'sessions await approval' : <>{r.hours.toLocaleString(undefined, { maximumFractionDigits: 1 })} h{r.crew ? ` · ${r.crew}` : ''}</>
              return (
              <tr key={r.month} data-lien-grid-row={r.month} data-window={r.window.state} data-on={r.thisNotice.on ? 'yes' : 'no'} style={r.window.state === 'closed' && !r.window.noticed && !r.window.skipped ? { background: 'var(--bg-red-tint)' } : r.window.state === 'none' ? { color: 'var(--text-muted)' } : undefined}>
                <td style={cell} className={oneLine ? 'lienMonthOne' : undefined}>
                  <div className="lienMonthName" style={{ fontWeight: 700 }}>{workMonthLabel(r.month)}</div>
                  <div className={standIn ? undefined : 'lienMonthWorked'} style={faint}>{worked}</div>
                </td>
                <td style={cell}>{windowCell(r, onNoteMissed, view)}</td>
                {filings.map((p) => {
                  const c = r.cells[p.key] ?? 'blank'
                  return (
                    <td key={p.key} style={cell} data-cell={c}>
                      {c === 'named' ? <span style={{ color: 'var(--text-green-800)', fontWeight: 800 }}>✓</span> : c === 'info' ? <span style={{ ...faint, fontWeight: 600 }}>✓ as information</span> : null}
                    </td>
                  )
                })}
                {thisPaper ? (
                  <td style={{ ...cell, background: 'var(--bg-blue-tint)' }} data-cell={r.cells.this ?? 'blank'}>
                    <label style={{ display: 'inline-flex', gap: 6, alignItems: 'center', verticalAlign: 'middle', cursor: r.thisNotice.locked ? 'default' : 'pointer' }}>
                      <input type="checkbox" checked={r.thisNotice.on} disabled={r.thisNotice.locked} onChange={(ev) => onToggle(r.month, ev.target.checked)} aria-label={workMonthLabel(r.month)} title={r.thisNotice.locked ? (r.window.noticed && !r.thisNotice.on ? 'Already noticed' : r.window.state === 'closed' ? 'The window closed' : r.pendingOnly ? 'Nothing approved yet' : 'The draft is past editing') : undefined} />
                      {r.thisNotice.info ? <span style={faint}>as information</span> : r.thisNotice.late ? <span style={{ ...faint, color: 'var(--text-amber-800)', fontWeight: 600 }}>late</span> : null}
                    </label>
                  </td>
                ) : null}
              </tr>
              )
            })}
            {grid.rows.length === 0 ? <tr><td colSpan={3 + grid.papers.length} style={{ ...td, ...faint }}>No months on this job yet.</td></tr> : null}
          </tbody>
          {thisPaper ? (
            <tfoot>
              <tr data-lien-grid-foot>
                <td colSpan={2 + filings.length} style={{ ...td, borderBottom: 'none', verticalAlign: 'middle', textAlign: 'right', color: 'var(--text-muted)', fontSize: '0.75rem' }}>
                  {onCount ? <>This notice names <strong style={{ color: 'var(--text-700)' }}>{onNames}</strong></> : canTick ? 'Tick a month to put it on this notice.' : null}
                </td>
                <td style={{ ...td, verticalAlign: 'middle', background: 'var(--bg-blue-tint)', borderBottom: '2px solid var(--text-blue-700)', borderRadius: '0 0 6px 6px' }} data-lien-grid-total>
                  <div style={{ fontSize: '1.05rem', fontWeight: 800, lineHeight: 1.2, color: 'var(--text-strong)' }}>{claim}</div>
                  <div style={faint}>
                    {onCount ? `${onCount} ${onCount === 1 ? 'month' : 'months'}` : null}
                    {onCount && onPreviewThis ? ' · ' : null}
                    {onPreviewThis ? <button type="button" onClick={onPreviewThis} style={{ border: 'none', background: 'none', color: 'var(--text-link)', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', padding: 0 }}>Preview ›</button> : null}
                  </div>
                </td>
              </tr>
            </tfoot>
          ) : null}
        </table>
      </div>
      {missed.length > 0 ? (
        <div data-lien-months-missed style={{ fontSize: '0.75rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>
          <span style={chip('var(--bg-red-tint)', 'var(--text-red-700)')}>closed</span>{' '}
          <strong style={{ color: 'var(--text-700)' }}>{missed.map((r) => workMonthShort(r.month)).join(', ')}</strong>{' · '}
          {grid.lateUntil ? `a late notice can still go · the affidavit by ${formatYmdMonthDay(grid.lateUntil)}` : 'lien right gone · the money still rides'}
        </div>
      ) : null}
      <div className="lienMonthsBody">
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
          {onRecordByHand ? <div><strong style={{ color: 'var(--text-700)' }}>A paper that went out by hand?</strong> <button type="button" onClick={onRecordByHand} data-lien-desk-by-hand style={{ border: 'none', background: 'none', color: 'var(--text-link)', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', padding: 0 }}>Record it…</button> — it becomes a column here.</div> : null}
          {onCount > 1 && grid.earliestOpen ? <div className="lienMonthsNote" style={{ margin: 0 }}>One notice can cover several months. <strong style={{ color: 'var(--text-700)' }}>{formatYmdMonthDay(grid.earliestOpen)}</strong> is the date this one has to beat.</div> : null}
          {grid.rows.some((r) => r.thisNotice.info) ? <div>{grid.rows.filter((r) => r.thisNotice.info).map((r) => workMonthShort(r.month)).join(', ')} closed with nothing sent — named on this notice as information only.</div> : null}
          {grid.lateUntil && grid.rows.some((r) => r.thisNotice.late) ? <div data-lien-months-late>{grid.rows.filter((r) => r.thisNotice.late).map((r) => workMonthShort(r.month)).join(', ')} closed with nothing sent — claimed on this notice late; the affidavit can follow by <strong style={{ color: 'var(--text-700)' }}>{formatYmdMonthDay(grid.lateUntil)}</strong>.</div> : null}
        </div>
      </div>
      {bills ?? null}
    </div>
  )
}
