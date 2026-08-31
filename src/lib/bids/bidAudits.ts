/**
 * Audit-loop kernel (v2.2517, FEEDBACK_LOOP v2): pure shaping for the Bids page's
 * Audits tab. A twin opens a `bid_audits` row when its draft bid is ready; the
 * human auditor answers the twin's questions and leaves sectioned notes; the agent
 * digests each note and posts a `receipt` reply underneath. This module threads
 * the flat notes table into that shape and computes the card's draft total.
 *
 * Ships ahead of gen-types (useIsDigitalTwin pattern): row types live here, the
 * component queries through an untyped client, and a missing table renders as
 * "no audits", never a broken tab.
 */

export const AUDIT_SECTIONS = ['counts', 'footage', 'pricing', 'scope', 'general'] as const
export type AuditSection = (typeof AUDIT_SECTIONS)[number]

export const AUDIT_SECTION_LABELS: Record<AuditSection, string> = {
  counts: 'Counts',
  footage: 'Footage',
  pricing: 'Pricing',
  scope: 'Scope',
  general: 'General',
}

export type AuditNoteKind = 'note' | 'question' | 'answer' | 'receipt'
export type AuditStatus = 'pending' | 'done' | 'digested'
export type AuditDigestOutcome = 'doctrine' | 'books' | 'code' | 'bid_only'

export const AUDIT_DIGEST_OUTCOME_LABELS: Record<AuditDigestOutcome, string> = {
  doctrine: 'placement doctrine',
  books: 'robot books',
  code: 'code fix',
  bid_only: 'this bid only',
}

export type BidAuditRow = {
  id: string
  bid_id: string
  ct_project_id: string | null
  ct_view_url: string | null
  status: AuditStatus
  requested_at: string
  completed_at: string | null
  completed_by: string | null
  digested_at: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

export type BidAuditNoteRow = {
  id: string
  bid_id: string
  audit_id: string
  section: AuditSection
  kind: AuditNoteKind
  body: string
  parent_id: string | null
  author_id: string | null
  created_at: string
  digested_at: string | null
  digest_outcome: AuditDigestOutcome | null
  /** PostgREST embed (author:users(name)); absent in unit tests. */
  author?: { name: string | null } | null
}

export type ThreadedQuestion = {
  question: BidAuditNoteRow
  answer: BidAuditNoteRow | null
}

export type ThreadedNote = {
  note: BidAuditNoteRow
  receipt: BidAuditNoteRow | null
}

export type ThreadedAuditNotes = {
  questions: ThreadedQuestion[]
  /** Every section, in fixed order — empty sections still render their composer. */
  sections: Array<{ section: AuditSection; items: ThreadedNote[] }>
}

const byCreatedAt = (a: { created_at: string }, b: { created_at: string }) =>
  a.created_at < b.created_at ? -1 : a.created_at > b.created_at ? 1 : 0

/**
 * Thread a flat notes list: questions (with their answer child) up top, then
 * notes grouped by section with their receipt child attached. Orphaned answers
 * or receipts (parent deleted) are dropped rather than rendered dangling.
 */
export function threadAuditNotes(notes: BidAuditNoteRow[]): ThreadedAuditNotes {
  const sorted = [...notes].sort(byCreatedAt)
  const answersByParent = new Map<string, BidAuditNoteRow>()
  const receiptsByParent = new Map<string, BidAuditNoteRow>()
  for (const n of sorted) {
    if (!n.parent_id) continue
    // First reply wins; later duplicates are ignored (append-only table).
    if (n.kind === 'answer' && !answersByParent.has(n.parent_id)) answersByParent.set(n.parent_id, n)
    if (n.kind === 'receipt' && !receiptsByParent.has(n.parent_id)) receiptsByParent.set(n.parent_id, n)
  }
  const questions: ThreadedQuestion[] = sorted
    .filter((n) => n.kind === 'question')
    .map((q) => ({ question: q, answer: answersByParent.get(q.id) ?? null }))
  const sections = AUDIT_SECTIONS.map((section) => ({
    section,
    items: sorted
      .filter((n) => n.kind === 'note' && n.section === section)
      .map((note) => ({ note, receipt: receiptsByParent.get(note.id) ?? null })),
  }))
  return { questions, sections }
}

/** Open-question count for the card header (unanswered twin questions). */
export function openQuestionCount(threaded: ThreadedAuditNotes): number {
  return threaded.questions.filter((q) => q.answer == null).length
}

export type AuditCountRow = { id: string; count: number; bid_version_id: string | null }
export type AuditPricingAssignment = {
  count_row_id: string
  price_book_entry_id: string | null
  unit_price_override: number | null
}

/**
 * The card's draft total: assigned unit price (override wins) × row count, over the
 * bid's ACTIVE count rows — the selected version's rows when the bid is split into
 * versions, the version-less rows otherwise. Rows without an assignment contribute 0.
 */
export function computeAuditDraftTotal(
  rows: AuditCountRow[],
  selectedVersionId: string | null,
  assignments: AuditPricingAssignment[],
  entryPriceById: Record<string, number>,
): { total: number; rowCount: number } {
  const active = rows.filter((r) => (selectedVersionId ? r.bid_version_id === selectedVersionId : r.bid_version_id == null))
  const byRow = new Map(assignments.map((a) => [a.count_row_id, a]))
  let total = 0
  for (const r of active) {
    const a = byRow.get(r.id)
    if (!a) continue
    const unit = a.unit_price_override ?? (a.price_book_entry_id ? entryPriceById[a.price_book_entry_id] : undefined)
    if (unit == null) continue
    total += unit * r.count
  }
  return { total, rowCount: active.length }
}

/** Sort audits for the tab: pending first (oldest request first), then done, then digested (newest first). */
// Mirrors the bid_audits/bid_audit_notes write RLS (20260830230000_bid_audits.sql):
// primary and superintendent can read audits but every write is denied, and twin
// accounts are fenced to the API lanes (question/receipt) — so the tab renders
// view-only for them instead of surfacing raw 42501 errors on Add/Answer/Finish.
export const AUDIT_WRITE_ROLES = ['dev', 'master_technician', 'assistant', 'controller', 'estimator'] as const

export function canWriteBidAudit(role: string | null | undefined, isDigitalTwin = false): boolean {
  if (isDigitalTwin) return false
  return (AUDIT_WRITE_ROLES as readonly string[]).includes(role ?? '')
}

// "requested Aug 30, 2:14 PM · 19h ago" — the Audits tab stamp (v2.2533). Relative part
// rolls minutes → hours → days so a reviewer can triage queue age at a glance.
export function formatAuditRequestedStamp(iso: string, now: number = Date.now()): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return `requested ${iso.slice(0, 10)}`
  const date = d.toLocaleDateString([], { month: 'short', day: 'numeric' })
  const time = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
  const mins = Math.max(0, Math.floor((now - d.getTime()) / 60_000))
  const ago = mins < 60 ? `${mins}m ago` : mins < 48 * 60 ? `${Math.floor(mins / 60)}h ago` : `${Math.floor(mins / (24 * 60))}d ago`
  return `requested ${date}, ${time} · ${ago}`
}

export function sortAuditsForTab<T extends { status: AuditStatus; requested_at: string }>(audits: T[]): T[] {
  const rank: Record<AuditStatus, number> = { pending: 0, done: 1, digested: 2 }
  return [...audits].sort((a, b) => {
    if (rank[a.status] !== rank[b.status]) return rank[a.status] - rank[b.status]
    return a.status === 'digested'
      ? (a.requested_at < b.requested_at ? 1 : -1)
      : (a.requested_at < b.requested_at ? -1 : 1)
  })
}
