/**
 * The firm's words (punch list #85, item 3): what the collections law firm reads on its
 * portal, in a firm's vocabulary rather than the office's. The office desk keeps its own
 * labels (`legalStageLabel`, `legalEntryKindWords`, *Needs You*); everything here is only
 * for the firm's page and the desk's preview of it. Pure.
 */
import { FIRM_EMAIL_MODE_WORDS, legalFirmStageWords } from '../legalEmails'
import { askMetaOf, answerMetaOf, isFirmAnswer, isOfficeAsk } from './legalAsks'
import type { LegalEntryRow } from './legalMatters'
import type { LegalSaidEntry, LegalStep } from './legalPacket'

/** The rule's two choices on the Notifications page; they live beside the emails so the welcome email names them the same way. */
export { FIRM_EMAIL_MODE_WORDS, legalFirmStageWords }

/** A row on *Fees and costs*: `Attorney fee` / `Cost`. */
export function firmFeeKindWords(kind: string): string {
  return kind === 'fee' ? 'Attorney fee' : kind === 'cost' ? 'Cost' : kind.replace(/_/g, ' ')
}

/** The kind cell on *On this matter*, from the firm's side: whose act it is, in a lawyer's words. */
export function firmEntryKindWords(e: Pick<LegalEntryRow, 'kind' | 'via_portal' | 'meta'>): string {
  if (isOfficeAsk(e)) {
    const m = askMetaOf(e.meta)
    return m.flavor === 'signoff' ? `sign-off asked by the office${m.jobLabel ? `, job ${m.jobLabel}` : ''}` : 'question from the office'
  }
  if (isFirmAnswer(e)) {
    const m = answerMetaOf(e.meta)
    return m.signedOff === true ? 'your answer: signed off' : m.signedOff === false ? 'your answer: not yet' : 'your answer'
  }
  switch (e.kind) {
    case 'step': return e.via_portal ? 'your step' : 'step by the office'
    case 'payment_received': return e.via_portal ? 'payment you received' : 'payment received'
    case 'recovery_applied': return 'applied by the office'
    case 'question': return 'your question'
    case 'answer': return "the office's answer"
    case 'note': return 'note from the office'
    case 'fee':
    case 'cost': return firmFeeKindWords(e.kind)
    default: return e.kind.replace(/_/g, ' ')
  }
}

/** The status cell on *On this matter*: has the office seen the firm's act, or is the office waiting on the firm. */
export function firmEntryStatusWords(e: Pick<LegalEntryRow, 'kind' | 'via_portal' | 'acknowledged_at'>): string {
  if (e.via_portal) return e.acknowledged_at ? 'seen by the office' : 'not yet seen by the office'
  if (e.kind === 'question') return e.acknowledged_at ? 'withdrawn by the office' : 'waiting on you'
  return 'from the office'
}

/** The step cell on *Account history*: what the office did before and since referral. */
export function firmHistoryKindWords(kind: LegalStep['kind'] | string): string {
  switch (kind) {
    case 'billed': return 'bill sent'
    case 'payment': return 'payment'
    case 'promise': return 'promise to pay'
    case 'call': return 'collection call'
    case 'demand': return 'demand letter'
    case 'filing': return 'lien paper'
    case 'collections': return 'sent to collections'
    case 'contact': return 'contact'
    case 'contract': return 'agreement'
    default: return String(kind).replace(/_/g, ' ')
  }
}

/** The kind cell on *Record of contact*: the office's collections note reads as a note, the rest as the kind. */
export function firmSaidKindWords(kind: LegalSaidEntry['kind']): string {
  switch (kind) {
    case 'note': return 'collections note'
    case 'promise': return 'promise to pay'
    case 'call': return 'collection call'
    default: return 'contact'
  }
}

/** The *Recorded by* cell: the person who wrote it down; *the customer* only for a promise the customer made on their own page; else a dash. */
export function firmSaidRecordedBy(e: Pick<LegalSaidEntry, 'by' | 'kind' | 'fromCustomer'>): string {
  if (e.by) return e.by
  return e.kind === 'promise' && e.fromCustomer ? 'the customer' : '—'
}

/** An exhibit's title as the firm reads it: the packet's *What was said* is the firm's *Record of contact*. */
export function firmExhibitTitle(title: string): string {
  return title.toLowerCase().startsWith('what was said') ? 'Record of contact: calls, emails, visits, promises' : title
}

/** A person on the firm's email list: `not confirmed yet` until they click the confirmation. */
export function firmRecipientStatusWords(r: { paused: boolean; confirmed: boolean }): string {
  return r.paused ? 'stopped' : r.confirmed ? 'confirmed' : 'not confirmed yet'
}


/**
 * The line the portal shows after an act saves: what happens next, for that act. The sample
 * portal saves nothing and says so before this is reached.
 */
export function firmSavedWords(payload: Readonly<Record<string, unknown>>): string {
  switch (payload.kind) {
    case 'fee':
    case 'cost': return 'Saved. The office sees it now, and it counts toward the total demand.'
    case 'step': return `Saved. The matter now reads ${legalFirmStageWords(typeof payload.stage === 'string' ? payload.stage : null)}.`
    case 'payment_received': return 'Saved. The office applies it to the job and records it here.'
    case 'question': return 'Sent. The office answers here.'
    case 'answer': return 'Sent. The office sees your answer now.'
    case 'recipient_add': return 'Sent. They get one confirmation email.'
    case 'recipient_resend': return 'Sent the confirmation again.'
    case 'recipient_stop': return 'Stopped. No more emails to this person.'
    case 'recipient_resume': return 'Emails to this person are back on.'
    default: return 'Saved.'
  }
}
