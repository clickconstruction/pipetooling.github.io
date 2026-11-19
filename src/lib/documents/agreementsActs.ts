/**
 * Documents → Agreements, what a line can do where it sits (punch list #376, the second train). The list began as a
 * read with doors: every act lived in the window a line opened. A paper that waits on a signature is the one the
 * office chases, so its two acts sit on its line: **Send again** emails the person a new signing link, and **Copy the
 * signing link** hands the link to the office to text. Both go through `send-contract-for-signature`, the sender
 * People → Contracts uses. A job's contract that waits opens its real Contract window, where Resend email, Void & redo
 * and File the signed copy already are.
 *
 * Pure: no React, no supabase. The line's words and doors are `agreementsLedger.ts`; the calls are
 * `contracts/personPaperSendIo.ts`.
 */
import type { AgreementRow } from './agreementsLedger'
import { PERSON_PAPER_LINK_DAYS } from '../contracts/personPaperSend'

export const SEND_AGAIN_LABEL = 'Send again'
export const COPY_SIGNING_LINK_LABEL = 'Copy the signing link'

function factOf(row: Pick<AgreementRow, 'facts'>, key: string): unknown {
  return row.facts && typeof row.facts === 'object' ? row.facts[key] : undefined
}

/**
 * Whether a line carries Send again and Copy the signing link: a staff, sub or partner paper that is out and not
 * signed, and that no newer copy replaced. A trade company's paper goes out with its trade email in GC mode, so its
 * line keeps the GC door and carries neither.
 */
export function agreementCanBeSentAgain(row: Pick<AgreementRow, 'kind' | 'state' | 'facts'>): boolean {
  if (row.kind !== 'person_agreement' && row.kind !== 'partner_agreement') return false
  if (row.state !== 'waiting') return false
  return factOf(row, 'status') === 'sent' && factOf(row, 'replaced') !== true
}

/**
 * Whether a job's paper opens the Contract window: a signed one opens it on its record, and one that waits opens it on
 * the job, where it is the live contract. A voided one does not: the window opens on the job's live contract or a new
 * draft, never on a voided record, so that line keeps the preview of the page that went out. Their paper is not one of
 * the window's own rows, so an unsigned one keeps the preview too.
 */
export function agreementOpensContractWindow(row: Pick<AgreementRow, 'kind' | 'state' | 'facts'>): boolean {
  if (row.kind !== 'job_contract' && row.kind !== 'job_warranty' && row.kind !== 'their_paper') return false
  if (factOf(row, 'signed_at') != null) return true
  return row.state === 'waiting' && row.kind !== 'their_paper'
}

/** Who a line's paper is with, for a sentence; a line with no name reads *this person*. */
function who(withName: string | null | undefined): string {
  return (withName ?? '').trim() || 'this person'
}

/**
 * The confirm before a new link is made: any new link ends the one before it, so the office hears that before the
 * email already in the signer's inbox stops working. The button names the act.
 */
export function copySigningLinkConfirm(row: Pick<AgreementRow, 'with_name'>): { title: string; message: string; confirmLabel: string } {
  return {
    title: COPY_SIGNING_LINK_LABEL,
    message: `This makes a new signing link for ${who(row.with_name)}. The link sent before stops working. Nothing is emailed.`,
    confirmLabel: 'Make and copy the link',
  }
}

/** The toast once the link is on the clipboard: what to do with it and how long it works. */
export function signingLinkCopiedWords(row: Pick<AgreementRow, 'with_name'>): string {
  return `Signing link copied. Send it to ${who(row.with_name)}. It works for ${PERSON_PAPER_LINK_DAYS} days.`
}

/** The window that shows the link when the clipboard is closed to the app. */
export function signingLinkByHandPrompt(url: string): { title: string; message: string; defaultValue: string; confirmLabel: string } {
  return { title: COPY_SIGNING_LINK_LABEL, message: 'The app could not reach the clipboard. Select the link below and copy it.', defaultValue: url, confirmLabel: 'I copied it' }
}
