/**
 * Won → Dispatch opens the job (v2.3143).
 *
 * A won bid becomes a Task Dispatch to-do (`dispatch_requests` with
 * `pending_action = 'open_job_from_bid'` and the bid attached). The Dispatch
 * inbox row carries one button — "Open the job" — that runs the same
 * `openNewJob({ prefillBidId })` the bid's own Job block runs; when a job
 * carrying the bid exists the row closes itself with the J number in its note.
 *
 * Who sends it: `wonHandoffMode` in `wonMomentActions.ts` — every role with the
 * New Job door gets a quiet "Ask Dispatch to open it" beside "Open the job";
 * the one role that can mark Won without that door (primary) gets the ask as
 * its primary button and the Edit Bid autosave sends it on its own the moment
 * Won lands. This kernel holds the pure parts: titles, notes, the decision,
 * and the sweep that retires rows once a job exists.
 */
import { wonHandoffMode } from './wonMomentActions'

export const OPEN_JOB_FROM_BID_ACTION = 'open_job_from_bid'

export type BidHandoffIdentity = {
  bidNumber: string | null | undefined
  projectName: string | null | undefined
}

/** "B398 · ZZ Test" — the bid the way every bid surface spells it. */
export function bidHandoffLabel(b: BidHandoffIdentity): string {
  const num = (b.bidNumber ?? '').toString().trim()
  const name = (b.projectName ?? '').trim()
  return [num ? `B${num}` : null, name || null].filter(Boolean).join(' · ') || 'this bid'
}

/** The inbox title IS the to-do: "Open the job for B398 · ZZ Test — won with Southern Post". */
export function wonHandoffTitle(b: BidHandoffIdentity & { gcName: string | null | undefined }): string {
  const gc = (b.gcName ?? '').trim()
  return `Open the job for ${bidHandoffLabel(b)} — ${gc ? `won with ${gc}` : 'marked Won'}`
}

/** `reference_summary`, the same "B… · …" shape the header modal and Clock In use. */
export function wonHandoffReference(b: BidHandoffIdentity & { address: string | null | undefined }): string {
  const addr = (b.address ?? '').trim()
  const head = bidHandoffLabel(b)
  return addr ? `${head} — ${addr}` : head
}

/** The close note: "J1007 opened from B398 · ZZ Test" (+ "elsewhere" when the inbox found the job rather than made it). */
export function wonHandoffClosedNote(args: { hcpNumber: string | null | undefined; bidLabel: string; elsewhere: boolean }): string {
  const hcp = (args.hcpNumber ?? '').trim().replace(/^J/i, '')
  const job = hcp ? `J${hcp}` : 'A job'
  return args.elsewhere ? `${job} was opened from ${args.bidLabel} elsewhere — nothing left to do` : `${job} opened from ${args.bidLabel}`
}

export type WonHandoffDecision =
  | { action: 'send' }
  | { action: 'already-asked'; message: string }
  | { action: 'has-job'; message: string }

/**
 * What pressing "Ask Dispatch" does. A job already carrying the bid wins over
 * an open request (there is nothing left to ask for); an open request means
 * Dispatch already has it.
 */
export function decideWonHandoff(input: {
  existingJobHcp: string | null | undefined
  existingOpenRequestId: string | null | undefined
  bidLabel: string
}): WonHandoffDecision {
  const hcp = (input.existingJobHcp ?? '').trim()
  if (hcp !== '') return { action: 'has-job', message: `J${hcp.replace(/^J/i, '')} was already opened from ${input.bidLabel} — nothing to ask Dispatch for.` }
  if ((input.existingOpenRequestId ?? '').trim()) return { action: 'already-asked', message: 'Dispatch already has this one — it is in their inbox.' }
  return { action: 'send' }
}

export function wonHandoffSentMessage(bidLabel: string): string {
  return `Sent to Dispatch — they'll open the job from ${bidLabel}.`
}

/**
 * The automatic send: a role with no New Job door just marked the bid Won.
 * Only the Open/Lost → Won transition qualifies — re-saving a bid that was
 * already Won never files a second to-do.
 */
export function shouldAutoAskDispatchOnWon(input: {
  role: string | null | undefined
  previousOutcome: string | null
  nextOutcome: string | null
}): boolean {
  return wonHandoffMode(input.role) === 'auto' && input.nextOutcome === 'won' && input.previousOutcome !== 'won'
}

/** "Dispatch asked · by Wendi · 2 min ago" — the chip on the bid while the to-do is open. */
export function dispatchAskedLabel(args: { senderName: string | null | undefined; createdAtIso: string | null | undefined; nowMs?: number }): string {
  const who = (args.senderName ?? '').trim()
  const parts = ['Dispatch asked']
  if (who) parts.push(`by ${who}`)
  const when = relativeAge(args.createdAtIso, args.nowMs ?? Date.now())
  if (when) parts.push(when)
  return parts.join(' · ')
}

function relativeAge(iso: string | null | undefined, nowMs: number): string | null {
  if (!iso) return null
  const t = new Date(iso).getTime()
  if (!Number.isFinite(t)) return null
  const mins = Math.max(0, Math.round((nowMs - t) / 60000))
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins} min ago`
  const hours = Math.round(mins / 60)
  if (hours < 24) return `${hours} h ago`
  const days = Math.round(hours / 24)
  return days === 1 ? 'yesterday' : `${days} days ago`
}

export type OpenJobFromBidSweepRow = {
  id: string
  status: 'open' | 'closed'
  pending_action: string | null
  bid_id?: string | null
}

/** The bid ids the inbox should look up jobs for (open open_job_from_bid rows only). */
export function bidIdsForOpenJobSweep(rows: readonly OpenJobFromBidSweepRow[]): string[] {
  const out = new Set<string>()
  for (const r of rows) {
    if (r.status === 'open' && r.pending_action === OPEN_JOB_FROM_BID_ACTION && r.bid_id) out.add(r.bid_id)
  }
  return [...out]
}

/**
 * Which open to-dos a job has made redundant: the bid already carries a job
 * (someone opened it from the bid's own Job block, or an import). Returns one
 * entry per bid so the close writes once per bid, not per row.
 */
export function pickOpenJobRequestsToClose(
  rows: readonly OpenJobFromBidSweepRow[],
  jobsByBidId: ReadonlyMap<string, { hcpNumber: string | null }>,
): Array<{ bidId: string; hcpNumber: string | null }> {
  const out = new Map<string, { bidId: string; hcpNumber: string | null }>()
  for (const bidId of bidIdsForOpenJobSweep(rows)) {
    const job = jobsByBidId.get(bidId)
    if (job && !out.has(bidId)) out.set(bidId, { bidId, hcpNumber: job.hcpNumber })
  }
  return [...out.values()]
}
