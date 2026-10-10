/**
 * GC mode, the real build, the Board's B6-b-ii: a trade partner company's papers in the kernels' words, read from its
 * own rows in `person_contract_documents` (B6-b-i keys them to the company, `20261010009000_gc_papers`). One rule for
 * the board's mapper (`partnerFromRows`) and the trade's portal (`tradePortalState`'s `partnerOf`).
 *
 * The master agreement reads as the database does: `gc_trade_sign_sow`'s msaFirst gate (the Portal's P2c-i) and
 * `gc_company_paper_kept` take a signed `agreement` paper of the company's own as its master agreement, never the
 * Contract Book entry by name, so the window and the gate never disagree. A second agreement-type entry in the Subs
 * packet would read the same way; today the packet holds one (`mockups/board-b6b.md`, the known limit).
 */
import { isoToPlainDateInAppTz } from '../personContractAppliedDate'
import type { Partner } from './types'

/** A company's paper, as the readers select it. */
export interface CompanyPaperRow {
  id: string
  company_id: string | null
  /** agreement, w9, coi, license or other. */
  doc_type: string
  /** unsent, sent or signed. */
  status: string
  /** When the signing link went (timestamptz). */
  sent_at: string | null
  /** The day it was signed, or the day the office filed it (date). */
  signed_at: string | null
  /** A certificate's last day (date). */
  expires_at: string | null
  created_at?: string | null
}

/** The four papers' fields on a `Partner`. `msaSentOn` only once the master agreement went. */
export type CompanyPapers = Pick<Partner, 'msa' | 'msaSignedOn' | 'coiExpires' | 'w9'> & { msaSentOn?: string }

/** Newest first: the later day it was signed, then the later row. */
const newestFirst = (a: CompanyPaperRow, b: CompanyPaperRow): number =>
  (b.signed_at ?? '').localeCompare(a.signed_at ?? '') || (b.created_at ?? '').localeCompare(a.created_at ?? '')

/**
 * A company's master agreement, W-9 and insurance from its own papers:
 * - `msa` is `signed` with a signed agreement paper (`msaSignedOn` the newest one's day), else `sent` while one is
 *   out to sign, else `none`; `msaSentOn` is the day the newest agreement went;
 * - `w9` once a W-9 paper is signed;
 * - `coiExpires` is the newest filed certificate's last day.
 * Another company's paper, or a person's, never counts.
 */
export function companyPapers(rows: readonly CompanyPaperRow[], companyId: string): CompanyPapers {
  const own = rows.filter((r) => r.company_id === companyId)
  const agreements = own.filter((r) => r.doc_type === 'agreement')
  const signed = agreements.filter((r) => r.status === 'signed').sort(newestFirst)[0]
  const sentAt = agreements
    .map((r) => r.sent_at)
    .filter((s): s is string => Boolean(s))
    .sort()
    .pop()
  const sentOn = isoToPlainDateInAppTz(sentAt)
  const msa: Partner['msa'] = signed ? 'signed' : agreements.some((r) => r.status === 'sent') ? 'sent' : 'none'
  const coi = own.filter((r) => r.doc_type === 'coi' && r.status === 'signed' && r.expires_at).sort(newestFirst)[0]
  return {
    msa,
    msaSignedOn: signed ? (signed.signed_at ?? isoToPlainDateInAppTz(signed.created_at)) : null,
    ...(sentOn ? { msaSentOn: sentOn } : {}),
    w9: own.some((r) => r.doc_type === 'w9' && r.status === 'signed'),
    coiExpires: coi?.expires_at ?? null,
  }
}
