/**
 * The Pieces card (punch list #208, design spike): one table at desk width — Piece · Bid · Job ·
 * Plans · Waiting on — each bid on the row with the job it became, the unpaired on rows of their
 * own, the done ones folded; at phone width each piece is a card with the bid line, the job line,
 * the plans and the wait. The rows come from `lib/developments/pieces.ts`.
 */
import { useState, type ReactNode } from 'react'
import { useMatchMedia } from '../../hooks/useMatchMedia'
import { BID_STATUS_COLOR, bidMoney, bidStatusWord, jobOpenOnBill, type MemberBid, type MemberJob } from '../../lib/developments/overview'
import { doneFoldWords, type PieceRow } from '../../lib/developments/pieces'
import { jobsLedgerStatusDotColor, labelJobsLedgerStatusForDashboard } from '../../lib/jobsLedgerStatusPipeline'
import { Chip, LinkButton, money, PressChip, shortDay } from './developmentPageBits'
import { BecameCell, CameFromCell, PairStrip, type PairingProps } from './DevelopmentPairCells'
import { DEVELOPMENT_PHONE_QUERY } from './DevelopmentJumpStrip'

export type PiecesProps = {
  rows: PieceRow[]
  bidLabel: (bid: MemberBid) => string
  jobLabel: (job: MemberJob) => string
  names: ReadonlyMap<string, string>
  teamMembers: ReadonlyArray<{ job_id: string; user_id: string }>
  openBid: (bidId: string) => void
  openJob: (jobId: string) => void
  /** The address matches drawn on the page while the toggle is on: their rows carry a small *not in it* mark. */
  notInIt: ReadonlySet<string>
  /** Pair mode (the owner's pick: a toggle, and when on the table reads as draft B): the row's gaps become the tool. */
  pairing?: PairingProps
  /** The *not in it* chip presses: put the piece in the development after a confirm. */
  onPutIn?: (kind: 'bid' | 'job', id: string) => void
  /** The *off the board* chip presses: put the bid back on the Unsent/Working board after a confirm. */
  onPutBackOnBoard?: (bid: MemberBid) => void
  busy?: boolean
}

function BidCell({ bid, label, estimator, open, unpair, putBackOnBoard, busy }: { bid: MemberBid; label: string; estimator: string | null; open: () => void; unpair?: () => void; putBackOnBoard?: () => void; busy?: boolean }) {
  const status = bidStatusWord(bid)
  const value = bidMoney(bid)
  const when = bid.bid_date_sent ? `sent ${shortDay(bid.bid_date_sent)}` : bid.bid_due_date ? `due ${shortDay(bid.bid_due_date)}` : null
  return (
    <div style={{ display: 'grid', gap: 2, minWidth: 0 }}>
      <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
        <LinkButton onClick={open} strong>
          {label}
        </LinkButton>
        {status === 'off the board' && putBackOnBoard ? (
          <PressChip label={status} color={BID_STATUS_COLOR[status]} title="Hidden from the Unsent/Working board, never sent, no outcome. Press to put it back on the board." onClick={putBackOnBoard} disabled={busy} testId="chip-off-the-board" />
        ) : (
          <Chip label={status} color={BID_STATUS_COLOR[status]} soft={status === 'off the board' || status === 'working'} />
        )}
        {unpair ? (
          <button
            type="button"
            onClick={unpair}
            title="Clears the job's bid link and nothing else; the toast offers Put it back"
            data-testid="unpair"
            style={{ border: '1px solid var(--border-strong)', background: 'var(--bg-subtle)', borderRadius: 4, padding: '0 6px', fontSize: '0.68rem', fontWeight: 600, color: 'var(--text-700)', cursor: 'pointer', font: 'inherit', lineHeight: 1.6 }}
          >
            Unpair
          </button>
        ) : null}
      </div>
      <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
        {value != null ? money(value) : 'no price yet'}
        {estimator ? ` · ${estimator}` : ''}
        {when ? ` · ${when}` : ''}
      </div>
    </div>
  )
}

function JobCell({ job, label, crew, open }: { job: MemberJob; label: string; crew: string[]; open: () => void }) {
  const status = labelJobsLedgerStatusForDashboard(job.status)
  const openOnBill = jobOpenOnBill(job)
  const revenue = job.revenue ?? 0
  return (
    <div style={{ display: 'grid', gap: 2, minWidth: 0 }}>
      <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
        <LinkButton onClick={open} strong>
          {label}
        </LinkButton>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-strong)' }}>
          <span aria-hidden style={{ width: 8, height: 8, borderRadius: 9999, background: jobsLedgerStatusDotColor(job.status), display: 'inline-block' }} />
          {status}
        </span>
      </div>
      <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
        {openOnBill > 0 ? `${money(openOnBill)} open` : revenue > 0 ? money(revenue) : '$0'}
        {crew.length ? ` · ${crew[0]}${crew.length > 1 ? `, +${crew.length - 1}` : ''}` : (job.status ?? '').toLowerCase() === 'waiting' ? ' · not scheduled' : ''}
        {job.last_work_date ? ` · last work ${shortDay(job.last_work_date)}` : ''}
      </div>
    </div>
  )
}

function PlansCell({ row }: { row: PieceRow }) {
  if (!row.plans.set) return <span style={{ color: 'var(--text-faint)', fontSize: '0.8rem' }}>none</span>
  const s = row.plans.set
  const dated = s.dated ? `${shortDay(s.dated)} set` : s.filedAt ? `filed ${shortDay(s.filedAt)}` : 'a set'
  return (
    <span style={{ fontSize: '0.8rem', display: 'inline-flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
      <a href={s.link} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--text-link)', textDecoration: 'none' }}>
        {dated}
      </a>
      {row.plans.older ? <Chip label="older" color="#d97706" soft /> : <span style={{ color: 'var(--text-faint)' }}>newest</span>}
    </span>
  )
}

function WaitingCell({ row }: { row: PieceRow }) {
  const w = row.waiting
  if (!w) return <span style={{ color: 'var(--text-faint)' }}>—</span>
  const age = w.ageDays === 0 ? 'today' : `${w.ageDays} ${w.ageDays === 1 ? 'day' : 'days'}`
  return (
    <div style={{ display: 'grid', gap: 1, fontSize: '0.8rem' }}>
      <span style={{ fontWeight: 700, color: 'var(--text-amber-800)' }}>
        {w.who} · {age}
      </span>
      <span style={{ color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 220 }}>{w.what}</span>
    </div>
  )
}

// The column headers read as the Bid Board's do (the owner, 2026-10-28: *large, like on the bids tab*): its
// `th` size and weight, the strong color, no small caps, on the same subtle band.
const th: React.CSSProperties = { textAlign: 'left', padding: '0.25rem 0.5rem', fontSize: '0.6875rem', lineHeight: 1.25, fontWeight: 700, color: 'var(--text-strong)', borderBottom: '1px solid var(--border)' }
const td: React.CSSProperties = { padding: '8px 8px', verticalAlign: 'top', borderBottom: '1px solid var(--border)' }

function NotInItMark({ onPress, busy }: { onPress?: () => void; busy?: boolean }) {
  if (!onPress) return <Chip label="not in it" color="#9ca3af" soft />
  return <PressChip label="not in it" color="#9ca3af" title="At the site's address, not in the development. Press to put it in." onClick={onPress} disabled={busy} testId="chip-not-in-it" />
}

export function DevelopmentPieces(props: PiecesProps) {
  const phone = useMatchMedia(DEVELOPMENT_PHONE_QUERY)
  const [showDone, setShowDone] = useState(false)
  const [showAll, setShowAll] = useState(false)
  const open = props.rows.filter((r) => !r.done)
  const done = props.rows.filter((r) => r.done)
  const PHONE_CAP = 6
  const openShown = phone && !showAll ? open.slice(0, PHONE_CAP) : open
  const crewFor = (job: MemberJob | null): string[] => {
    if (!job) return []
    const names: string[] = []
    for (const tm of props.teamMembers) {
      if (tm.job_id !== job.id) continue
      const n = props.names.get(tm.user_id)
      if (n && !names.includes(n)) names.push(n)
    }
    return names
  }
  const estimatorFor = (bid: MemberBid | null) => (bid?.estimator_id ? props.names.get(bid.estimator_id) ?? null : null)
  const isNotInIt = (row: PieceRow) => (row.bid && props.notInIt.has(`bid:${row.bid.id}`)) || (row.job && props.notInIt.has(`job:${row.job.id}`))
  // The press puts the row's not-in-it piece in: the job when the job is out, else the bid.
  const putInFor = (row: PieceRow) => {
    if (!props.onPutIn) return undefined
    if (row.job && props.notInIt.has(`job:${row.job.id}`)) return () => props.onPutIn!('job', row.job!.id)
    if (row.bid && props.notInIt.has(`bid:${row.bid.id}`)) return () => props.onPutIn!('bid', row.bid!.id)
    return undefined
  }
  const putBackFor = (row: PieceRow) => (props.onPutBackOnBoard && row.bid ? () => props.onPutBackOnBoard!(row.bid!) : undefined)
  const pairing = props.pairing?.on ? props.pairing : null
  const unpairFor = (row: PieceRow) => (pairing && row.job && row.bid && !pairing.busy ? () => pairing.onUnpair(row.job!.id, row.bid!.id) : undefined)

  const rowsOf = (rows: PieceRow[], muted: boolean): ReactNode =>
    phone ? (
      <div style={{ display: 'grid', gap: 8 }}>
        {rows.map((row) => (
          <div key={row.key} style={{ border: '1px solid var(--border)', borderRadius: 8, padding: '8px 10px', background: 'var(--surface)', opacity: muted ? 0.75 : 1 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
              <strong style={{ color: 'var(--text-strong)', fontSize: '0.92rem' }}>{row.name}</strong>
              {isNotInIt(row) ? <NotInItMark onPress={putInFor(row)} busy={props.busy} /> : null}
              {row.waiting ? (
                <span style={{ marginLeft: 'auto', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-amber-800)' }}>
                  {row.waiting.who} · {row.waiting.ageDays === 0 ? 'today' : `${row.waiting.ageDays} days`}
                </span>
              ) : null}
            </div>
            <div style={{ display: 'grid', gap: 6, marginTop: 6 }}>
              {row.bid ? <BidCell bid={row.bid} label={props.bidLabel(row.bid)} estimator={estimatorFor(row.bid)} open={() => props.openBid(row.bid!.id)} unpair={unpairFor(row)} putBackOnBoard={putBackFor(row)} busy={props.busy} /> : pairing && row.job ? <CameFromCell job={row.job} pairing={pairing} bidLabel={props.bidLabel} names={props.names} /> : null}
              {row.job ? <JobCell job={row.job} label={props.jobLabel(row.job)} crew={crewFor(row.job)} open={() => props.openJob(row.job!.id)} /> : pairing && row.bid ? <BecameCell bid={row.bid} pairing={pairing} jobLabel={props.jobLabel} /> : null}
              {!row.bid && !(pairing && row.job) ? <span style={{ fontSize: '0.75rem', color: 'var(--text-faint)' }}>no bid here</span> : null}
              {!row.job && !(pairing && row.bid) ? <span style={{ fontSize: '0.75rem', color: 'var(--text-faint)' }}>no job yet</span> : null}
              <div>
                <PlansCell row={row} />
              </div>
            </div>
          </div>
        ))}
      </div>
    ) : (
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem', opacity: muted ? 0.75 : 1 }}>
        <thead style={{ background: 'var(--bg-subtle)' }}>
          <tr>
            <th style={th}>Piece</th>
            <th style={th}>Bid</th>
            <th style={th}>Job</th>
            <th style={th}>Plans</th>
            <th style={th}>Waiting on</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.key} data-testid="piece-row">
              <td style={{ ...td, fontWeight: 600, color: 'var(--text-strong)', maxWidth: 260 }}>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                  <span style={{ overflowWrap: 'anywhere' }}>{row.name}</span>
                  {isNotInIt(row) ? <NotInItMark onPress={putInFor(row)} busy={props.busy} /> : null}
                </div>
              </td>
              <td style={td}>{row.bid ? <BidCell bid={row.bid} label={props.bidLabel(row.bid)} estimator={estimatorFor(row.bid)} open={() => props.openBid(row.bid!.id)} unpair={unpairFor(row)} putBackOnBoard={putBackFor(row)} busy={props.busy} /> : pairing && row.job ? <CameFromCell job={row.job} pairing={pairing} bidLabel={props.bidLabel} names={props.names} /> : <span style={{ color: 'var(--text-faint)' }}>no bid here</span>}</td>
              <td style={td}>{row.job ? <JobCell job={row.job} label={props.jobLabel(row.job)} crew={crewFor(row.job)} open={() => props.openJob(row.job!.id)} /> : pairing && row.bid ? <BecameCell bid={row.bid} pairing={pairing} jobLabel={props.jobLabel} /> : <span style={{ color: 'var(--text-faint)' }}>no job yet</span>}</td>
              <td style={td}>
                <PlansCell row={row} />
              </td>
              <td style={td}>
                <WaitingCell row={row} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    )

  return (
    <div style={{ display: 'grid', gap: 10 }}>
      {pairing ? <PairStrip pairing={pairing} bidLabel={props.bidLabel} jobLabel={props.jobLabel} names={props.names} /> : null}
      {open.length === 0 ? <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)' }}>Nothing is working or waiting on this site. Every piece is done.</p> : null}
      {open.length > 0 ? (
        <div>
          <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', margin: '0 0 6px' }}>
            Working or waiting · {open.length}
          </div>
          {rowsOf(openShown, false)}
          {phone && open.length > PHONE_CAP && !showAll ? (
            <div style={{ marginTop: 8 }}>
              <LinkButton onClick={() => setShowAll(true)}>Show the other {open.length - PHONE_CAP} pieces</LinkButton>
            </div>
          ) : null}
        </div>
      ) : null}
      {done.length > 0 ? (
        <div style={{ borderTop: '1px dashed var(--border)', paddingTop: 8 }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'baseline', flexWrap: 'wrap', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            <strong style={{ color: 'var(--text-strong)' }}>Done</strong>
            <span>{doneFoldWords(props.rows)}</span>
            <LinkButton onClick={() => setShowDone((v) => !v)}>{showDone ? 'Fold them' : 'Show them'}</LinkButton>
          </div>
          {showDone ? <div style={{ marginTop: 8 }}>{rowsOf(done, true)}</div> : null}
        </div>
      ) : null}
    </div>
  )
}
