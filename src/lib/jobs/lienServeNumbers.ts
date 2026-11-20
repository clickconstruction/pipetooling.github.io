/**
 * Every filed lien's mail numbers in one place (punch list #366, step 4). After the post office the office holds a
 * handful of certified mail receipts, and until then each number was typed in its own job's Lien window: twelve liens
 * under a GC were twelve windows and twenty-four numbers. One window lists every filed lien that owes its copies,
 * with a row per envelope.
 *
 * Everything on it saves by itself (the owner's call of 2026-11-18). Until then a receipt and a number were kept the
 * moment they were added, and the *Mailed* tick with its day waited on a button, **Record N liens served**. Taunya
 * put a file on every envelope before anything was mailed. Each file ticked *Mailed*, she unticked the liens, and the
 * button's count dropped, which read as her work being dropped: *"If I uncheck the mail (because I haven't mailed
 * them yet, it removes them from blue button on the bottom right"*. So there is no button now. A tick writes the
 * *Mailed on* day to that lien at once and an untick takes it back.
 *
 * What ticks the box changed with it. A file alone no longer does: a file can be the wrong file, and the tick is a
 * legal fact, the day the five days of § 53.055 were met. A mail number does, once, on a lien nobody has ticked or
 * unticked by hand in this sitting. After a hand has touched the box it is the hand's.
 *
 * The record is the one the Lien window's form writes, through `serviceSends`: the day on `served_at`, and the day on
 * each copy that has a number or a receipt.
 *
 * Pure. `lienServeMailedIo.ts` writes.
 */
import { formatYmdMonthDay } from './billedExpectedPay'
import { parseLienSends, type LienSendLike } from './lienSendTracking'
import { serviceCopyDraft, type ServiceCopy, type ServiceCopyDraft } from './lienServiceProof'
import type { LienServeJob } from './lienServePackets'

/** What the window holds for one filed lien while it is filled in. `contractor` is null on a job contracted with the owner. */
export type LienServeDraft = { mailed: boolean; owner: ServiceCopyDraft; contractor: ServiceCopyDraft | null }

/** The filing's own answer to whether an original contractor gets a copy, the job's when the paper keeps none. */
export function lienServeHasContractor(job: Pick<LienServeJob, 'isSub' | 'filing'>): boolean {
  const kept = job.filing.fields && typeof job.filing.fields === 'object' && !Array.isArray(job.filing.fields) ? (job.filing.fields as Record<string, unknown>).isSub : undefined
  return typeof kept === 'boolean' ? kept : job.isSub
}

/** A lien's draft as the window opens on it: whatever the filing already holds, ticked when its day is on record. */
export function lienServeDraftFor(job: Pick<LienServeJob, 'isSub' | 'filing'>): LienServeDraft {
  return { mailed: Boolean((job.filing.served_at ?? '').toString().trim()), owner: serviceCopyDraft(job.filing.sends, 'owner'), contractor: lienServeHasContractor(job) ? serviceCopyDraft(job.filing.sends, 'original_contractor') : null }
}

/** One copy's number or receipt changed. The tick is not changed here: `lienServeNumberTicks` says when a number sets it. */
export function lienServeDraftWith(draft: LienServeDraft, copy: ServiceCopy, next: ServiceCopyDraft): LienServeDraft {
  return copy === 'owner' ? { ...draft, owner: next } : { ...draft, contractor: draft.contractor ? next : null }
}

/**
 * Whether a number just kept ticks *Mailed*: the lien is not ticked, a copy holds a mail number, and nobody has ticked
 * or unticked it by hand in this sitting. A receipt with no number never does.
 */
export function lienServeNumberTicks(draft: LienServeDraft, touchedByHand: boolean): boolean {
  if (touchedByHand || draft.mailed) return false
  return [draft.owner, draft.contractor].some((d) => d != null && d.tracking.trim() !== '')
}

/** The day a tick writes: the *Mailed on* box when it holds a day, else nothing and the reason. */
export function lienServeTickDay(servedOn: string): { ymd: string; why: '' } | { ymd: null; why: string } {
  const day = (servedOn ?? '').trim()
  return /^\d{4}-\d{2}-\d{2}$/.test(day) ? { ymd: day, why: '' } : { ymd: null, why: LIEN_SERVE_NUMBERS_WORDS.needDay }
}

const COPIES: ReadonlyArray<ServiceCopy> = ['owner', 'original_contractor']

/**
 * A filing's `sends` with the mailing's day put on, or taken off, each copy the lien mails. A copy with a number or a
 * receipt keeps its row either way. A copy left with nothing at all is dropped, so an untick leaves the filing as an
 * unserved one holds it. A notice's sends, and any other recipient's, are untouched.
 */
export function lienSendsWithMailedDay(sends: unknown, day: string | null): LienSendLike[] {
  const out: LienSendLike[] = []
  for (const row of parseLienSends(sends)) {
    if (!COPIES.includes(row.recipient as ServiceCopy)) {
      out.push(row)
      continue
    }
    const next: LienSendLike = { ...row }
    if (day) next.sent_on = day
    else delete next.sent_on
    const empty = !(next.tracking ?? '').trim() && !(next.receipt_url ?? '').trim() && !(next.piece_id ?? '').trim()
    if (!empty) out.push(next)
  }
  return out
}

/** Whether a mailed lien still lacks something: a copy it mails has no number, or no receipt. */
export function lienServeProofMissing(job: Pick<LienServeJob, 'isSub' | 'filing'>): boolean {
  const copies: ServiceCopyDraft[] = [serviceCopyDraft(job.filing.sends, 'owner'), ...(lienServeHasContractor(job) ? [serviceCopyDraft(job.filing.sends, 'original_contractor')] : [])]
  return copies.some((c) => !c.tracking.trim() || !c.receiptUrl.trim())
}

export const LIEN_SERVE_NUMBERS_WORDS = {
  day: 'Mailed on',
  dayHint: 'A tick writes this day.',
  /** On the lien a printed code opened (v2.7964): the day its first number records, said before a number is typed. */
  codeDay: (day: string) => `The first number marks this lien mailed on ${day}. Mailed another day? Change Mailed on at the top first.`,
  mailed: 'Mailed',
  hint: 'Scan or type each number. Enter moves to the next envelope. A number ticks Mailed on its lien. Mailed with no number yet? Tick it by hand.',
  none: 'Nothing waiting on its copies. Every filed lien is served.',
  /** The number box and the receipt press, named for the post office's slip: a lien's own paper is not a receipt. */
  numberPlaceholder: 'the number on the mail receipt',
  addReceipt: 'Add the mail receipt',
  receiptSaved: 'Mail receipt saved',
  receiptHint: 'The post office’s slip for this envelope. A photo or a PDF.',
  /** Over the liens that are mailed and still shown. */
  mailedHead: 'Mailed',
  mailedWhy: 'A mailed lien stays here until each envelope has its number and its receipt.',
  needDay: 'Set the day the copies were mailed.',
  /** Under a lien that holds a receipt or a number and is not ticked. */
  tickWhen: 'Kept on this lien. Tick Mailed when its envelopes have gone out.',
  takenBack: 'Not mailed. Saved.',
  foot: 'Everything here is saved as you go.',
} as const

/** Beside a ticked box: *Mailed Nov 18. Saved.* */
export function lienMailedSavedWords(ymd: string): string {
  return `Mailed ${formatYmdMonthDay(ymd)}. Saved.`
}

/** Beside a box whose write did not land: the reason, and that the box is back as the lien holds it. */
export function lienMailedNotSavedWords(reason: string): string {
  const why = (reason ?? '').trim().replace(/[.\s]+$/, '')
  return `Not saved${why ? `: ${why}` : ''}. The box is back as the lien holds it.`
}
