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
import { priorNumbersBare } from '../../lib/jobs/priorNumbers'
import type { HistoryPiece } from '../../lib/developments/history'
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
  /** The address matches drawn on the page while the toggle is on: their rows carry a small *not in <development>* mark. */
  notInIt: ReadonlySet<string>
  /** The development's name, which the chip names: *not in Gun Dog*. */
  developmentName: string
  /** Pair mode (the owner's pick: a toggle, and when on the table reads as draft B): the row's gaps become the tool. */
  pairing?: PairingProps
  /** The *not in <development>* chip presses: put the piece in the development after a confirm. */
  onPutIn?: (kind: 'bid' | 'job', id: string) => void
  /** The *archived* chip presses: put the bid back on the Unsent/Working board after a confirm. */
  onPutBackOnBoard?: (bid: MemberBid) => void
  /** The *history ›* door under a piece's name: narrows the History look to this piece, the bid and the job it became. */
  onHistory?: (piece: HistoryPiece) => void
  busy?: boolean
  /** False for a reader with no money (`readDoor.ts`, v2.6053): no price under a bid, no figure under a job, the Done fold's count alone. True when absent. */
  moneyShown?: boolean
}

function BidCell({ bid, label, estimator, open, unpair, putBackOnBoard, busy, moneyShown }: { bid: MemberBid; label: string; estimator: string | null; open: () => void; unpair?: () => void; putBackOnBoard?: () => void; busy?: boolean; moneyShown: boolean }) {
  const status = bidStatusWord(bid)
  const value = bidMoney(bid)
  const when = bid.bid_date_sent ? `sent ${shortDay(bid.bid_date_sent)}` : bid.bid_due_date ? `due ${shortDay(bid.bid_due_date)}` : null
  const line = [moneyShown ? (value != null ? money(value) : 'no price yet') : null, estimator, when].filter((x): x is string => !!x).join(' · ')
  return (
    <div style={{ display: 'grid', gap: 2, minWidth: 0 }}>
      <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
        <LinkButton onClick={open} strong>
          {label}
        </LinkButton>
        {status === 'archived' && putBackOnBoard ? (
          <PressChip label={status} color={BID_STATUS_COLOR[status]} title="Archived off the Unsent/Working board, never sent, no outcome. Press to put it back on the board." onClick={putBackOnBoard} disabled={busy} testId="chip-off-the-board" />
        ) : (
          <Chip label={status} color={BID_STATUS_COLOR[status]} soft={status === 'archived' || status === 'working'} />
        )}
        {unpair ? (
          <button
            type="button"
            onClick={unpair}
            title="A window shows what changes first; then it clears the job's bid link and nothing else, and the toast offers Put it back"
            data-testid="unpair"
            style={{ border: '1px solid var(--border-strong)', background: 'var(--bg-subtle)', borderRadius: 4, padding: '0 6px', fontSize: '0.68rem', fontWeight: 600, color: 'var(--text-700)', cursor: 'pointer', font: 'inherit', lineHeight: 1.6 }}
          >
            Unpair
          </button>
        ) : null}
      </div>
      {line ? <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{line}</div> : null}
    </div>
  )
}

function JobCell({ job, label, crew, open, moneyShown }: { job: MemberJob; label: string; crew: string[]; open: () => void; moneyShown: boolean }) {
  const status = labelJobsLedgerStatusForDashboard(job.status)
  const openOnBill = jobOpenOnBill(job)
  const revenue = job.revenue ?? 0
  const line = [
    moneyShown ? (openOnBill > 0 ? `${money(openOnBill)} open` : revenue > 0 ? money(revenue) : '$0') : null,
    crew.length ? `${crew[0]}${crew.length > 1 ? `, +${crew.length - 1}` : ''}` : (job.status ?? '').toLowerCase() === 'waiting' ? 'not scheduled' : null,
    job.last_work_date ? `last work ${shortDay(job.last_work_date)}` : null,
    // The numbers the job answered to before a combine (v2.6226): the HCP numbers from the old system stay readable.
    priorNumbersBare(job.prior_numbers) || null,
  ]
    .filter((x): x is string => !!x)
    .join(' · ')
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
      {line ? <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{line}</div> : null}
    </div>
  )
}

function PlansCell({ row }: { row: PieceRow }) {
  if (!row.plans.set) return <span style={{ color: 'var(--text-faint)', fontSize: '0.76rem' }}>none</span>
  const s = row.plans.set
  const dated = s.dated ? `${shortDay(s.dated)} set` : s.filedAt ? `filed ${shortDay(s.filedAt)}` : 'a set'
  return (
    <span style={{ fontSize: '0.76rem', display: 'inline-flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
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
    <div style={{ display: 'grid', gap: 1, fontSize: '0.76rem' }}>
      <span style={{ fontWeight: 700, color: 'var(--text-amber-800)' }}>
        {w.who} · {age}
      </span>
      <span style={{ color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 220 }}>{w.what}</span>
    </div>
  )
}

// The column headers read as the Bid Board's do (the owner, 2026-10-28: *large, like on the bids tab*): its
// `th` size and weight, the strong color, no small caps, on the same subtle band.
// The owner, 2026-10-28, second pass: the titles were still small beside the rows, so the titles lead
// (0.82rem bold) and the rows read under them (0.78rem, the Bid Board's density).
const th: React.CSSProperties = { textAlign: 'left', padding: '0.4rem 0.5rem', fontSize: '0.82rem', lineHeight: 1.25, fontWeight: 700, color: 'var(--text-strong)', borderBottom: '1px solid var(--border)' }
const td: React.CSSProperties = { padding: '6px 8px', verticalAlign: 'top', borderBottom: '1px solid var(--border)' }

function NotInItMark({ name, onPress, busy }: { name: string; onPress?: () => void; busy?: boolean }) {
  if (!onPress) return <Chip label={`not in ${name}`} color="#9ca3af" soft />
  return <PressChip label={`not in ${name}`} color="#9ca3af" title={`At the site's address, not in ${name}. Press to put it in.`} onClick={onPress} disabled={busy} testId="chip-not-in-it" />
}

export function DevelopmentPieces(props: PiecesProps) {
  const phone = useMatchMedia(DEVELOPMENT_PHONE_QUERY)
  const [showDone, setShowDone] = useState(false)
  // A column of dashes says nothing: the Waiting on column is drawn only while a piece waits (the owner, 2026-10-28: *do all 8*, item 7); the tile and the strip say when none does.
  const anyWaiting = props.rows.some((r) => r.waiting)
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
  const moneyShown = props.moneyShown !== false
  const unpairFor = (row: PieceRow) => (pairing && row.job && row.bid && !pairing.busy ? () => pairing.onUnpair(row.job!.id, row.bid!.id) : undefined)

  const rowsOf = (rows: PieceRow[], muted: boolean): ReactNode =>
    phone ? (
      <div style={{ display: 'grid', gap: 8 }}>
        {rows.map((row) => (
          <div key={row.key} style={{ border: '1px solid var(--border)', borderRadius: 8, padding: '8px 10px', background: 'var(--surface)', opacity: muted ? 0.75 : 1 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
              <strong style={{ color: 'var(--text-strong)', fontSize: '0.92rem' }}>{row.name}</strong>
              {row.waiting ? (
                <span style={{ marginLeft: 'auto', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-amber-800)' }}>
                  {row.waiting.who} · {row.waiting.ageDays === 0 ? 'today' : `${row.waiting.ageDays} days`}
                </span>
              ) : null}
            </div>
            {isNotInIt(row) ? (
              <div style={{ marginTop: 4 }}>
                <NotInItMark name={props.developmentName} onPress={putInFor(row)} busy={props.busy} />
              </div>
            ) : null}
            <div style={{ display: 'grid', gap: 6, marginTop: 6 }}>
              {row.bid ? <BidCell bid={row.bid} label={props.bidLabel(row.bid)} estimator={estimatorFor(row.bid)} open={() => props.openBid(row.bid!.id)} unpair={unpairFor(row)} putBackOnBoard={putBackFor(row)} busy={props.busy} moneyShown={moneyShown} /> : pairing && row.job ? <CameFromCell job={row.job} pairing={pairing} bidLabel={props.bidLabel} names={props.names} /> : null}
              {row.job ? <JobCell job={row.job} label={props.jobLabel(row.job)} crew={crewFor(row.job)} open={() => props.openJob(row.job!.id)} moneyShown={moneyShown} /> : pairing && row.bid ? <BecameCell bid={row.bid} pairing={pairing} jobLabel={props.jobLabel} /> : null}
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
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem', opacity: muted ? 0.75 : 1 }}>
        <thead style={{ background: 'var(--bg-subtle)' }}>
          <tr>
            {/* The two record columns get the room: in pair mode each gap cell carries four presses on one row. */}
            <th style={{ ...th, width: '18%' }}>Name</th>
            <th style={{ ...th, width: '27%' }}>Bid</th>
            <th style={{ ...th, width: '33%' }}>Job</th>
            <th style={{ ...th, width: anyWaiting ? '12%' : '22%' }}>Plans</th>
            {anyWaiting ? <th style={{ ...th, width: '10%' }}>Waiting on</th> : null}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.key} data-testid="piece-row">
              <td style={{ ...td, fontWeight: 600, color: 'var(--text-strong)', maxWidth: 260, fontSize: '0.8rem' }}>
                {/* Two rows, as the gap cells beside it (the owner, 2026-10-28): the name, then the chip. */}
                <div style={{ display: 'grid', gap: 4, minWidth: 0 }}>
                  <span style={{ overflowWrap: 'anywhere', minHeight: 20, display: 'flex', alignItems: 'center' }}>{row.name}</span>
                  {props.onHistory && (row.job || row.bid) ? (
                    <span style={{ fontSize: '0.72rem', fontWeight: 500 }}>
                      <LinkButton onClick={() => props.onHistory!({ jobId: row.job?.id ?? null, bidId: row.bid?.id ?? null, label: row.job ? props.jobLabel(row.job) : props.bidLabel(row.bid!) })} title="This piece's history: its notes, plans, moves and what happened">
                        history ›
                      </LinkButton>
                    </span>
                  ) : null}
                  {isNotInIt(row) ? (
                    <div style={{ display: 'flex', alignItems: 'center', minHeight: 20 }}>
                      <NotInItMark name={props.developmentName} onPress={putInFor(row)} busy={props.busy} />
                    </div>
                  ) : null}
                </div>
              </td>
              <td style={td}>{row.bid ? <BidCell bid={row.bid} label={props.bidLabel(row.bid)} estimator={estimatorFor(row.bid)} open={() => props.openBid(row.bid!.id)} unpair={unpairFor(row)} putBackOnBoard={putBackFor(row)} busy={props.busy} moneyShown={moneyShown} /> : pairing && row.job ? <CameFromCell job={row.job} pairing={pairing} bidLabel={props.bidLabel} names={props.names} /> : <span style={{ color: 'var(--text-faint)' }}>no bid here</span>}</td>
              <td style={td}>{row.job ? <JobCell job={row.job} label={props.jobLabel(row.job)} crew={crewFor(row.job)} open={() => props.openJob(row.job!.id)} moneyShown={moneyShown} /> : pairing && row.bid ? <BecameCell bid={row.bid} pairing={pairing} jobLabel={props.jobLabel} /> : <span style={{ color: 'var(--text-faint)' }}>no job yet</span>}</td>
              <td style={td}>
                <PlansCell row={row} />
              </td>
              {anyWaiting ? (
                <td style={td}>
                  <WaitingCell row={row} />
                </td>
              ) : null}
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
          <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-strong)', margin: '0 0 6px' }}>
            Working or waiting · {open.length}
          </div>
          {rowsOf(openShown, false)}
          {phone && open.length > PHONE_CAP && !showAll ? (
            <div style={{ marginTop: 8 }}>
              <LinkButton onClick={() => setShowAll(true)}>Show the other {open.length - PHONE_CAP} rows</LinkButton>
            </div>
          ) : null}
        </div>
      ) : null}
      {done.length > 0 ? (
        <div style={{ borderTop: '1px dashed var(--border)', paddingTop: 8 }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'baseline', flexWrap: 'wrap', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            <strong style={{ color: 'var(--text-strong)' }}>Done</strong>
            <span>{doneFoldWords(props.rows, moneyShown ? money : undefined)}</span>
            <LinkButton onClick={() => setShowDone((v) => !v)}>{showDone ? 'Fold them' : 'Show them'}</LinkButton>
          </div>
          {showDone ? <div style={{ marginTop: 8 }}>{rowsOf(done, true)}</div> : null}
        </div>
      ) : null}
    </div>
  )
}
