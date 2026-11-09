/**
 * The claim on a legal matter, line by line (punch list #171, v2.6679). The desk sized a case by its open
 * bills, and since v2.5849 by the open bills plus the retainage no sent bill carries (v2.6103). A dispute
 * can claim more — materials left on site, damages, interest, attorney fees — and on job 891 those lines
 * lived only inside the demand letters. This kernel turns the stored lines (`legal_matter_claim_lines`)
 * and the packet's own figures into ONE table: two rows that fill in on their own (the open bills from
 * AR, the retainage held from the job), then the typed rows, then the total the claim comes to. Pure.
 */
import { formatLegalMoney } from './legalPacket'

export const LEGAL_CLAIM_LINE_KINDS = ['materials', 'damages', 'interest', 'fees', 'other'] as const
export type LegalClaimLineKind = (typeof LEGAL_CLAIM_LINE_KINDS)[number]

export const LEGAL_CLAIM_TITLE_MAX = 120
export const LEGAL_CLAIM_BASIS_MAX = 300

export function isClaimLineKind(raw: unknown): raw is LegalClaimLineKind {
  return typeof raw === 'string' && (LEGAL_CLAIM_LINE_KINDS as readonly string[]).includes(raw)
}

/** The kind as the table and the Add form word it. */
export function claimLineKindWords(kind: LegalClaimLineKind): string {
  switch (kind) {
    case 'materials': return 'Materials left on site'
    case 'damages': return 'Damages'
    case 'interest': return 'Interest'
    case 'fees': return 'Attorney fees'
    default: return 'Other'
  }
}

/** A stored row as the table reads it (`legal_matter_claim_lines`, live rows only); `document` is PostgREST's embed. */
export type LegalClaimLineRow = {
  id: string
  kind: string
  title: string
  amount: number | string
  basis: string
  document_id: string | null
  added_at: string
  /** v2.6697: claimed in an offer, not in the demand. Absent on a row read before the column was pushed: false. */
  settlement_only?: boolean | null
  document?: { title: string | null } | Array<{ title: string | null }> | null
}

/** One typed line as the packet carries it: the row's words with its document's title resolved. */
export type LegalClaimLineLike = {
  id: string
  kind: LegalClaimLineKind
  title: string
  amount: number
  basis: string
  documentId: string | null
  documentTitle: string
  /**
   * Settlement only (v2.6697, punch list #171, the owner's call of 2026-11-08): the line is claimed in a settlement
   * offer but not in the demand. Out of the demand's figures and the printed packet; inside the settlement figures.
   */
  settlementOnly: boolean
}

/** The chip's words on a line that is settlement only, on the desk and on the firm's portal. */
export const CLAIM_SETTLEMENT_ONLY_CHIP = 'settlement only'

const round2 = (n: number): number => Math.round(n * 100) / 100

/** The stored rows as typed lines, in the order they were added; a row of an unknown kind reads as *other*. */
export function claimLinesFromRows(rows: ReadonlyArray<LegalClaimLineRow>): LegalClaimLineLike[] {
  return rows
    .slice()
    .sort((a, b) => a.added_at.localeCompare(b.added_at) || a.id.localeCompare(b.id))
    .map((r) => {
      const doc = Array.isArray(r.document) ? (r.document[0] ?? null) : r.document ?? null
      return {
        id: r.id,
        kind: isClaimLineKind(r.kind) ? r.kind : 'other',
        title: r.title,
        amount: round2(Number(r.amount) || 0),
        basis: r.basis ?? '',
        documentId: r.document_id,
        documentTitle: (doc?.title ?? '').trim(),
        settlementOnly: r.settlement_only === true,
      }
    })
}

type ClaimLineAmount = Pick<LegalClaimLineLike, 'amount'> & { settlementOnly?: boolean }

/** What the typed lines add to the claim as demanded: every line but the settlement-only ones (v2.6697). */
export function claimTyped(lines: ReadonlyArray<ClaimLineAmount>): number {
  return round2(lines.reduce((s, l) => s + (l.amount > 0 && !l.settlementOnly ? l.amount : 0), 0))
}

/** What the settlement-only lines come to (v2.6697): in an offer, never in the demand. */
export function claimSettlementOnly(lines: ReadonlyArray<ClaimLineAmount>): number {
  return round2(lines.reduce((s, l) => s + (l.amount > 0 && l.settlementOnly ? l.amount : 0), 0))
}

/** The Add form's fields as typed; `amount` is the box's text so the kernel can say what is wrong with it. */
export type LegalClaimLineDraft = { kind: LegalClaimLineKind; title: string; amount: string; basis: string; documentId: string | null; /** v2.6697: in an offer, not in the demand. */ settlementOnly: boolean }

/** The amount box's text as a number of dollars, or null when it is not one. `$1,234.50` and `1234.5` both read. */
export function claimAmountOf(text: string): number | null {
  const cleaned = text.replace(/[$,\s]/g, '')
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return null
  const n = Number(cleaned)
  return Number.isFinite(n) ? round2(n) : null
}

/** Why a line cannot be saved as typed; null when it can. The RPC holds the same rules. */
export function claimLineDraftProblem(draft: LegalClaimLineDraft): string | null {
  if (!isClaimLineKind(draft.kind)) return 'Pick what part of the claim this is.'
  const title = draft.title.trim()
  if (!title) return 'Name the line.'
  if (title.length > LEGAL_CLAIM_TITLE_MAX) return `Keep the name under ${LEGAL_CLAIM_TITLE_MAX} characters.`
  const amount = claimAmountOf(draft.amount)
  if (amount == null) return 'Type the amount in dollars.'
  if (amount <= 0) return 'The amount must be more than zero.'
  if (draft.basis.trim().length > LEGAL_CLAIM_BASIS_MAX) return `Keep the basis under ${LEGAL_CLAIM_BASIS_MAX} characters.`
  return null
}

/** An empty form for a new line of the given kind. */
export function emptyClaimLineDraft(kind: LegalClaimLineKind = 'materials'): LegalClaimLineDraft {
  return { kind, title: kind === 'other' ? '' : claimLineKindWords(kind), amount: '', basis: '', documentId: null, settlementOnly: false }
}

/** A typed line back into the form, to edit it. */
export function claimLineDraftOf(line: LegalClaimLineLike): LegalClaimLineDraft {
  return { kind: line.kind, title: line.title, amount: line.amount.toFixed(2), basis: line.basis, documentId: line.documentId, settlementOnly: line.settlementOnly }
}

// ---------------------------------------------------------------------------
// The table
// ---------------------------------------------------------------------------

/** What the packet's worth hands the table: the two figures that fill in on their own and the typed lines. */
export type ClaimTableWorth = {
  balance: number
  /** The retainage held, by job id (`jobs_ledger.lien_retainage_held`); names the jobs on the retainage row. */
  retainageHeldByJob: Readonly<Record<string, number>>
  /** The part of it no sent bill asks for yet: what the row adds (v2.6103). */
  retainageAdded: number
  /** The part a sent bill already carries: inside the open bills, said on the row. */
  retainageOnBills: number
  openBills: ReadonlyArray<{ jobLabel: string }>
  claimLines: ReadonlyArray<LegalClaimLineLike>
}

export type ClaimTableEvidence =
  | { kind: 'ledger' }
  | { kind: 'job'; jobIds: string[] }
  | { kind: 'document'; documentId: string; title: string }
  | { kind: 'none' }

export type ClaimTableRow = {
  key: string
  /** `bills` and `retainage` fill in on their own; `typed` is a stored line the office may edit. */
  source: 'bills' | 'retainage' | 'typed'
  part: string
  basis: string
  evidence: ClaimTableEvidence
  amount: number
  /** The stored line behind a typed row. */
  line: LegalClaimLineLike | null
  /** v2.6697: the row wears the *settlement only* chip and stays out of `total`. */
  settlementOnly: boolean
}

export type ClaimTable = {
  rows: ClaimTableRow[]
  /** The claim as demanded: the open bills + the retainage added + the typed lines that are not settlement only. */
  total: number
  /** The typed lines in the demand. */
  typed: number
  /** The settlement-only lines (v2.6697): in an offer, not in `total`. 0 when none, or when the table was drawn for the demand alone. */
  settlementOnly: number
  /** How many settlement-only lines the table carries. */
  settlementOnlyCount: number
  /** The sentence under the table when there is something to say about where the retainage sits. */
  note: string
}

export type ClaimTableOptions = {
  /** Draw the claim as demanded: the settlement-only lines left out (the printed packet, v2.6697). */
  forDemand?: boolean
}

/**
 * The claim as one table. The bills row is always there (a claim with nothing open still reads $0.00 so
 * the firm sees the row was looked at); the retainage row only when a job holds some; the typed rows as
 * stored; then the total. `jobLabelOf` names the jobs on the retainage row. A settlement-only line (v2.6697)
 * draws with its chip and stays out of the total, or is left out when the table is drawn `forDemand`.
 */
export function claimTable(worth: ClaimTableWorth, jobLabelOf: (jobId: string) => string, options: ClaimTableOptions = {}): ClaimTable {
  const rows: ClaimTableRow[] = []
  const billCount = worth.openBills.length
  const balance = round2(worth.balance)
  rows.push({
    key: 'bills',
    source: 'bills',
    part: 'Open bills',
    basis: billCount === 0 ? 'nothing open on the ledger' : `${billCount === 1 ? 'one billed line' : `${billCount} billed lines`}, from AR`,
    evidence: { kind: 'ledger' },
    amount: balance,
    line: null,
    settlementOnly: false,
  })
  const heldJobs = Object.entries(worth.retainageHeldByJob).filter(([, held]) => held > 0.004).map(([jobId]) => jobId)
  const added = round2(Math.max(0, worth.retainageAdded))
  const onBills = round2(Math.max(0, worth.retainageOnBills))
  let note = ''
  if (heldJobs.length > 0) {
    rows.push({
      key: 'retainage',
      source: 'retainage',
      part: 'Retainage held',
      basis: `${heldJobs.map(jobLabelOf).join(', ')} · Our contract on this job`,
      evidence: { kind: 'job', jobIds: heldJobs },
      amount: added,
      line: null,
      settlementOnly: false,
    })
    if (added <= 0.004 && onBills > 0.004) note = `The retainage held ${formatLegalMoney(onBills)} is already inside the open bills, so the row adds nothing.`
    else if (onBills > 0.004) note = `Another ${formatLegalMoney(onBills)} of the retainage held is already on a bill, inside the open bills.`
  }
  const lines = options.forDemand ? worth.claimLines.filter((l) => !l.settlementOnly) : worth.claimLines
  for (const line of lines) {
    rows.push({
      key: `line:${line.id}`,
      source: 'typed',
      part: line.title,
      basis: line.basis,
      evidence: line.documentId ? { kind: 'document', documentId: line.documentId, title: line.documentTitle || 'Evidence document' } : { kind: 'none' },
      amount: line.amount,
      line,
      settlementOnly: line.settlementOnly,
    })
  }
  const typed = claimTyped(lines)
  const settlementOnly = claimSettlementOnly(lines)
  return { rows, total: round2(balance + added + typed), typed, settlementOnly, settlementOnlyCount: lines.filter((l) => l.settlementOnly).length, note }
}

/** The line under the table when a settlement-only line is on it (v2.6697); '' when none. Plain words. */
export function claimSettlementOnlyWords(table: Pick<ClaimTable, 'settlementOnly' | 'settlementOnlyCount'>): string {
  if (table.settlementOnlyCount === 0) return ''
  const lines = table.settlementOnlyCount === 1 ? 'One line' : `${table.settlementOnlyCount} lines`
  return `${lines}, ${formatLegalMoney(table.settlementOnly)}, ${table.settlementOnlyCount === 1 ? 'is' : 'are'} settlement only. That money is in an offer, not in the demand or the total.`
}

/** The evidence cell's words. */
export function claimEvidenceWords(e: ClaimTableEvidence): string {
  switch (e.kind) {
    case 'ledger': return 'the ledger below'
    case 'job': return 'the job record'
    case 'document': return e.title
    default: return '—'
  }
}

/** The line under the table when nothing is typed yet: what the office adds and why. */
export const CLAIM_TYPED_EMPTY_WORDS = 'Nothing typed yet. Add a line for materials left on site, damages, interest or attorney fees. Each line carries its basis and the document that shows it.'

/** The sentence a print carries in place of the settlement-only lines it leaves out (v2.6697); '' when none. */
export function claimSettlementOnlyPrintWords(table: Pick<ClaimTable, 'settlementOnly' | 'settlementOnlyCount'>): string {
  if (table.settlementOnlyCount === 0) return ''
  const lines = table.settlementOnlyCount === 1 ? 'One line' : `${table.settlementOnlyCount} lines`
  return `${lines}, ${formatLegalMoney(table.settlementOnly)}, ${table.settlementOnlyCount === 1 ? 'is' : 'are'} marked settlement only and left off this table. That money is claimed in an offer, not in the demand.`
}

/** The total's label: the claim, or what the bills alone come to when nothing reaches past them. A settlement-only row does not reach (v2.6697). */
export function claimTotalWords(table: Pick<ClaimTable, 'rows' | 'total'>): string {
  const reaches = table.rows.some((r) => r.source !== 'bills' && r.amount > 0.004 && !r.settlementOnly)
  return reaches ? 'The claim' : 'The claim, the open bills alone'
}
