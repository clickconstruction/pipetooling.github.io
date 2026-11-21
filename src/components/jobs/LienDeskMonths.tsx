import type { ReactNode } from 'react'
import { workMonthLabel, workMonthShort } from '../../lib/jobs/forecastWorkMonths'
import { formatYmdMonthDay } from '../../lib/jobs/billedExpectedPay'
import { calendarYmdInAppTzFromIso } from '../../utils/dateUtils'
import { lienStandInWords } from '../../lib/jobs/lienBillMonths'
import { formatUsdNoCents } from '../../lib/jobs/jobFormatting'
import { documentLinkWords } from '../../lib/jobs/lienFilingDocumentLink'
import { lienGridNoticedWords, lienGridPaperTitle, lienGridPaperWords, type LienGridRow, type LienMonthGrid } from '../../lib/jobs/lienMonthGrid'
import { lienNoticeOpensOn } from '../../lib/jobs/lienTimeline'
import { daysBetweenYmd } from '../../lib/jobs/billedExpectedPay'
import { useLienTimelineView, type LienTimelineView } from '../../hooks/useLienTimelineView'
import { EmptyState } from '../EmptyState'

/**
 * The Lien desk's Months card — the ledger (punch list #361; the grid is punch list #38, the tick
 * cards and the "Earlier months" dots were v2.3661). One card read top to bottom on one rhythm, every
 * part a row on the card's hairline: the last day of work that sets the months, one lead line, the
 * grid, the money, then the quiet notes.
 *
 * The grid is months down, papers across: one row per month the job has, with its window; one column
 * per § 53.056 paper that went out (the run's or one recorded by hand), lettered A, B…; this notice
 * as the last column, whose checks are the office's ticks. A cell is a paper that names the month —
 * "as information" when it went out after the window closed. Only the head of this notice's column
 * and its ticked cells are tinted, so a tick changes what it changes. The timeline's Windows view
 * (v2.3815) reaches the Window column: each month's first day and a bar of the days already gone.
 * A closed month is one line (Taunya's ask of 2026-11-15), and what a missed window costs is said
 * once, in a line under the grid that names the months. A missed month keeps its red, with a red bar
 * at its left edge: red means late and nothing else.
 *
 * The money is one block under the grid: the claim is the total line, its figure at the right edge
 * under the ticks that make it, with the months this notice names beneath it (the foot of the column,
 * v2.7430); the bills are the lines that add up to it, on the same right edge.
 *
 * In a narrow card (a phone) a row is the month over its window, an earlier paper is a mark like
 * "A ✓" under them, and the tick stays at the right edge. The layout lives in index.css
 * (`.lienLedger*`), never inline, because an inline style beats the container rule that stacks it.
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
const linkPress: React.CSSProperties = { border: 'none', background: 'none', color: 'var(--text-link)', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', fontSize: 'inherit', padding: 0 }
const strong: React.CSSProperties = { color: 'var(--text-700)' }

/** A month whose window closed with nothing sent and nothing skipped: the red row. */
const isMissed = (r: LienGridRow) => r.window.state === 'closed' && !r.window.noticed && !r.window.skipped

/** The Windows view's bar: how much of a month's window is gone (v2.3815). */
function spentBar(usedPct: number): ReactNode {
  return (
    <div aria-hidden data-lien-month-spent style={{ position: 'relative', height: 6, maxWidth: 180, margin: '4px 0 2px', borderRadius: 3, border: '1px solid var(--text-amber-800)', background: 'var(--bg-amber-tint)', overflow: 'hidden' }}>
      <span style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${Math.max(0, Math.min(100, usedPct))}%`, background: 'var(--text-amber-800)', opacity: 0.55 }} />
    </div>
  )
}

/** A month's window. A chip only where a state changes (mail by, closed, not noted, skipped, not a work month yet); the rest is faint words on the same line where it fits. */
function windowCell(r: LienGridRow, onNoteMissed: ((month: string) => void) | undefined, view: LienTimelineView): ReactNode {
  const w = r.window
  const opensOn = view === 'windows' ? lienNoticeOpensOn(r.month) : ''
  const totalDays = opensOn && w.deadline ? daysBetweenYmd(opensOn, w.deadline) : null
  if (w.state === 'none') {
    return (
      <div className="lienLedgerWindow">
        <span style={chip('var(--bg-muted)', 'var(--text-muted)')}>not a work month yet</span>
        {w.deadline ? <span className="lienLedgerFaint">would be due {formatYmdMonthDay(w.deadline)}</span> : null}
      </div>
    )
  }
  if (w.state === 'open') {
    if (opensOn && totalDays != null && totalDays > 0 && w.daysLeft != null) {
      const left = Math.min(totalDays, w.daysLeft)
      return (
        <>
          <div className="lienLedgerWindow">
            <span style={{ fontWeight: 700, color: 'var(--text-strong)' }}>{w.daysLeft <= totalDays ? 'open since' : 'opens'} {formatYmdMonthDay(opensOn).replace(' ', ' ')}</span>
            <span style={chip('var(--bg-blue-tint)', 'var(--text-blue-700)')}>mail by {formatYmdMonthDay(w.deadline).replace(' ', ' ')}</span>
          </div>
          {spentBar(((totalDays - left) / totalDays) * 100)}
          <div className="lienLedgerFaint">{left} of {totalDays} days left</div>
        </>
      )
    }
    return (
      <div className="lienLedgerWindow">
        <span style={chip('var(--bg-blue-tint)', 'var(--text-blue-700)')}>mail by {formatYmdMonthDay(w.deadline).replace(' ', ' ')}</span>
        {w.daysLeft != null ? <span className="lienLedgerFaint">{daysLeftWords(w.daysLeft)}</span> : null}
      </div>
    )
  }
  // closed: one line where the card has room. The chips and the press always show; the trailing words
  // give way first, cut with … and whole in the tip. A skip's reason is its own, so it wraps. What a missed
  // window costs is not here: the line under the grid says it once for every missed month.
  if (w.skipped) {
    return (
      <div className="lienLedgerWindow">
        <span style={chip('var(--bg-amber-tint)', 'var(--text-amber-800)')}>skipped</span>
        <span className="lienLedgerFaint">{w.skippedBy ? `${w.skippedBy}: ` : ''}“{w.skipReason}”</span>
      </div>
    )
  }
  if (w.noticed) {
    return (
      <div className="lienMonthClosed">
        <span style={chip('var(--bg-muted)', 'var(--text-muted)')}>closed {formatYmdMonthDay(w.deadline)}</span>
        <span className="lienMonthClosedTail lienLedgerFaint" title={lienGridNoticedWords(r.cells)}>{lienGridNoticedWords(r.cells)}</span>
      </div>
    )
  }
  const openWords = opensOn && w.deadline ? `it was open ${formatYmdMonthDay(opensOn)} → ${formatYmdMonthDay(w.deadline)}` : ''
  return (
    <div className="lienMonthClosed">
      <span style={chip('var(--bg-red-tint)', 'var(--text-red-700)')}>closed {w.deadline ? formatYmdMonthDay(w.deadline) : ''}</span>
      {w.noted ? <span className="lienLedgerFaint lienLedgerNoted">noted{w.notedBy ? ` by ${w.notedBy}` : ''}{w.notedAt ? ` ${formatYmdMonthDay(calendarYmdInAppTzFromIso(w.notedAt))}` : ''}</span> : <span style={chip('var(--bg-amber-tint)', 'var(--text-amber-800)')}>not noted</span>}
      {openWords ? <span className="lienMonthClosedTail lienLedgerFaint" title={openWords}>{w.noted ? '· ' : ''}{openWords}</span> : null}
      {!w.noted && onNoteMissed ? (
        <button type="button" onClick={() => onNoteMissed(r.month)} data-lien-desk-note-missed className="lienLedgerNoteMissed" title="Write the closed window down with your name — not a skip, just that it was seen">
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
  /**
   * The claim box, corrected by hand (v2.3682) — replaces the plain figure when given. A function is
   * handed the foot of this notice's column (the months it names and their count) to draw under its figure.
   */
  claimNode?: ReactNode | ((foot: ReactNode) => ReactNode)
  /** One quiet row under the money (v2.3753): the retainage named inside the claim, or the door to record it. */
  claimTail?: ReactNode
  /** The bills behind the claim (v2.4969): the lines under the total, on its right edge. */
  bills?: ReactNode
  /** Read this notice as the paper prints it. */
  onPreviewThis?: () => void
  /** A paper that went out by hand (v2.3770) — record it, and it becomes a column. */
  onRecordByHand?: () => void
  /** A quiet row at the card's end — the affidavit's state, for one. */
  tail?: ReactNode
  /** The last day of work (v2.4676): the card's first row. */
  lastWork?: ReactNode
  /** The title is drawn by the pane's stacked head instead (v2.4733). */
  headless?: boolean
}) {
  const view = useLienTimelineView()
  const filings = grid.papers.filter((p) => p.kind === 'filing')
  const thisPaper = grid.papers.find((p) => p.kind === 'this') ?? null
  const onRows = grid.rows.filter((r) => r.thisNotice.on)
  const onCount = onRows.length
  const onNames = onRows.map((r) => workMonthShort(r.month)).join(', ')
  const missed = grid.rows.filter(isMissed)
  const infoRows = grid.rows.filter((r) => r.thisNotice.info)
  const lateRows = grid.rows.filter((r) => r.thisNotice.late)
  // A tick is asked for only where one can be made: a notice past editing, or one whose months are all closed, has none.
  const canTick = grid.rows.some((r) => !r.thisNotice.locked)

  // The foot of this notice's column (v2.7430): the months it names and their count, under the total they make.
  const foot: ReactNode =
    thisPaper && (onCount > 0 || onPreviewThis) ? (
      <span className="lienLedgerClaimFoot" data-lien-grid-foot>
        {onCount ? <>This notice names <strong style={strong}>{onNames}</strong>{' · '}{onCount} {onCount === 1 ? 'month' : 'months'}</> : null}
        {onCount && onPreviewThis ? ' · ' : null}
        {onPreviewThis ? <button type="button" onClick={onPreviewThis} style={linkPress}>Preview ›</button> : null}
      </span>
    ) : null

  return (
    <div className="lienMonths lienLedger" data-lien-desk-months data-lien-desk-month-grid>
      {headless ? null : (
        <div className="lienMonthsHead">
          <strong>Months on this job</strong>
        </div>
      )}
      {lastWork ? <div className="lienLedgerRow" data-lien-ledger-last-work>{lastWork}</div> : null}
      {grid.rows.length === 0 ? (
        <div className="lienLedgerRow" data-lien-ledger-empty>
          {/* The words alone: the next step is the row above, the last day of work and its Change ›. */}
          <EmptyState compact main="No months on this job yet." />
        </div>
      ) : (
        <>
          {(thisPaper && canTick) || filings.length > 0 ? (
            <p className="lienLedgerLead" data-lien-ledger-lead>
              {thisPaper && canTick ? 'Tick a month to put it on this notice.' : null}
              {thisPaper && canTick && filings.length > 0 ? ' ' : null}
              {filings.length > 0 ? 'A check is a paper that already names the month.' : null}
            </p>
          ) : null}
          <div className="lienLedgerGridFrame">
            <table className="lienLedgerGrid" data-papers={Math.min(filings.length, 3)} data-this={thisPaper ? 'yes' : 'no'}>
              <thead>
                <tr>
                  <th data-col="month">Month</th>
                  <th data-col="window">Window</th>
                  {filings.map((p) => (
                    <th key={p.key} data-col="paper" data-lien-grid-paper={p.letter}>
                      <span className="lienLedgerLetter" data-tone="paper">{p.letter}</span>
                      {lienGridPaperTitle(p, formatYmdMonthDay)}
                      <span className="lienLedgerPaperWords">
                        {lienGridPaperWords(p, formatUsdNoCents, (m) => METHOD_LABELS[m] ?? m)}
                        {p.documentUrl ? <> · <a href={p.documentUrl} target="_blank" rel="noreferrer" style={{ color: 'var(--text-link)', fontWeight: 600 }}>{documentLinkWords({ document_url: p.documentUrl, document_note: p.documentNote })} ›</a></> : null}
                      </span>
                    </th>
                  ))}
                  {thisPaper ? (
                    <th data-col="this" data-lien-grid-paper="this">
                      <span className="lienLedgerLetter" data-tone="this">{thisPaper.letter}</span>
                      This notice
                    </th>
                  ) : null}
                </tr>
              </thead>
              <tbody>
                {grid.rows.map((r) => {
                  const oneLine = r.window.state === 'closed'
                  const standIn = r.fromCreation || r.pendingOnly
                  const worked = r.fromCreation ? lienStandInWords(r.fromBill === true) : r.pendingOnly ? 'sessions await approval' : <>{r.hours.toLocaleString(undefined, { maximumFractionDigits: 1 })} h{r.crew ? ` · ${r.crew}` : ''}</>
                  return (
                    <tr key={r.month} data-lien-grid-row={r.month} data-window={r.window.state} data-on={r.thisNotice.on ? 'yes' : 'no'} data-missed={isMissed(r) ? 'yes' : undefined} data-lines={oneLine ? 'one' : undefined}>
                      <td data-col="month" className={oneLine ? 'lienMonthOne' : undefined}>
                        <div className="lienMonthName">{workMonthLabel(r.month)}</div>
                        <div className={standIn ? 'lienLedgerFaint' : 'lienMonthWorked lienLedgerFaint'}>{worked}</div>
                      </td>
                      <td data-col="window">{windowCell(r, onNoteMissed, view)}</td>
                      {filings.map((p) => {
                        const c = r.cells[p.key] ?? 'blank'
                        return (
                          <td key={p.key} data-col="paper" data-cell={c}>
                            {c === 'blank' ? null : (
                              <>
                                {/* In a narrow card the paper has no column, so its letter comes with the check. */}
                                <span className="lienLedgerLetter lienLedgerMarkLetter" data-tone="paper" aria-hidden>{p.letter}</span>
                                {c === 'named' ? <span style={{ color: 'var(--text-green-800)', fontWeight: 800 }}>✓</span> : <span className="lienLedgerFaint" style={{ fontWeight: 600 }}>✓ as information</span>}
                              </>
                            )}
                          </td>
                        )
                      })}
                      {thisPaper ? (
                        <td data-col="this" data-cell={r.cells.this ?? 'blank'}>
                          <label className="lienLedgerTick" style={{ cursor: r.thisNotice.locked ? 'default' : 'pointer' }}>
                            <input type="checkbox" checked={r.thisNotice.on} disabled={r.thisNotice.locked} onChange={(ev) => onToggle(r.month, ev.target.checked)} aria-label={workMonthLabel(r.month)} title={r.thisNotice.locked ? (r.window.noticed && !r.thisNotice.on ? 'Already noticed' : r.window.state === 'closed' ? 'The window closed' : r.pendingOnly ? 'Nothing approved yet' : 'The draft is past editing') : undefined} />
                            {r.thisNotice.info ? <span className="lienLedgerFaint">as information</span> : r.thisNotice.late ? <span className="lienLedgerFaint" style={{ color: 'var(--text-amber-800)', fontWeight: 600 }}>late</span> : null}
                          </label>
                        </td>
                      ) : null}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
      {missed.length > 0 ? (
        <div className="lienLedgerRow lienLedgerQuiet" data-lien-months-missed>
          <span style={chip('var(--bg-red-tint)', 'var(--text-red-700)')}>closed</span>{' '}
          <strong style={strong}>{missed.map((r) => workMonthShort(r.month)).join(', ')}</strong>{' · '}
          {grid.lateUntil ? `a late notice can still go · the affidavit by ${formatYmdMonthDay(grid.lateUntil)}` : 'lien right gone · the money still rides'}
        </div>
      ) : null}
      {/* The money, one block: the claim is the total line, the bills are the lines that make it. */}
      <div className="lienLedgerMoney" data-lien-ledger-money>
        {typeof claimNode === 'function'
          ? claimNode(foot)
          : (claimNode ?? (
              <div className="lienLedgerClaim">
                <span>Claim amount on the notice</span>
                <strong>{claim}</strong>
                <span>Still unpaid on this job</span>
                {foot}
              </div>
            ))}
        {bills ?? null}
      </div>
      {/* The quiet rows that close the card: the record beside the claim, said in words. */}
      {claimTail ? <div className="lienLedgerRow lienLedgerQuiet" data-lien-ledger-retainage>{claimTail}</div> : null}
      {onRecordByHand ? (
        <div className="lienLedgerRow lienLedgerQuiet">
          <strong style={strong}>A paper that went out by hand?</strong> <button type="button" onClick={onRecordByHand} data-lien-desk-by-hand style={linkPress}>Record it…</button> — it becomes a column here.
        </div>
      ) : null}
      {onCount > 1 && grid.earliestOpen ? (
        <div className="lienLedgerRow lienLedgerQuiet">
          One notice can cover several months. <strong style={strong}>{formatYmdMonthDay(grid.earliestOpen)}</strong> is the date this one has to beat.
        </div>
      ) : null}
      {infoRows.length > 0 ? <div className="lienLedgerRow lienLedgerQuiet">{infoRows.map((r) => workMonthShort(r.month)).join(', ')} closed with nothing sent — named on this notice as information only.</div> : null}
      {grid.lateUntil && lateRows.length > 0 ? (
        <div className="lienLedgerRow lienLedgerQuiet" data-lien-months-late>
          {lateRows.map((r) => workMonthShort(r.month)).join(', ')} closed with nothing sent — claimed on this notice late; the affidavit can follow by <strong style={strong}>{formatYmdMonthDay(grid.lateUntil)}</strong>.
        </div>
      ) : null}
      {tail ? <div className="lienLedgerRow lienLedgerQuiet">{tail}</div> : null}
    </div>
  )
}
