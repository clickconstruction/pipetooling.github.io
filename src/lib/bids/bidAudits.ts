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
  /**
   * The robot's own confession of where this draft is least sure (v2.2553,
   * nullable) — written by twin-mcp ct_finish_takeoff, shown atop the audit
   * card. Undefined until the migration lands (select('*') omits absent
   * columns) — consumers must treat missing as null.
   */
  self_assessment?: string | null
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
  /**
   * Question anchors (v2.2535, nullable): where the twin saw it ("P2.1") and
   * why it's asking. Undefined until the migration lands (select('*') simply
   * omits absent columns) — consumers must treat missing as null.
   */
  sheet_ref?: string | null
  context?: string | null
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
  // Section order (then created_at, via the stable sort of an already-sorted
  // list) so counts questions sit next to the Counts composer they'll feed.
  const sectionRank = (s: AuditSection) => AUDIT_SECTIONS.indexOf(s)
  const questions: ThreadedQuestion[] = sorted
    .filter((n) => n.kind === 'question')
    .sort((a, b) => sectionRank(a.section) - sectionRank(b.section))
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

/**
 * The muted line under a question: "On P2.1 — what the twin saw / what rides
 * on the answer." Null when the twin anchored nothing (pre-v2.2535 rows and
 * plain questions render exactly as before).
 */
export function questionContextLine(q: Pick<BidAuditNoteRow, 'sheet_ref' | 'context'>): string | null {
  const sheet = (q.sheet_ref ?? '').trim()
  const context = (q.context ?? '').trim()
  if (sheet && context) return `On ${sheet} — ${context}`
  if (sheet) return `On ${sheet}`
  if (context) return context
  return null
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

// ---------------------------------------------------------------------------
// v2.2796 — audits the tab cannot judge yet, and the shadow-seal pairing.
//
// Wendi's 2026-09-04 pass found seven pending cards reading "draft $0 · −100%
// vs ours": the robot's estimate lived in CountTooling and its lock note, never
// pasted into the Counts tab, so computeAuditDraftTotal had no rows. Those cards
// drew "we will not do this for free wtf". An audit with no active count rows
// is UNPRICED — the robot is still working it — and must not count as pending,
// auto-expand, or feed the delta strip. And b418 (a live, unsent shadow) was
// audited in the open because its `twin_source_bid_id` predates the v2.2543
// stamp; twin_shadow_runs carries the pairing for every shadow, so the seal
// derives from both.
// ---------------------------------------------------------------------------

/** No active count rows in PipeTooling: the robot hasn't finished STG-5, so there is nothing to judge. */
export function isUnpricedAudit(draft: { rowCount: number } | undefined | null): boolean {
  return !!draft && draft.rowCount === 0
}

export type TwinPairingSource = { id: string; bid_number: string | null; twin_source_bid_id: string | null }
/** One row of the staff RPC `list_shadow_runs()` — it names bids by NUMBER (the direct select is RLS-closed since v2.2544). */
export type ShadowRunPairing = { shadow_bid_number: string | null; reference_bid_number: string | null; reference_sent_at?: string | null }
export type TwinReferenceKey = {
  /** Set when `bids.twin_source_bid_id` is stamped. */
  refId: string | null
  /** The reference's bid number, from the shadow run (always) or unknown for a stamped-only pairing. */
  refNumber: string | null
  /** From the shadow run: null = the human bid hasn't gone out (sealed). Undefined when no run row exists. */
  refSentAt?: string | null
}

/**
 * twin bid id → how to find its reference. `bids.twin_source_bid_id` wins; a
 * shadow run's reference number fills in for shadows opened before the v2.2543
 * stamp (b418/b419), so the seal can still hold.
 */
export function pairTwinReferences(twins: TwinPairingSource[], shadowRuns: ShadowRunPairing[] = []): Map<string, TwinReferenceKey> {
  const runByShadowNumber = new Map<string, ShadowRunPairing>()
  for (const r of shadowRuns) if (r.shadow_bid_number && r.reference_bid_number) runByShadowNumber.set(r.shadow_bid_number, r)
  const out = new Map<string, TwinReferenceKey>()
  for (const t of twins) {
    const run = t.bid_number ? runByShadowNumber.get(t.bid_number) : undefined
    if (t.twin_source_bid_id) {
      out.set(t.id, { refId: t.twin_source_bid_id, refNumber: run?.reference_bid_number ?? null, refSentAt: run?.reference_sent_at })
    } else if (run?.reference_bid_number) {
      out.set(t.id, { refId: null, refNumber: run.reference_bid_number, refSentAt: run.reference_sent_at ?? null })
    }
  }
  return out
}

/**
 * The pending count every badge shows (Audits tab label, Needs-you card): pending
 * audits that are neither sealed (reference unsent) nor unpriced (no PT rows).
 */
export function countWorkablePendingAudits(
  audits: Array<{ status: AuditStatus; bid_id: string }>,
  sealedBidIds: ReadonlySet<string>,
  unpricedBidIds: ReadonlySet<string>,
): number {
  return audits.filter((a) => a.status === 'pending' && !sealedBidIds.has(a.bid_id) && !unpricedBidIds.has(a.bid_id)).length
}
