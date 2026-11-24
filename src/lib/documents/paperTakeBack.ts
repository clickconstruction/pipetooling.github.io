/**
 * Documents → Agreements, **Take back** (punch list #403, the owner's first decision of 2026-11-22, and his answer of
 * 2026-11-23: *delete the paper and end its link*). A paper that is with an outside party and is not signed can be
 * taken back where it sits. Until now no press removed one: People → Contracts leaves a party's paper out, and this
 * tab had no take-back for any paper, so a paper sent by mistake stayed under **Outside companies** until a dev
 * removed it.
 *
 * What Take back does: it deletes the paper's row. The signing link lives on the row, so the link ends with it.
 * Nobody is emailed, and someone who opens the old link reads that it no longer works. What it leaves: the copy of the
 * email that went out stays under Sent copies (`sent_documents` names its paper with no key, so nothing follows the
 * delete). What goes with the row: that it was sent and when, whether they opened it, and its reminders. Nothing
 * brings a taken-back paper back, which the confirm says.
 *
 * Who may: the leader and a dev, the two roles that delete a paper anywhere in the app (`canDeleteFromContractLibrary`,
 * the rule People → Contracts keeps). The rule is the app's own, and it is narrower than the database: the table's
 * delete policy answers the office's four roles, an assistant and the controller among them (since
 * `20260714200000_dissolve_assistant_pay_linkage.sql`). So the press is drawn for the two roles the app lets delete a
 * paper on every other page, and the rest of the office sends, sends again and copies a link as before. Opening it to
 * the four roles is this one function, and is the owner's call.
 *
 * What it refuses, and why:
 *   - **A signed paper.** It is the agreement itself. Its e-sign record, its signed copy and the log of who opened it
 *     all describe it, so it is kept. The delete asks the database for an unsigned paper only, so a paper signed a
 *     moment before the press is kept too, and the office is told.
 *   - **A paper that is not an outside party's or a trade company's own.** A teammate's or a sub's is removed on
 *     People → Contracts, and a job's contract is voided in its Contract window.
 *   - **A paper a job requires.** It belongs to the job's list of papers, which is where it comes off.
 *   - **A paper a newer one replaced.** It is history: the newer one is the live paper.
 *
 * **A trade company's own paper** (the walks of 2026-11-24: no press took one back) is taken back too, on this tab
 * and under the company's row on People → Contracts. It goes through `take_back_company_paper`, not the plain delete:
 * GC mode keeps a record of each paper it asks a company for, which only a dev reads, and a paper GC mode is waiting
 * on stays GC mode's. The function says so in words, and the office reads them. Which door a paper takes is
 * `takeBackHolder`.
 *
 * Pure: no React, no supabase. The delete is `paperTakeBackIo.ts`; the press is on the line in
 * `DocumentsAgreementsTab.tsx` and on a company's paper in `SubCompanyLines.tsx`.
 */
import { canDeleteFromContractLibrary } from '../contracts/contractLibraryRoles'
import { isPartyAgreementKind } from '../contracts/paperParty'
import type { AgreementRow } from './agreementsLedger'

export const TAKE_BACK_LABEL = 'Take back'

/**
 * Who has **Take back**: whoever may delete a paper, the leader and a dev. One rule with People → Contracts and the
 * Contract library, so a paper is never deletable on one page and not on the other.
 */
export function canTakeBackPapers(role: string | null | undefined): boolean {
  return canDeleteFromContractLibrary(role)
}

/** Whose a paper that can be taken back is: an outside party's, or a trade company's own. Each has its own door. */
export type TakeBackHolder = 'party' | 'company'

/** The view's kind for a trade company's own paper. */
export const COMPANY_AGREEMENT_KIND = 'company_agreement'

/** Whose a line's paper is, for Take back; null for a kind that is never taken back here. */
export function takeBackHolder(kind: string | null | undefined): TakeBackHolder | null {
  if (isPartyAgreementKind(kind)) return 'party'
  return kind === COMPANY_AGREEMENT_KIND ? 'company' : null
}

/** The statuses of a paper that can be taken back, as the delete asks the database for them: never `signed`. */
export const TAKE_BACK_STATUSES = ['unsent', 'sent'] as const

/** Why a line carries no Take back. */
export type TakeBackRefusal = 'not-a-party' | 'signed' | 'replaced' | 'job-paper' | 'not-out'

export type TakeBackVerdict = { ok: true; sent: boolean } | { ok: false; why: TakeBackRefusal }

function fact(row: Pick<AgreementRow, 'facts'>, key: string): unknown {
  return row.facts && typeof row.facts === 'object' ? row.facts[key] : undefined
}

function word(v: unknown): string {
  return typeof v === 'string' ? v.trim() : ''
}

/**
 * Whether a line's paper can be taken back, and when it cannot, which rule holds it. `sent` says whether a signing
 * link is out, which the confirm's words turn on.
 */
export function takeBackVerdict(row: Pick<AgreementRow, 'kind' | 'state' | 'job_id' | 'facts'>): TakeBackVerdict {
  if (!takeBackHolder(row.kind)) return { ok: false, why: 'not-a-party' }
  const status = word(fact(row, 'status'))
  // The row's status is asked before its state: a signed paper a newer one replaced reads *ended*, and is still signed.
  if (status === 'signed' || status === 'received' || row.state === 'signed') return { ok: false, why: 'signed' }
  if (fact(row, 'replaced') === true || row.state === 'ended') return { ok: false, why: 'replaced' }
  if (row.job_id) return { ok: false, why: 'job-paper' }
  if (status === 'sent') return { ok: true, sent: true }
  if (status === 'unsent') return { ok: true, sent: false }
  // A status the kernel does not know is left alone: nothing is deleted on a guess.
  return { ok: false, why: 'not-out' }
}

/** Whether a line carries **Take back**. */
export function agreementCanBeTakenBack(row: Pick<AgreementRow, 'kind' | 'state' | 'job_id' | 'facts'>): boolean {
  return takeBackVerdict(row).ok
}

/** The paper's name for a sentence; a paper with no name reads *this paper*. */
function paperWords(row: Pick<AgreementRow, 'paper_name'>): string {
  return word(row.paper_name) || 'this paper'
}

/** Who the paper is with, for a sentence; a line with no name reads *this party*. */
function partyWords(row: Pick<AgreementRow, 'with_name'>): string {
  return word(row.with_name) || 'this party'
}

/** A sentence that ends on a name: one full stop, also after a name that ends in one, as *Tallgrass Supply Co.* does. */
function endOn(words: string): string {
  return words.endsWith('.') ? words : `${words}.`
}

/** Who holds the signing link: the signer the paper kept, else the party. */
function linkHolderWords(row: Pick<AgreementRow, 'with_name' | 'facts'>): string {
  return word(fact(row, 'signer_name')) || partyWords(row)
}

/**
 * The confirm before the delete. It says what goes, that the link stops, that nobody is told, and that it cannot be
 * undone. The button names the act. A paper that was never sent has no link out, and its words say so.
 */
export function takeBackConfirm(row: Pick<AgreementRow, 'paper_name' | 'with_name' | 'facts'>, sent: boolean): { title: string; message: string; confirmLabel: string; danger: true } {
  const paper = paperWords(row)
  const party = partyWords(row)
  const message = sent
    ? `${endOn(`This deletes the copy of ${paper} that is with ${party}`)} The signing link sent to ${linkHolderWords(row)} stops working. Nobody is emailed. It cannot be undone.`
    : `${endOn(`This deletes the copy of ${paper} made for ${party}`)} It was never sent, so nobody holds a link. It cannot be undone.`
  return { title: `${TAKE_BACK_LABEL}: ${paper}`, message, confirmLabel: 'Take back the paper', danger: true }
}

/** What the delete came to. */
export type TakeBackOutcome =
  /** The paper is gone and its link with it. */
  | { kind: 'taken' }
  /** It was signed between the read and the press, so it is kept. */
  | { kind: 'signed-since' }
  /** It was gone already: someone else took it back, or this press landed twice. */
  | { kind: 'gone' }
  /** It is still there and not signed, and the database deleted nothing: the caller's account may not delete it. */
  | { kind: 'refused' }

/**
 * The outcome from what the database answered: how many rows the guarded delete removed, and, when it removed none,
 * the paper's status read right after (null when the paper is not there, or not the caller's to read).
 */
export function takeBackOutcome(deleted: number, statusAfter: string | null): TakeBackOutcome {
  if (deleted > 0) return { kind: 'taken' }
  if (statusAfter == null) return { kind: 'gone' }
  const status = statusAfter.trim()
  if (status === 'signed' || status === 'received') return { kind: 'signed-since' }
  return { kind: 'refused' }
}

/**
 * The outcome from what `take_back_company_paper` answered: *taken*, *signed* (signed before the press, kept) or
 * *gone*. Null for an answer this does not know, which the caller says as a failure and never as a paper taken back.
 */
export function companyTakeBackOutcome(answer: unknown): TakeBackOutcome | null {
  if (answer === 'taken') return { kind: 'taken' }
  if (answer === 'signed') return { kind: 'signed-since' }
  if (answer === 'gone') return { kind: 'gone' }
  return null
}

/** A company's paper as People → Contracts holds it, for the confirm and the toast: its name, the company, who signs. */
export function companyPaperTakeBackRow(paper: { document_name: string; signer_name: string | null }, companyName: string): Pick<AgreementRow, 'paper_name' | 'with_name' | 'facts'> {
  return { paper_name: paper.document_name, with_name: companyName, facts: { signer_name: paper.signer_name ?? '' } }
}

/** Whether a company's paper on People → Contracts carries Take back: one that is out or was never sent. */
export function companyPaperCanBeTakenBack(status: string): boolean {
  return (TAKE_BACK_STATUSES as ReadonlyArray<string>).includes(status)
}

/** What the office is told once the press is answered, and how the toast reads it. */
export function takeBackOutcomeWords(outcome: TakeBackOutcome, row: Pick<AgreementRow, 'paper_name' | 'with_name'>, sent: boolean): { words: string; tone: 'success' | 'info' | 'error' } {
  const paper = paperWords(row)
  switch (outcome.kind) {
    case 'taken':
      return sent
        ? { words: `${endOn(`${paper} was taken back from ${partyWords(row)}`)} Its signing link no longer works.`, tone: 'success' }
        : { words: `${paper} was taken back. It was never sent.`, tone: 'success' }
    case 'signed-since':
      return { words: `${paper} was signed before it could be taken back. A signed paper is kept.`, tone: 'error' }
    case 'gone':
      return { words: `${paper} was already taken back.`, tone: 'info' }
    default:
      return { words: `${paper} was not taken back. Your account cannot delete a paper.`, tone: 'error' }
  }
}
