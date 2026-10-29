/**
 * The pairing's confirm windows (punch list #208, the pairing step): every write the Pieces look's
 * pair mode can make opens a window first, in the chips' shape (`DevelopmentChipConfirm`): a title
 * that names the act, rows of now → after with the ones that change marked and the rest shown as
 * *same*, the row as it will read in Pieces or on the Bid Board, and a button that carries the verb.
 * Pure: the page draws what comes back and runs the write in `pairingWrites.ts` on confirm. A pair is
 * one column, `jobs_ledger.bid_id`; the rows say so by showing everything else unchanged. The toast
 * after each write carries its way back, whose words are here too.
 */
import { countedLabel, pluralNoun } from '../batchWords'
import { labelJobsLedgerStatusForDashboard } from '../jobsLedgerStatusPipeline'
import { bidMoney, bidStatusWord, type MemberBid, type MemberJob } from './overview'
import { suggestionConfidence, suggestionWhy, type PairSuggestion } from './pairing'

export type PairingConfirmRow = { label: string; before: string; after: string | null; changes: boolean }

export type PairingConfirm = {
  title: string
  rows: PairingConfirmRow[]
  previewCaption: string
  /** The rows as they will read, one line each; the page draws them under the caption. */
  previewLines: string[]
  /** Lines past the cap, counted: *and N more*. */
  previewMore: number
  confirmLabel: string
}

export type PairingLabels = { bidLabel: (b: MemberBid) => string; jobLabel: (j: MemberJob) => string }

export const PAIRING_PREVIEW_CAP = 8

const money = (n: number): string => `$${Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 })}`

/** *BP398 Lot 12*: the number and the name, the name left out when blank. */
export function bidWords(b: MemberBid, labels: PairingLabels): string {
  return `${labels.bidLabel(b)} ${(b.project_name ?? '').trim()}`.trim()
}

/** *JP1085 Lot 12*. */
export function jobWords(j: MemberJob, labels: PairingLabels): string {
  return `${labels.jobLabel(j)} ${(j.job_name ?? '').trim()}`.trim()
}

/** The bid's side of a Pieces row: *BP398 Lot 12 · won · $12,000*. */
export function bidSide(b: MemberBid, labels: PairingLabels): string {
  return `${bidWords(b, labels)} · ${bidStatusLine(b)}`
}

/** The job's side of a Pieces row: *JP1085 Lot 12 · Working · $12,000*. */
export function jobSide(j: MemberJob, labels: PairingLabels): string {
  return `${jobWords(j, labels)} · ${labelJobsLedgerStatusForDashboard(j.status)} · ${j.revenue ? money(j.revenue) : '$0'}`
}

/** *$12,000* or *no price yet*. */
function priceWords(b: MemberBid): string {
  const value = bidMoney(b)
  return value != null ? money(value) : 'no price yet'
}

/** *won · $12,000*, what the Bid status row shows and the window leaves the same. */
function bidStatusLine(b: MemberBid): string {
  return `${bidStatusWord(b)} · ${priceWords(b)}`
}

/** *Working · $12,000*. */
function jobStageLine(j: MemberJob): string {
  return `${labelJobsLedgerStatusForDashboard(j.status)} · ${j.revenue ? money(j.revenue) : '$0'}`
}

/** The jobs a bid became, by number: *JP1080, JP1085*, or *no job yet*. */
function becameWords(jobs: readonly MemberJob[], labels: PairingLabels): string {
  return jobs.length ? jobs.map((j) => labels.jobLabel(j)).join(', ') : 'no job yet'
}

/** *likely match · same value · bid first*, the reason line a suggested pair carries; empty for a picked one. */
function whyLine(s: PairSuggestion | null): string | null {
  if (!s) return null
  return `${suggestionConfidence(s) === 'likely' ? 'likely match' : 'possible match'} · ${suggestionWhy(s)}`
}

function capped(lines: string[]): { previewLines: string[]; previewMore: number } {
  return { previewLines: lines.slice(0, PAIRING_PREVIEW_CAP), previewMore: Math.max(0, lines.length - PAIRING_PREVIEW_CAP) }
}

/**
 * *Pair BP398 with JP1085?* — one pair, from a cell's press, the strip's line or the picker. The job's
 * *Came from* goes from *no bid* to the bid; the bid's *Became* gains the job (a second job joins the
 * first); the bid's status, the job's stage, the customer, the address and the development stay.
 */
export function pairConfirm(args: {
  bid: MemberBid
  job: MemberJob
  /** The jobs the bid already became, when this is a second one. */
  bidJobs: readonly MemberJob[]
  suggestion: PairSuggestion | null
  customerName: string | null
  developmentName: string
  labels: PairingLabels
}): PairingConfirm {
  const { bid, job, labels } = args
  const b = labels.bidLabel(bid)
  const j = labels.jobLabel(job)
  const why = whyLine(args.suggestion)
  return {
    title: `Pair ${b} with ${j}?`,
    rows: [
      { label: `${j} came from`, before: 'no bid', after: bidWords(bid, labels), changes: true },
      { label: `${b} became`, before: becameWords(args.bidJobs, labels), after: becameWords([...args.bidJobs, job], labels), changes: true },
      { label: 'Bid status', before: bidStatusLine(bid), after: null, changes: false },
      { label: 'Job stage', before: jobStageLine(job), after: null, changes: false },
      { label: 'Customer', before: (job.customer_name ?? '').trim() || args.customerName?.trim() || '—', after: null, changes: false },
      { label: 'Development', before: args.developmentName, after: null, changes: false },
    ],
    previewCaption: 'As the row will read in Pieces',
    ...capped([`${bidSide(bid, labels)} ↔ ${jobSide(job, labels)}`, ...(why ? [why] : [])]),
    confirmLabel: `Pair ${b} with ${j}`,
  }
}

/** The toast after a pair, with its way back and the words after the way back is pressed. */
export function pairedWords(bid: MemberBid, job: MemberJob, labels: PairingLabels): { line: string; back: string; undone: string } {
  const b = labels.bidLabel(bid)
  const j = labels.jobLabel(job)
  return { line: `Paired ${b} with ${j}.`, back: 'Unpair', undone: `Unpaired ${b} from ${j} again.` }
}

/**
 * *Pair the 3 likely pairs?* — the strip's counted press: the site's counts now and after, the
 * pairs that go on record one a line with why, the button with its count.
 */
export function pairAllConfirm(args: {
  pairs: ReadonlyArray<{ bid: MemberBid; job: MemberJob; suggestion: PairSuggestion }>
  /** The rows already paired on the site. */
  pairedNow: number
  unpairedBids: number
  unpairedJobs: number
  developmentName: string
  labels: PairingLabels
}): PairingConfirm {
  const n = args.pairs.length
  return {
    title: `${countedLabel('Pair the', n, 'likely pair')}?`,
    rows: [
      { label: 'Pairs on record', before: String(args.pairedNow), after: String(args.pairedNow + n), changes: n > 0 },
      { label: 'Bids with no job', before: String(args.unpairedBids), after: String(Math.max(0, args.unpairedBids - n)), changes: n > 0 },
      { label: 'Jobs with no bid', before: String(args.unpairedJobs), after: String(Math.max(0, args.unpairedJobs - n)), changes: n > 0 },
      { label: 'Development', before: args.developmentName, after: null, changes: false },
    ],
    previewCaption: 'The pairs that go on record',
    ...capped(args.pairs.map((p) => `${bidWords(p.bid, args.labels)} ↔ ${jobWords(p.job, args.labels)} · ${whyLine(p.suggestion)}`)),
    confirmLabel: countedLabel('Pair the', n),
  }
}

/** The way back after *Pair the N*: the ones that took, unpaired again. */
export function pairedAllBack(done: number): { back: string; undone: string } {
  return { back: countedLabel('Unpair the', done), undone: `${done} ${pluralNoun('pair', done)} unpaired again.` }
}

/**
 * *Unpair BP398 from JP1085?* — the job's *Came from* goes back to *no bid* and the bid's *Became*
 * loses the job; the bid's outcome and everything else stay, which is the point of showing them.
 */
export function unpairConfirm(args: {
  bid: MemberBid
  job: MemberJob
  /** Every job the bid became, this one among them. */
  bidJobs: readonly MemberJob[]
  customerName: string | null
  developmentName: string
  labels: PairingLabels
}): PairingConfirm {
  const { bid, job, labels } = args
  const b = labels.bidLabel(bid)
  const j = labels.jobLabel(job)
  const others = args.bidJobs.filter((x) => x.id !== job.id)
  return {
    title: `Unpair ${b} from ${j}?`,
    rows: [
      { label: `${j} came from`, before: bidWords(bid, labels), after: 'no bid', changes: true },
      { label: `${b} became`, before: becameWords([...others, job], labels), after: becameWords(others, labels), changes: true },
      { label: 'Bid status', before: bidStatusLine(bid), after: null, changes: false },
      { label: 'Job stage', before: jobStageLine(job), after: null, changes: false },
      { label: 'Customer', before: (job.customer_name ?? '').trim() || args.customerName?.trim() || '—', after: null, changes: false },
      { label: 'Address', before: (job.job_address ?? '').trim() || '—', after: null, changes: false },
      { label: 'Development', before: args.developmentName, after: null, changes: false },
    ],
    previewCaption: 'As the rows will read in Pieces',
    ...capped([`${bidSide(bid, labels)} ↔ ${others.length ? becameWords(others, labels) : 'no job yet'}`, `no bid here ↔ ${jobSide(job, labels)}`]),
    confirmLabel: `Unpair ${b} from ${j}`,
  }
}

/** The toast after an unpair, with its way back. */
export function unpairedWords(bid: MemberBid, job: MemberJob, labels: PairingLabels): { line: string; back: string; undone: string } {
  const b = labels.bidLabel(bid)
  const j = labels.jobLabel(job)
  return { line: `Unpaired ${b} from ${j}. The job keeps its customer, address and development.`, back: 'Put it back', undone: `Put back: ${b} with ${j}.` }
}

/**
 * *Mark the 2 paired bids won?* — the counted press on the Pieces head: the outcome goes to won
 * with today's date, the site's won and undecided counts move, the pairs and the prices stay, and
 * each bid reads as it will on the Bid Board.
 */
export function markWonConfirm(args: {
  bids: ReadonlyArray<{ bid: MemberBid; jobs: readonly MemberJob[] }>
  wonNow: number
  undecidedNow: number
  labels: PairingLabels
}): PairingConfirm {
  const n = args.bids.length
  const pairs = args.bids.flatMap((x) => x.jobs.map((j) => `${args.labels.bidLabel(x.bid)} ↔ ${args.labels.jobLabel(j)}`))
  return {
    title: `${countedLabel('Mark the', n, 'paired bid')} won?`,
    rows: [
      { label: 'Outcome', before: 'undecided', after: 'won', changes: true },
      { label: 'Won on', before: '—', after: 'today', changes: true },
      { label: 'Bids won here', before: String(args.wonNow), after: String(args.wonNow + n), changes: n > 0 },
      { label: 'Bids undecided', before: String(args.undecidedNow), after: String(Math.max(0, args.undecidedNow - n)), changes: n > 0 },
      { label: 'Pairs', before: pairs.length <= 3 ? pairs.join(', ') : `${pairs.length} pairs`, after: null, changes: false },
      { label: n === 1 ? 'Price' : 'Prices', before: n === 1 && args.bids[0] ? priceWords(args.bids[0].bid) : 'as priced', after: null, changes: false },
    ],
    previewCaption: n === 1 ? 'As it will read on the Bid Board' : 'As they will read on the Bid Board',
    ...capped(
      args.bids.map((x) => `${bidWords(x.bid, args.labels)} · won · ${priceWords({ ...x.bid, outcome: 'won' })} · ${becameWords(x.jobs, args.labels)}`),
    ),
    confirmLabel: `${countedLabel('Mark the', n, 'paired bid')} won`,
  }
}

/** The way back after the won press: the ones that took, undecided again. */
export function markedWonBack(done: number): { back: string; undone: string } {
  return { back: 'Undo', undone: done === 1 ? 'The bid is undecided again.' : `${done} bids are undecided again.` }
}
