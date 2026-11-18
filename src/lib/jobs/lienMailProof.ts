/**
 * What went out, on a recorded lien paper (the owner's yes of 2026-11-17 to the mail proof mock-ups). He asked: "once
 * a user has uploaded a copy of the mail they have sent, regarding a notice or a lien, is it easy to view?" It was
 * not. The scan of what was mailed showed as one link named *Saved copy · Drive* in the job's Lien window, a second
 * file had no link at all, and a receipt showed in that one list alone.
 *
 * This is the one reading of a filing's proof, so the desk's Sent row, the stop's window and the Lien window's
 * Filings list say the same thing: the files that went in the envelope, each with its own link, then each envelope
 * with its number and its receipt, a count of what is on file, and the one thing to add next.
 *
 * Every mailed file is read off the notice's desk item (`job_lien_desk_items.mailed_copies`, which the item keeps
 * after its mailing is recorded, reached by `sent_filing_id`). The filing's own saved copy is listed when it is not
 * one of them, so a link the office typed still shows.
 *
 * Pure. `lienMailProofIo.ts` reads and writes.
 */
import { documentLinkWords, normalizeDocumentUrl } from './lienFilingDocumentLink'
import { parseLienMailedCopies } from './lienMailedCopies'
import { LIEN_SEND_RECIPIENT_WORDS, parseLienSends, sendNeedsTracking, type LienSendLike } from './lienSendTracking'

export type LienMailProofCopy = 'owner' | 'original_contractor'
export type LienMailProofPaper = 'notice' | 'retainage' | 'affidavit'

/** One file that went out, or the clerk's stamped copy of an affidavit. */
export type LienMailProofFile = { key: string; name: string; url: string }

export type LienMailProofEnvelope = {
  recipient: LienMailProofCopy
  /** *Owner of record*, *Original contractor*. */
  who: string
  /** How it went and its number: *Certified mail 9507 …*, *Email*, *Not mailed yet*. */
  line: string
  tracking: string
  receiptUrl: string
  /** A copy that went by post has a receipt to keep. An emailed copy, one handed over and one a mail provider carried do not. */
  wantsReceipt: boolean
  /** The copy has gone out. False on a filed affidavit whose copies are not mailed yet. */
  mailed: boolean
  /** A mail number is owed and not on file: a mailed copy that went by tracked post with none typed, and none coming from a mail provider. */
  wantsNumber: boolean
}

export type LienMailProof = {
  paper: LienMailProofPaper
  /** The files' label: *In the envelope*, or *Stamped by the clerk* on an affidavit. */
  filesLabel: string
  files: LienMailProofFile[]
  envelopes: LienMailProofEnvelope[]
  /** How many pieces of proof are on file, of how many the paper owes: the files count as one, each posted copy's receipt as one. */
  have: number
  of: number
  complete: boolean
  /** *Mail proof: 2 of 3 on file*, or *Mail proof complete*. */
  chip: string
  /** The one thing to add next, as a sentence; null when the proof is complete. */
  next: string | null
}

export type LienMailProofInput = {
  kind: string
  sends: unknown
  documentUrl?: string | null
  documentNote?: string | null
  /** The desk item's `mailed_copies`, as stored; absent on a paper with no desk item. */
  mailedCopies?: unknown
  /** An affidavit's day served; null while its copies are not mailed. */
  servedAt?: string | null
  /** Whether an affidavit's copy goes to an original contractor too. */
  hasContractor?: boolean
}

const METHOD: Record<string, string> = { certified_mail: 'Certified mail', traceable_courier: 'Courier', mail: 'Mail', hand: 'By hand', email: 'Email' }
const POSTED = new Set(['certified_mail', 'traceable_courier', 'mail'])
const SHORT: Record<LienMailProofCopy, string> = { owner: 'owner', original_contractor: 'original contractor' }
const COPIES: readonly LienMailProofCopy[] = ['owner', 'original_contractor']

function paperOf(kind: string): LienMailProofPaper | null {
  if (kind === 'notice_53_056') return 'notice'
  if (kind === 'retainage_53_057') return 'retainage'
  if (kind === 'affidavit') return 'affidavit'
  return null
}

function who(recipient: LienMailProofCopy): string {
  return LIEN_SEND_RECIPIENT_WORDS[recipient] ?? recipient
}

function sentEnvelope(recipient: LienMailProofCopy, s: LienSendLike): LienMailProofEnvelope {
  const tracking = (s.tracking ?? '').trim()
  const carried = !!(s.via ?? '').trim() && !!(s.piece_id ?? '').trim()
  const method = METHOD[s.method] ?? s.method
  return { recipient, who: who(recipient), line: [method, tracking].filter(Boolean).join(' '), tracking, receiptUrl: (s.receipt_url ?? '').trim(), wantsReceipt: POSTED.has(s.method) && !carried, mailed: true, wantsNumber: sendNeedsTracking(s) }
}

/** The files that went out: every mailed copy the desk item keeps, then the filing's saved copy when it is not one of them. */
function filesOf(input: LienMailProofInput): LienMailProofFile[] {
  const out: LienMailProofFile[] = []
  const seen = new Set<string>()
  for (const c of parseLienMailedCopies(input.mailedCopies)) {
    if (seen.has(c.url)) continue
    seen.add(c.url)
    out.push({ key: c.driveFileId || c.url, name: c.name, url: c.url })
  }
  const saved = normalizeDocumentUrl(input.documentUrl)
  if (saved && !seen.has(saved)) {
    // A run's own note lists the mailed files by name; beside their links it would say them twice.
    const note = out.length > 0 || /^What was mailed:/i.test((input.documentNote ?? '').trim()) ? '' : (input.documentNote ?? '')
    out.push({ key: saved, name: documentLinkWords({ document_url: saved, document_note: note }), url: saved })
  }
  return out
}

/** The reading of one recorded paper's proof; null for a paper that is not mailed with proof (a release of record). */
export function lienMailProof(input: LienMailProofInput): LienMailProof | null {
  const paper = paperOf(input.kind)
  if (!paper) return null
  const sends = parseLienSends(input.sends)
  const row = (r: LienMailProofCopy) => sends.find((s) => s.recipient === r)
  let envelopes: LienMailProofEnvelope[]
  if (paper === 'affidavit') {
    const served = !!(input.servedAt ?? '').trim()
    envelopes = COPIES.filter((r) => r === 'owner' || input.hasContractor || !!row(r)).map((r) => {
      const s = row(r)
      const tracking = (s?.tracking ?? '').trim()
      const receiptUrl = (s?.receipt_url ?? '').trim()
      const mailed = served || !!tracking || !!receiptUrl
      const line = tracking ? `Certified mail ${tracking}` : mailed ? 'Mailed, no number yet' : 'Not mailed yet'
      return { recipient: r, who: who(r), line, tracking, receiptUrl, wantsReceipt: true, mailed, wantsNumber: mailed && !tracking }
    })
  } else {
    envelopes = COPIES.flatMap((r) => {
      const s = row(r)
      return s ? [sentEnvelope(r, s)] : []
    })
  }
  const files = filesOf(input)
  const owed = envelopes.filter((e) => e.wantsReceipt)
  const of = 1 + owed.length
  const have = (files.length > 0 ? 1 : 0) + owed.filter((e) => e.receiptUrl).length
  const complete = have >= of
  const missing = owed.find((e) => !e.receiptUrl)
  const next = complete
    ? null
    : files.length === 0
      ? paper === 'affidavit'
        ? 'Add the stamped scan.'
        : 'Add what was mailed.'
      : missing && !missing.mailed
        ? 'Mail the copies. Then add each receipt.'
        : missing
          ? `Add the ${SHORT[missing.recipient]}’s receipt.`
          : null
  return { paper, filesLabel: paper === 'affidavit' ? LIEN_MAIL_PROOF_WORDS.stamped : LIEN_MAIL_PROOF_WORDS.inEnvelope, files, envelopes, have, of, complete, chip: complete ? LIEN_MAIL_PROOF_WORDS.complete : `Mail proof: ${have} of ${of} on file`, next }
}

/** The block's words. Each sentence is one idea, as a first-timer reads it. */
export const LIEN_MAIL_PROOF_WORDS = {
  head: 'What went out',
  inEnvelope: 'In the envelope',
  stamped: 'Stamped by the clerk',
  complete: 'Mail proof complete',
  noReceipt: 'No receipt yet',
  receipt: 'Receipt',
  noFile: 'No copy of what was mailed yet',
  noScan: 'No stamped scan yet',
  addFile: 'Add what was mailed',
  another: 'Add another',
  adding: 'Adding…',
  next: 'Next:',
  receiptKept: 'Receipt kept on this paper.',
  /** The line under the press says where the file went (v2.7743). */
  receiptOff: 'Receipt taken off.',
  failed: 'The change was not saved.',
} as const
