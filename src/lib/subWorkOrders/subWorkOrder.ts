/**
 * Sub work orders sent from a Sub Labor sheet (v2.2785, PR 1 of the Sub Work
 * Orders train). Pure logic shared by the sheet's Work order panel, the sub
 * portal builders, the Subs row, and the Person tab.
 *
 * A work order is a `step_commitments` row. Step-anchored rows (step_id set)
 * are the RUN_SUBS_PLAN work orders; sheet-anchored rows (step_id NULL,
 * labor_job_id set) are what this train adds. Both freeze what the sub signs
 * into `offer_scope_snapshot`; this module owns the extended snapshot shape
 * and reads it defensively (the portal trusts nothing).
 */

export type SubWorkOrderLine = { label: string; amount: number | null }

export type SubWorkOrderReferenceKind = 'book' | 'setting' | 'compliance'

/** A document the work order incorporates by reference, named with its version date. */
export type SubWorkOrderReference = {
  kind: SubWorkOrderReferenceKind
  /** contract_template_documents.id for `book`; null for settings / compliance lines. */
  documentId: string | null
  name: string
  /** YYYY-MM-DD book version date (or COI expiry for compliance); null when the source has none. */
  versionDate: string | null
}

export type SubWorkOrderBond = 'none' | 'furnished'

export type SubWorkOrderSnapshot = {
  anchor: 'sheet' | 'step'
  lines: SubWorkOrderLine[]
  startsLabel: string | null
  /** "J977 · 415 Springtown Way" — the portal card title for sheet work orders. */
  sheetLabel: string | null
  exclusions: string[]
  references: SubWorkOrderReference[]
  /** Sentences the sub must tick before signing (Structura's "click to initial"). */
  acknowledgements: string[]
  bond: SubWorkOrderBond
  specialProvisions: string | null
}

export type SubScopeItemKind = 'scope' | 'exclusion' | 'acknowledgement'

export type SubScopeItem = {
  id: string
  service_type_id: string | null
  kind: SubScopeItemKind
  label: string
  is_default: boolean
  sequence_order: number
  archived_at: string | null
}

const str = (v: unknown): string => (typeof v === 'string' ? v : '')
const strOrNull = (v: unknown): string | null => {
  const s = str(v).trim()
  return s || null
}

function parseLines(raw: unknown): SubWorkOrderLine[] {
  if (!Array.isArray(raw)) return []
  const out: SubWorkOrderLine[] = []
  for (const item of raw) {
    if (item == null || typeof item !== 'object') continue
    const label = str((item as { label?: unknown }).label).trim()
    if (!label) continue
    const amountRaw = (item as { amount?: unknown }).amount
    const amount = typeof amountRaw === 'number' && Number.isFinite(amountRaw) ? Math.round(amountRaw * 100) / 100 : null
    out.push({ label, amount })
  }
  return out
}

function parseStrings(raw: unknown): string[] {
  if (!Array.isArray(raw)) return []
  return raw.map((v) => str(v).trim()).filter(Boolean)
}

function parseReferences(raw: unknown): SubWorkOrderReference[] {
  if (!Array.isArray(raw)) return []
  const out: SubWorkOrderReference[] = []
  for (const item of raw) {
    if (item == null || typeof item !== 'object') continue
    const r = item as { kind?: unknown; documentId?: unknown; name?: unknown; versionDate?: unknown }
    const name = str(r.name).trim()
    if (!name) continue
    const kind: SubWorkOrderReferenceKind = r.kind === 'setting' || r.kind === 'compliance' ? r.kind : 'book'
    out.push({ kind, documentId: strOrNull(r.documentId), name, versionDate: strOrNull(r.versionDate) })
  }
  return out
}

/** Read any offer_scope_snapshot (legacy step shape or the extended sheet shape). Never throws. */
export function parseSubWorkOrderSnapshot(raw: unknown): SubWorkOrderSnapshot {
  const empty: SubWorkOrderSnapshot = {
    anchor: 'step',
    lines: [],
    startsLabel: null,
    sheetLabel: null,
    exclusions: [],
    references: [],
    acknowledgements: [],
    bond: 'none',
    specialProvisions: null,
  }
  if (raw == null || typeof raw !== 'object') return empty
  const o = raw as Record<string, unknown>
  return {
    anchor: o.anchor === 'sheet' ? 'sheet' : 'step',
    lines: parseLines(o.lines),
    startsLabel: strOrNull(o.startsLabel),
    sheetLabel: strOrNull(o.sheetLabel),
    exclusions: parseStrings(o.exclusions),
    references: parseReferences(o.references),
    acknowledgements: parseStrings(o.acknowledgements),
    bond: o.bond === 'furnished' ? 'furnished' : 'none',
    specialProvisions: strOrNull(o.specialProvisions),
  }
}

/** "J977 · 415 Springtown Way" / "415 Springtown Way" / "Sub sheet" — the sheet's name on every surface. */
export function sheetWorkOrderLabel(sheet: { job_number?: string | null; address?: string | null }): string {
  const parts = [sheet.job_number, sheet.address].map((v) => (v ?? '').trim()).filter(Boolean)
  return parts.join(' · ') || 'Sub sheet'
}

export type BuildSheetWorkOrderSnapshotInput = {
  sheet: { job_number?: string | null; address?: string | null }
  /** Ticked library scope lines + job-specific lines, in the order they should read. */
  scopeLines: string[]
  exclusions: string[]
  references: SubWorkOrderReference[]
  acknowledgements: string[]
  bond: SubWorkOrderBond
  specialProvisions: string | null
  /** YYYY-MM-DD; drives the portal's "Starts …" line. */
  proposedStart: string | null
  proposedEnd: string | null
}

function fmtYmd(ymd: string): string {
  const [y, m, d] = ymd.split('-').map(Number)
  if (!y || !m || !d) return ymd
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })
}

/** "Sep 15 → Sep 26" / "starting Sep 15" / "by Sep 26" / null. */
export function workOrderWindowLabel(start: string | null, end: string | null): string | null {
  if (start && end) return `${fmtYmd(start)} → ${fmtYmd(end)}`
  if (start) return `starting ${fmtYmd(start)}`
  if (end) return `by ${fmtYmd(end)}`
  return null
}

/**
 * Freeze what the sub signs. Blank lines are dropped; duplicates collapse;
 * the sheet label is stamped so the portal never has to look the sheet up.
 */
export function buildSheetWorkOrderSnapshot(input: BuildSheetWorkOrderSnapshotInput): SubWorkOrderSnapshot {
  const dedupe = (list: string[]): string[] => {
    const seen = new Set<string>()
    const out: string[] = []
    for (const raw of list) {
      const label = raw.trim()
      const key = label.toLowerCase()
      if (!label || seen.has(key)) continue
      seen.add(key)
      out.push(label)
    }
    return out
  }
  const window = workOrderWindowLabel(input.proposedStart, input.proposedEnd)
  return {
    anchor: 'sheet',
    lines: dedupe(input.scopeLines).map((label) => ({ label, amount: null })),
    startsLabel: window ? (input.proposedStart ? `Starts ${window}` : window) : null,
    sheetLabel: sheetWorkOrderLabel(input.sheet),
    exclusions: dedupe(input.exclusions),
    references: input.references.filter((r) => r.name.trim() !== ''),
    acknowledgements: dedupe(input.acknowledgements),
    bond: input.bond,
    specialProvisions: (input.specialProvisions ?? '').trim() || null,
  }
}

/**
 * Which library items apply to a sheet: the all-trades list plus the sheet's
 * own trade, live items only, in library order. `ticked` seeds the checklist
 * (defaults on, "ask" items off).
 */
export function scopeItemsForTrade(
  items: SubScopeItem[],
  serviceTypeId: string | null,
  kind: SubScopeItemKind,
): Array<{ item: SubScopeItem; ticked: boolean }> {
  return items
    .filter((i) => i.kind === kind && !i.archived_at && (i.service_type_id == null || i.service_type_id === serviceTypeId))
    .sort((a, b) => {
      // All-trades lines first, then the trade's own, each in sequence order.
      const ga = a.service_type_id == null ? 0 : 1
      const gb = b.service_type_id == null ? 0 : 1
      return ga - gb || a.sequence_order - b.sequence_order || a.label.localeCompare(b.label)
    })
    .map((item) => ({ item, ticked: item.is_default }))
}

export type SubWorkOrderRailSegment = {
  key: 'draft' | 'sent' | 'signed' | 'working' | 'walkthrough' | 'customer_pay' | 'paid'
  label: string
  state: 'done' | 'now' | 'todo'
}

/**
 * The sheet work order's rail: its own money steps (Draft → Sent → Signed),
 * then it hands off to the sheet's stages. Declined/cancelled return empty —
 * the panel shows their banner instead.
 */
export function sheetWorkOrderRail(
  commitmentStatus: string,
  sheetStage: 'working' | 'walkthrough' | 'customer_pay',
  sheetOpen: number,
): SubWorkOrderRailSegment[] {
  if (commitmentStatus === 'cancelled' || commitmentStatus === 'declined') return []
  const signed = commitmentStatus === 'accepted' || commitmentStatus === 'approved' || commitmentStatus === 'settled'
  const sent = signed || commitmentStatus === 'offered'
  const stageRank = sheetStage === 'working' ? 0 : sheetStage === 'walkthrough' ? 1 : 2
  const paid = signed && sheetOpen <= 0
  const segs: SubWorkOrderRailSegment[] = [
    { key: 'draft', label: 'Draft', state: sent ? 'done' : 'now' },
    { key: 'sent', label: commitmentStatus === 'offered' ? 'Awaiting signature' : 'Sent', state: signed ? 'done' : sent ? 'now' : 'todo' },
    { key: 'signed', label: 'Signed', state: signed ? 'done' : 'todo' },
    { key: 'working', label: 'Working', state: !signed ? 'todo' : paid || stageRank > 0 ? 'done' : 'now' },
    { key: 'walkthrough', label: 'Walk-through', state: !signed ? 'todo' : paid || stageRank > 1 ? 'done' : stageRank === 1 ? 'now' : 'todo' },
    { key: 'customer_pay', label: 'Customer pays', state: !signed ? 'todo' : paid ? 'done' : stageRank === 2 ? 'now' : 'todo' },
    { key: 'paid', label: 'Paid', state: paid ? 'done' : 'todo' },
  ]
  return segs
}

export type GeneralConditionsStanding = 'current' | 'behind' | 'unsigned' | 'none'

/**
 * Where a sub stands against the Contract Book's General Conditions: signed
 * the current version, signed an older one, never signed, or the book has no
 * such document. `signedVersionDate` is the applied_version_date on their
 * signed copy; `bookVersionDate` the library entry's book_version_date.
 */
export function generalConditionsStanding(input: {
  bookVersionDate: string | null
  signedVersionDate: string | null
  signed: boolean
}): GeneralConditionsStanding {
  if (!input.bookVersionDate) return 'none'
  if (!input.signed) return 'unsigned'
  if (!input.signedVersionDate) return 'behind'
  return input.signedVersionDate >= input.bookVersionDate ? 'current' : 'behind'
}

/** The amount a sheet-anchored work order freezes: the sheet total at send, never less than zero. */
export function frozenAmountFromSheetTotal(sheetTotal: number): number {
  if (!Number.isFinite(sheetTotal) || sheetTotal < 0) return 0
  return Math.round(sheetTotal * 100) / 100
}

/**
 * After signing, the sheet can still be edited. "differs" tells the office
 * the signed amount and the live sheet total no longer agree (a change order
 * is the honest fix); a cent of rounding is not a difference.
 */
export function signedAmountDrift(signedAmount: number, sheetTotal: number): { differs: boolean; delta: number } {
  const delta = Math.round((sheetTotal - signedAmount) * 100) / 100
  return { differs: Math.abs(delta) >= 0.01, delta }
}
