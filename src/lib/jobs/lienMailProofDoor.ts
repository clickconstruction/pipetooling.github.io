/**
 * The press on a recipient's card in *What went out* (the owner's ask of 2026-11-18, on the stop window): "an action
 * button here where someone can be brought to where they can enter" what the card says is missing. The card was
 * read-only, so a reader who saw *No receipt yet* had to find the right screen alone.
 *
 * One card lacks at most one thing at a time, in this order: the owner of record on the property record (the name,
 * then the mailing address), the print of the copies, the mail number, the receipt. A copy not mailed yet reads by
 * its stage (`lienServeStage.ts`): **Print the copies to mail ›** until they are printed, then **Enter the mail
 * number ›**. It read *Mail this copy ›* for a day, which did not say whether it opened the print or the record. Each lack has the place it is entered, and the press is named for its act in
 * the words of the control it lands on. A card that lacks nothing has no press. A viewer who cannot do the act at any
 * of its places has no press either, never a dead one.
 *
 * Pure. The hosts hand in what is on file and where this viewer can act, and open the place (`landOn.ts` scrolls to
 * the spot and lights it).
 */
import type { LienMailProofCopy, LienMailProofEnvelope, LienMailProofPaper } from './lienMailProof'
import { LIEN_SERVE_STAGE_WORDS, type LienServeLanding } from './lienServeStage'

/** What one copy still lacks. */
export type LienMailProofLack = 'owner' | 'owner_address' | 'print' | 'number' | 'receipt'

/**
 * Where a lack is entered: the property record at the owner line, the desk's *Filed liens: copies to mail* window at
 * the job's row, or the job's Lien window (its service step, or the paper's row under *Filings on this job*).
 */
export type LienMailProofPlace = 'property' | 'serve' | 'lien_window'

export type LienMailProofDoor = {
  recipient: LienMailProofCopy
  lack: LienMailProofLack
  place: LienMailProofPlace
  /** The press's words: its act and its target, as the control it lands on says them. */
  label: string
}

export type LienMailProofDoorFacts = {
  /** What the property record still lacks for the owner's envelope: the name, or the mailing address alone. Read for the owner's copy, and only before it is mailed. */
  ownerGap: 'owner' | 'owner_address' | null
  /** An affidavit's day served is on record. A notice is recorded as it is mailed, so this is not read for one. */
  served: boolean
  /** The lien's copies were printed (`lienServeStage.ts`): a copy not mailed yet then waits on its number, not on its print. */
  printed?: boolean
  /** The places this viewer can do the act in, from this screen. A place left out is closed. */
  can: Partial<Record<LienMailProofPlace, boolean>>
}

/** The presses' words. Each names the act and its target. */
export const LIEN_MAIL_PROOF_DOOR_WORDS: Record<LienMailProofLack, string> = {
  owner: 'Enter the owner of record ›',
  owner_address: 'Enter the owner’s mailing address ›',
  print: `${LIEN_SERVE_STAGE_WORDS.print} ›`,
  number: 'Enter the mail number ›',
  receipt: 'Add the receipt ›',
}

/** The one thing a copy lacks, or null when its proof is whole. An emailed or hand-carried copy owes no number and no receipt. */
export function lienMailProofLack(e: Pick<LienMailProofEnvelope, 'recipient' | 'mailed' | 'wantsNumber' | 'wantsReceipt' | 'receiptUrl'>, facts: Pick<LienMailProofDoorFacts, 'ownerGap' | 'printed'>): LienMailProofLack | null {
  if (!e.mailed) return e.recipient === 'owner' && facts.ownerGap ? facts.ownerGap : facts.printed ? 'number' : 'print'
  if (e.wantsNumber) return 'number'
  if (e.wantsReceipt && !e.receiptUrl) return 'receipt'
  return null
}

/**
 * The places a lack is entered, the first choice first. A filed lien that is not served is worked in *Filed liens:
 * copies to mail*, which prints the copy and takes its number and receipt. Once its day is on record it has left that
 * window, and its Lien window holds the rest.
 */
export function lienMailProofPlaces(paper: LienMailProofPaper, lack: LienMailProofLack, served: boolean): LienMailProofPlace[] {
  if (lack === 'owner' || lack === 'owner_address') return ['property']
  if (paper === 'affidavit' && !served) return ['serve', 'lien_window']
  return ['lien_window']
}

/** The press one recipient's card gets: its label and the place it opens. Null when nothing is lacking, or no place is open to this viewer. */
export function lienMailProofDoor(paper: LienMailProofPaper, e: LienMailProofEnvelope, facts: LienMailProofDoorFacts): LienMailProofDoor | null {
  const lack = lienMailProofLack(e, facts)
  if (!lack) return null
  const place = lienMailProofPlaces(paper, lack, facts.served).find((p) => facts.can[p])
  return place ? { recipient: e.recipient, lack, place, label: LIEN_MAIL_PROOF_DOOR_WORDS[lack] } : null
}

/** What a place is asked to land on: the job, the paper's filing, the copy, and what the copy lacks. */
export type LienMailProofLanding = { jobId: string; filingId: string; paper: LienMailProofPaper; recipient: LienMailProofCopy; lack: LienMailProofLack }

/** The owner's gap from what the property record holds: the name first, then the address the envelope is mailed to. */
export function lienMailProofOwnerGap(owner: { name: string | null | undefined; mailingAddress: string | null | undefined }): 'owner' | 'owner_address' | null {
  if (!(owner.name ?? '').trim()) return 'owner'
  return (owner.mailingAddress ?? '').trim() ? null : 'owner_address'
}

/** How a screen opens each place. A place with no opener is closed to this viewer on this screen, and its lack gets no press. */
export type LienMailProofOpeners = Partial<Record<LienMailProofPlace, (landing: LienMailProofLanding) => void>>

/**
 * A card's press, ready for the block: the door's words, and a press that runs `before` (the stop window closes) and
 * then opens the place with what to land on. One wiring for the three screens that show a stop's window.
 */
export function lienMailProofDoorPress(
  paper: { jobId: string; filingId: string; paper: LienMailProofPaper; served: boolean; ownerGap: 'owner' | 'owner_address' | null; printed?: boolean },
  openers: LienMailProofOpeners,
  before?: () => void,
): (e: LienMailProofEnvelope) => { label: string; onPress: () => void } | null {
  return (e) => {
    const door = lienMailProofDoor(paper.paper, e, { ownerGap: paper.ownerGap, served: paper.served, printed: paper.printed, can: { property: Boolean(openers.property), serve: Boolean(openers.serve), lien_window: Boolean(openers.lien_window) } })
    const open = door ? openers[door.place] : undefined
    if (!door || !open) return null
    return {
      label: door.label,
      onPress: () => {
        before?.()
        open({ jobId: paper.jobId, filingId: paper.filingId, paper: paper.paper, recipient: door.recipient, lack: door.lack })
      },
    }
  }
}

/** The Lien window's tab a landing opens on: the affidavit's own, and the notice's for a notice or a retainage notice (every tab lists the filings). */
export function lienMailProofWindowTab(paper: LienMailProofPaper): 'affidavit' | 'notice' {
  return paper === 'affidavit' ? 'affidavit' : 'notice'
}

/**
 * Where the Lien window lands. An affidavit's print is its own press, **Print the copies to mail**. Its mail number
 * is entered on the service step (**Record service…**, or **Save the mail receipts** once the day is on record).
 * Everything else is on the paper's own row under *Filings on this job*: a notice's number on the row, a receipt on
 * the copy's line in *What went out*.
 */
export function lienMailProofWindowSpot(l: Pick<LienMailProofLanding, 'paper' | 'lack'>): 'print' | 'service' | 'row' | 'copy' {
  if (l.paper === 'affidavit' && l.lack === 'print') return 'print'
  if (l.paper === 'affidavit' && l.lack === 'number') return 'service'
  return l.lack === 'receipt' ? 'copy' : 'row'
}

/** The spots' selectors, so the markup and the landing cannot drift. */
export const lienMailProofSelectors = {
  /** The Lien window's **Print the copies to mail** press. */
  servePress: () => '[data-lien-serve-copies]',
  /** One copy's fields on the Lien window's service step. */
  serviceCopy: (recipient: LienMailProofCopy) => `[data-lien-service-copy="${recipient}"]`,
  /** A paper's row under *Filings on this job*. */
  filingRow: (filingId: string) => `[data-lien-filing-row="${filingId}"]`,
  /** One copy's line in the row's *What went out*. */
  filingCopy: (filingId: string, recipient: LienMailProofCopy) => `[data-lien-filing-row="${filingId}"] [data-lien-mail-proof-envelope="${recipient}"]`,
}

/** Where a card's landing stands in *Filed liens: copies to mail*: the print half for a print, the copy's own line for the rest. */
export function lienMailProofServeLanding(l: Pick<LienMailProofLanding, 'jobId' | 'recipient' | 'lack'>): LienServeLanding {
  return l.lack === 'print' ? { part: 'print' } : { part: 'numbers', jobId: l.jobId, recipient: l.recipient, cursor: l.lack === 'number' }
}

/** What the landing puts the cursor in: the number's box for a number, the receipt press for a receipt, nothing for a copy still to print. */
export function lienMailProofLandingFocus(lack: LienMailProofLack): string | null {
  return lack === 'number' ? 'input[type="text"]' : lack === 'receipt' ? 'button' : null
}
