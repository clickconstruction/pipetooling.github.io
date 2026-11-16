/**
 * Every filed lien's mail numbers in one place (punch list #366, step 4). After the post office the office holds a
 * handful of certified mail receipts, and until now each number was typed in its own job's Lien window: twelve liens
 * under a GC were twelve windows and twenty-four numbers. One window lists every filed lien that owes its copies,
 * with a row per envelope, and one press records the day and the numbers.
 *
 * The record is the one **Record service…** writes, through `serviceSends`: the day on `served_at`, and a send per
 * copy that has a number or a receipt photo. A lien is recorded only when its *Mailed* box is ticked. Typing a
 * number ticks it; a lien mailed with no number yet can be ticked by hand, and its number follows from the Filings
 * list as before. A lien nobody ticked is left exactly as it was.
 *
 * Pure. `lienServeNumbersIo.ts` writes.
 */
import { batchOutcomeWords, countedLabel, type BatchOutcome } from '../batchWords'
import type { LienSendLike } from './lienSendTracking'
import { serviceCopyDraft, serviceSends, type ServiceCopy, type ServiceCopyDraft } from './lienServiceProof'
import type { LienServeJob } from './lienServePackets'

/** What the window holds for one filed lien while it is filled in. `contractor` is null on a job contracted with the owner. */
export type LienServeDraft = { mailed: boolean; owner: ServiceCopyDraft; contractor: ServiceCopyDraft | null }

/** The filing's own answer to whether an original contractor gets a copy, the job's when the paper keeps none. */
export function lienServeHasContractor(job: Pick<LienServeJob, 'isSub' | 'filing'>): boolean {
  const kept = job.filing.fields && typeof job.filing.fields === 'object' && !Array.isArray(job.filing.fields) ? (job.filing.fields as Record<string, unknown>).isSub : undefined
  return typeof kept === 'boolean' ? kept : job.isSub
}

/** A lien's draft as the window opens on it: whatever the filing already holds, and not yet ticked. */
export function lienServeDraftFor(job: Pick<LienServeJob, 'isSub' | 'filing'>): LienServeDraft {
  return { mailed: false, owner: serviceCopyDraft(job.filing.sends, 'owner'), contractor: lienServeHasContractor(job) ? serviceCopyDraft(job.filing.sends, 'original_contractor') : null }
}

/** One copy's number or photo changed: the lien is ticked as soon as either copy has one. A box unticked by hand stays unticked until the next keystroke. */
export function lienServeDraftWith(draft: LienServeDraft, copy: ServiceCopy, next: ServiceCopyDraft): LienServeDraft {
  const out: LienServeDraft = copy === 'owner' ? { ...draft, owner: next } : { ...draft, contractor: draft.contractor ? next : null }
  const typed = [out.owner, out.contractor].some((d) => d && (d.tracking.trim() !== '' || d.receiptUrl.trim() !== ''))
  return typed ? { ...out, mailed: true } : out
}

export type LienServeWrite = { filingId: string; jobId: string; jobLabel: string; servedOn: string; sends: LienSendLike[] }

/** The writes one press makes: a row for each ticked lien, in the list's order. Empty with no day. */
export function lienServeWrites(jobs: ReadonlyArray<LienServeJob>, drafts: Readonly<Record<string, LienServeDraft | undefined>>, servedOn: string): LienServeWrite[] {
  const day = servedOn.trim()
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return []
  const out: LienServeWrite[] = []
  for (const job of jobs) {
    const d = drafts[job.filing.id]
    if (!d?.mailed) continue
    out.push({ filingId: job.filing.id, jobId: job.jobId, jobLabel: job.jobLabel, servedOn: day, sends: serviceSends({ servedOn: day, owner: d.owner, contractor: d.contractor }) })
  }
  return out
}

const NOUN = ['lien served', 'liens served'] as const

/** The press: *Record 11 liens served*, dead at none. */
export function lienServeRecordWords(writes: number, hasDay: boolean): { button: string; dead: boolean; why: string } {
  if (!hasDay) return { button: countedLabel('Record', 0, NOUN), dead: true, why: 'Set the day the copies were mailed.' }
  if (writes <= 0) return { button: countedLabel('Record', 0, NOUN), dead: true, why: 'Tick Mailed on each lien whose copies went out, or type a mail number.' }
  return { button: countedLabel('Record', writes, NOUN), dead: false, why: '' }
}

/** After the press: what took and what did not. A lien that failed stays in the list with its reason. */
export function lienServeRecordOutcome(done: number, failed: number): BatchOutcome {
  return batchOutcomeWords({ verb: 'record', past: 'recorded', done, failed, noun: NOUN })
}

export const LIEN_SERVE_NUMBERS_WORDS = {
  day: 'Mailed on',
  mailed: 'Mailed',
  hint: 'Scan or type each number. Enter moves to the next envelope. A number can follow later: tick Mailed and record the day.',
  none: 'Nothing waiting on its copies. Every filed lien is served.',
} as const
