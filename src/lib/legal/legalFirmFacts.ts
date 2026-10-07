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

/** The firm form's own check, shared by Settings and the replace panel (v2.4712). Null when it may be saved. */
export function legalFirmInputProblem(input: { name: string; contingency_pct: string; filing_cost: string }): string | null {
  const pct = Number(input.contingency_pct)
  const cost = Number(input.filing_cost)
  if (!input.name.trim()) return 'Give the firm a name.'
  if (!input.contingency_pct.trim() || !Number.isFinite(pct) || pct < 0 || pct > 100 || !input.filing_cost.trim() || !Number.isFinite(cost) || cost < 0) return 'Contingency is a percent (0–100); the filing cost is dollars.'
  return null
}

/**
 * What *Replace the firm* does, said before it is pressed (v2.4712, `legal_replace_firm`):
 * the old firm is retired with its history kept; the new one starts with nothing.
 */
export function legalFirmReplaceWords(oldName: string, facts: Pick<LegalFirmFacts, 'people' | 'linkLive'>): string[] {
  const people = facts.people
  return [
    `${oldName} is retired. Its history stays on its record.`,
    facts.linkLive === false ? 'It has no live portal link.' : 'Its portal link stops working.',
    people === 0 ? 'Nobody is on its email list.' : `${people === 1 ? 'The 1 person' : `Its ${people} people`} on its email list stop${people === 1 ? 's' : ''} getting emails.`,
    'The new firm starts with no link and no people. You create its link and send it from the desk.',
  ]
}

/** A failed replace in the office's words: the database update not pushed yet reads as that, not as Postgres. */
export function legalReplaceErrorWords(message: string | null | undefined): string {
  const m = message ?? ''
  if (/legal_replace_firm/.test(m) && /(could not find|does not exist|schema cache)/i.test(m)) return 'Replacing needs a database update that is not live yet. Ask a dev to push it, then try again.'
  if (/legal_firms_one_active/.test(m)) return 'Another firm became active while you were here. Reload the desk and try again.'
  return m || 'Could not replace the firm. Try again.'
}
