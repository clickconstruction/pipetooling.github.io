/**
 * What hangs on the collections law firm, said before anyone changes it (v2.4711, the firm's
 * window on the Legal desk). A rename keeps all of it with the firm; a replace retires it.
 * Pure — the window reads the desk's own matters and recipients, and the link row.
 */
import { matterIsWithFirm, type LegalMatterRow, type LegalRecipientRow } from './legalMatters'

export type LegalFirmFacts = {
  /** Accounts the firm is working, or has ended and the office has not closed. */
  withFirm: Array<{ id: string; payerName: string; payerKey: string }>
  /** People on the firm's email list (not removed); paused and unconfirmed people count. */
  people: number
  /** Whether the firm has a live portal link; null while it is not known. */
  linkLive: boolean | null
}

export function legalFirmFacts(
  firmId: string,
  matters: ReadonlyArray<Pick<LegalMatterRow, 'id' | 'firm_id' | 'stage' | 'closed_at' | 'payer_name' | 'payer_key'>>,
  recipients: ReadonlyArray<Pick<LegalRecipientRow, 'firm_id' | 'removed_at'>>,
  linkLive: boolean | null,
): LegalFirmFacts {
  const withFirm = matters
    .filter((m) => m.firm_id === firmId && matterIsWithFirm(m))
    .map((m) => ({ id: m.id, payerName: m.payer_name, payerKey: m.payer_key }))
  // Rows without a firm id predate the column and belong to the one firm.
  const people = recipients.filter((r) => !r.removed_at && (r.firm_id == null || r.firm_id === firmId)).length
  return { withFirm, people, linkLive }
}

/** The facts as the window's chips, in plain words. */
export function legalFirmFactsWords(f: LegalFirmFacts): string[] {
  const n = f.withFirm.length
  const words = [
    `${n} account${n === 1 ? '' : 's'} with the firm`,
    `${f.people} ${f.people === 1 ? 'person' : 'people'} on its email list`,
  ]
  if (f.linkLive != null) words.push(f.linkLive ? 'portal link on' : 'portal link off')
  return words
}

/** The company's particulars for filing, and how many of them are filled in. */
export const LEGAL_PARTICULAR_KEYS = ['entity', 'license', 'agent', 'custodian', 'affiant', 'phone', 'email', 'w9'] as const

export function particularsFilled(p: Partial<Record<(typeof LEGAL_PARTICULAR_KEYS)[number], string>>): { filled: number; total: number } {
  const filled = LEGAL_PARTICULAR_KEYS.filter((k) => (p[k] ?? '').trim().length > 0).length
  return { filled, total: LEGAL_PARTICULAR_KEYS.length }
}
