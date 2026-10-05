import type { OwnerShareWrites } from './ownerBillShare'

/**
 * Undo an approved run (v2.4541, pure). "Approve all N and send the run" in Put a GC on notice
 * approves the notices and, with its ticks, can change the GC's standing rule, its payment
 * terms, the Legal desk and what owners see on their portals. The receipt is what that one
 * click really changed; the plan is what an undo takes back and what it cannot.
 */

export type GcRunPolicy = 'ask' | 'send' | 'hold'

/** The customer row's payment-terms columns as they were before the click. */
export type GcRunTermsBefore = {
  payment_terms: string | null
  payment_terms_note: string | null
  payment_terms_set_by: string | null
  payment_terms_set_at: string | null
}

export type GcRunReceipt = {
  gcId: string
  gcName: string
  /** Every desk item the click approved or sent to the leader. */
  itemIds: string[]
  /** Set when the click moved the standing rule to "send": what it was. */
  rule: { from: GcRunPolicy } | null
  /** Set when the click moved the terms to Winding down: the columns as they were, and their label. */
  terms: { before: GcRunTermsBefore; fromLabel: string } | null
  /** Set when the click showed bills to owners: the rows it turned on. */
  owners: { turnedOn: OwnerShareWrites } | null
  /** Set when the click saved a Legal desk matter. An undo cannot remove one. */
  legal: { jobs: number } | null
}

export function gcRunPolicyWords(policy: GcRunPolicy): string {
  return policy === 'send' ? 'Send without asking' : policy === 'hold' ? 'Hold' : 'Ask each time'
}

/** A receipt with nothing in it has nothing to undo. */
export function gcRunReceiptHasUndo(r: GcRunReceipt | null): r is GcRunReceipt {
  return !!r && r.itemIds.length > 0
}

/** What an undo takes back, and what stays, each as one plain sentence. */
export function gcRunUndoPlan(r: GcRunReceipt): { goesBack: string[]; stays: string[] } {
  const n = r.itemIds.length
  const goesBack = [`${n} ${n === 1 ? 'notice goes' : 'notices go'} back to ${n === 1 ? 'a draft' : 'drafts'}. Nothing is mailed or recorded.`]
  if (r.rule) goesBack.push(`The standing rule goes back to ${gcRunPolicyWords(r.rule.from)}.`)
  if (r.terms) goesBack.push(`Payment terms go back to ${r.terms.fromLabel}.`)
  if (r.owners && (r.owners.turnedOn.jobIds.length > 0 || r.owners.turnedOn.invoiceIds.length > 0)) goesBack.push('The bills this run showed to owners are hidden from them again.')
  const stays: string[] = []
  if (r.legal) stays.push('The Legal desk matter. Close it on the Legal desk if you do not want it.')
  return { goesBack, stays }
}

/** The confirm window's words: the two lists, one line each. */
export function gcRunUndoMessage(r: GcRunReceipt): string {
  const { goesBack, stays } = gcRunUndoPlan(r)
  const parts = [`This goes back:\n${goesBack.map((l) => `• ${l}`).join('\n')}`]
  if (stays.length) parts.push(`This stays:\n${stays.map((l) => `• ${l}`).join('\n')}`)
  return parts.join('\n\n')
}

/** The strip in the run window: what was just done, as one sentence. */
export function gcRunUndoStripWords(r: GcRunReceipt): string {
  const n = r.itemIds.length
  return `You just approved ${n === 1 ? 'this notice' : `these ${n} notices`} for ${r.gcName}. Pressed it by mistake?`
}
