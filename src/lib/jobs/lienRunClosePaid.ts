/**
 * Close a paid notice (v2.7353). A notice in the run whose job owes $0 today is held
 * (`lienRunNothingToClaim`, v2.7337), and until now nothing let it leave: Take back only un-prints
 * it, so it sat in Ready to send, held again. Closing sets the desk item aside (`voided_at`, the
 * column a job combine already uses), so every reader of the desk skips it: the run, the pill, the
 * To do row and the piles. A paid job has no months to draft, so it leaves the desk with its notice,
 * and it comes back by itself when it owes again. The item keeps one line saying who closed it and
 * what the paper said (`fields.runClosedPaid`). Pure: the run window draws what this says;
 * `closePaidLienDeskItems` writes it.
 */
import { batchWords, countedLabel, pluralNoun, type BatchWords } from '../batchWords'
import { recipientViaDocsmit, type RunNotice } from './lienDeskRun'
import { lienRunNothingToClaim } from './lienRunChecklist'

const NOUN = 'paid notice'

/** Kept on the item's `fields` as `runClosedPaid`. */
export type LienRunClosedPaid = {
  /** When it was closed (an instant). */
  at: string
  by: string | null
  byName: string | null
  /** When its packet had printed (an instant), or null when it never printed. */
  printedAt: string | null
  /** What the paper claimed, in dollars, or null when the draft carried no figure. */
  paperClaim: number | null
}

export function runClosedPaidOf(fields: unknown): LienRunClosedPaid | null {
  if (!fields || typeof fields !== 'object') return null
  const v = (fields as { runClosedPaid?: unknown }).runClosedPaid
  if (!v || typeof v !== 'object') return null
  const c = v as Partial<LienRunClosedPaid>
  if (typeof c.at !== 'string' || !c.at) return null
  return {
    at: c.at,
    by: typeof c.by === 'string' ? c.by : null,
    byName: typeof c.byName === 'string' && c.byName.trim() ? c.byName.trim() : null,
    printedAt: typeof c.printedAt === 'string' ? c.printedAt : null,
    paperClaim: typeof c.paperClaim === 'number' && Number.isFinite(c.paperClaim) ? c.paperClaim : null,
  }
}

/** The item's fields with the closing line set; every other field is kept. */
export function fieldsWithClosedPaid(fields: unknown, closed: LienRunClosedPaid): Record<string, unknown> {
  const base = fields && typeof fields === 'object' && !Array.isArray(fields) ? (fields as Record<string, unknown>) : {}
  return { ...base, runClosedPaid: { ...closed } }
}

/** The claim the draft carries, as a number, or null: what the paper says. */
export function paperClaimOf(fields: unknown): number | null {
  if (!fields || typeof fields !== 'object') return null
  const f = fields as { notice?: { claimAmount?: unknown }; claimAmount?: unknown }
  const raw = f.notice?.claimAmount ?? f.claimAmount
  const n = typeof raw === 'number' ? raw : typeof raw === 'string' && raw.trim() ? Number(raw.replace(/[^0-9.-]/g, '')) : NaN
  return Number.isFinite(n) && n > 0.005 ? n : null
}

/** A row the close may set aside: a monthly notice still live. The write filters on the same rule. */
export function canClosePaidItem(item: { kind?: string | null; status?: string | null; voided_at?: string | null }): boolean {
  return item.kind === 'notice_53_056' && item.status !== 'sent' && item.status !== 'missed' && !item.voided_at
}

export type RunPaidHeld = { itemId: string; label: string; why: string }

/**
 * The run's paid notices: the ones the press closes, and the ones it leaves with the reason.
 * A retainage notice is not a month's claim, so *paid* is not its word. A notice with a copy
 * mailed through Docsmit went out, so closing it would drop a mailing.
 */
export function runPaidNotices(notices: ReadonlyArray<Pick<RunNotice, 'itemId' | 'label' | 'kind' | 'amount' | 'fields' | 'printedAt' | 'recipients'>>): { ready: string[]; held: RunPaidHeld[] } {
  const ready: string[] = []
  const held: RunPaidHeld[] = []
  for (const n of notices) {
    if (lienRunNothingToClaim(n) == null) continue
    if (n.kind !== 'notice_53_056') held.push({ itemId: n.itemId, label: n.label, why: 'A retainage notice is not closed from the run.' })
    else if (n.recipients.some(recipientViaDocsmit)) held.push({ itemId: n.itemId, label: n.label, why: 'A copy went out through Docsmit, so it is not closed.' })
    else if (!ready.includes(n.itemId)) ready.push(n.itemId)
  }
  return { ready, held }
}

/** The fold's line over the paid rows: "5 paid notices · nothing to send". */
export function runPaidFoldWords(count: number): string {
  return `${count} ${pluralNoun(NOUN, count)} · nothing to send`
}

/** The press on the fold's line: *Close 5 paid notices*, or *Close 4 paid notices · 1 stays ▸* when one is left. */
export function runClosePaidPress(input: { ready: number; held: number }): BatchWords {
  return batchWords({ verb: 'Close', ready: input.ready, held: input.held, heldWhy: { one: 'stays', many: 'stay' }, noun: NOUN })
}

/** The confirm's words, in plain sentences. `printed` is how many of them printed. */
export function runClosePaidConfirm(input: { count: number; printed: number }): { title: string; lines: string[]; button: string } {
  const one = input.count === 1
  const lines = [
    one ? 'The job owes $0 now, so nothing is mailed.' : 'These jobs owe $0 now, so nothing is mailed.',
    one ? 'The notice leaves the run and the desk.' : 'Each notice leaves the run and the desk.',
  ]
  if (input.printed > 0) lines.push(input.printed === 1 ? 'The copy that printed stays in the job’s Documents, filed as printed.' : 'The copies that printed stay in each job’s Documents, filed as printed.')
  lines.push('A job that owes again comes back to the desk by itself.')
  return { title: one ? 'Close the paid notice?' : `Close the ${input.count} paid notices?`, lines, button: countedLabel('Close', input.count, NOUN) }
}

/** Under the confirm's lines: closing is not a record of a mailing. */
export const RUN_CLOSE_PAID_CAUTION = 'Closing does not record a mailing. Leave a notice that went out.'

/** The strip after a close: "Closed 5 paid notices. Nothing was mailed." */
export function runClosedPaidWords(count: number): string {
  return `${countedLabel('Closed', count, NOUN)}. Nothing was mailed.`
}

/** The notices left in the window after a close. */
export function runNoticesClosed<T extends Pick<RunNotice, 'itemId'>>(notices: ReadonlyArray<T>, itemIds: ReadonlyArray<string>): T[] {
  const ids = new Set(itemIds)
  return notices.filter((n) => !ids.has(n.itemId))
}
