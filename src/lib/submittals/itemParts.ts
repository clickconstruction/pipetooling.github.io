/**
 * The parts of a submittal row (Wendi, 2026-10-01: "need to show parts not just assemblies").
 *
 * A row is one fixture tag; its parts are what is bought and what the GC reviews — the bowl,
 * the flush valve, the seat, the carrier — each with its own house, lead time, stage and
 * quantity per fixture. A part the GC does not see (trim: stops, supplies, traps) is still
 * bought: `on_submittal` false, "order only". The row's own columns stay the roll-up every
 * older reader uses: `submitted_label` is the parts on the submittal joined with " + ".
 * Stored in `bid_submittal_item_parts` (migration 20261001200000). Pure.
 */
import type { ProductPiece } from './takeoffCandidates'
import { parseLeadTime } from './leadTime'
import { splitPartLabel } from '../../../supabase/functions/_shared/submittalRoomPayload'

export type PartStage = 'rough_in' | 'top_out' | 'trim_set'
export type PartSource = 'takeoff' | 'file' | 'hand'

/** A stored part (hand-typed until the types regen after the push). */
export type SubmittalPartRow = {
  id: string
  item_id: string
  bid_id: string
  sequence_order: number
  label: string
  manufacturer: string | null
  model: string | null
  description: string | null
  quantity: number
  on_submittal: boolean
  source: string
  part_id: string | null
  source_line_id: string | null
  source_template_item_id: string | null
  assembly: string | null
  priced_label: string | null
  reason_note: string | null
  supply_house_id: string | null
  lead_time_days: number | null
  stage: string | null
  sheet_file: number | null
  sheet_pages: number[]
  review_decision: string | null
  review_note: string | null
  reviewed_at: string | null
  reviewed_by_name: string | null
  reviewed_by_email: string | null
  reviewed_by_person_id: string | null
  decision_source: string
  decision_entered_by: string | null
  decision_entered_by_name: string | null
  procure_key: string
  carried_from_part_id: string | null
  created_at: string
  updated_at: string
}

export type SubmittalPartInsert = {
  item_id: string
  bid_id: string
  sequence_order: number
  label: string
  manufacturer?: string | null
  model?: string | null
  description?: string | null
  quantity?: number
  on_submittal?: boolean
  source?: PartSource
  part_id?: string | null
  source_line_id?: string | null
  source_template_item_id?: string | null
  assembly?: string | null
  priced_label?: string | null
  reason_note?: string | null
  supply_house_id?: string | null
  lead_time_days?: number | null
  stage?: PartStage | null
  sheet_file?: number | null
  sheet_pages?: number[]
  procure_key?: string
  carried_from_part_id?: string | null
  review_decision?: string | null
  review_note?: string | null
  reviewed_at?: string | null
  reviewed_by_name?: string | null
  reviewed_by_email?: string | null
  reviewed_by_person_id?: string | null
  decision_source?: 'room' | 'entered' | 'robot' | 'carried'
}

export const STAGE_WORDS: Record<PartStage, string> = { rough_in: 'Rough In', top_out: 'Top Out', trim_set: 'Trim Set' }

export function asPartStage(v: string | null | undefined): PartStage | null {
  return v === 'rough_in' || v === 'top_out' || v === 'trim_set' ? v : null
}

/** A part's label read model first — the room's own reader, so the office and the GC split it the same way. */
export { splitPartLabel }

/** "× 2" for more than one on a fixture; "" for one. Whole numbers stay whole. */
export function formatPartQty(q: number | null | undefined): string {
  const n = Number(q)
  if (!Number.isFinite(n) || n === 1) return ''
  const shown = Number.isInteger(n) ? String(n) : String(Math.round(n * 100) / 100)
  return `× ${shown}`
}

/** What a trim part is, in one or two words, for the "ordered, not submitted" line. */
const TRIM_WORDS: Array<[RegExp, string]> = [
  [/\bSUPPL(?:Y|IES)\b/i, 'supply'],
  [/\bANGLE\s*STOPS?\b|\bSTOPS?\b|\bANG\b|\bLOOSE\s*KEY\b/i, 'stop'],
  [/\bGRID\s*DRAINS?\b/i, 'grid drain'],
  [/\bP-?\s*TRAPS?\b|\bTRAPS?\b(?!\s*PRIMER)/i, 'P-trap'],
  [/\bFLANGES?\b/i, 'flange'],
  [/\bTAIL\s*PIECES?\b|\bTAILPIECES?\b/i, 'tailpiece'],
  [/\bESCUTCHEONS?\b/i, 'escutcheon'],
  [/\bWAX\b/i, 'wax ring'],
  [/\bBOLTS?\b/i, 'bolts'],
  [/\bRISERS?\b/i, 'riser'],
]
export function trimWord(label: string): string {
  for (const [re, word] of TRIM_WORDS) if (re.test(label)) return word
  return splitPartLabel(label).head
}

/** "supply × 2, grid drain, P-trap, stop, flange" — the order-only parts, short. "" when none. */
export function orderOnlyLine(parts: ReadonlyArray<Pick<SubmittalPartRow, 'label' | 'quantity' | 'on_submittal'>>): string {
  return parts
    .filter((p) => !p.on_submittal)
    .map((p) => [trimWord(p.label), formatPartQty(p.quantity)].filter(Boolean).join(' '))
    .join(', ')
}

type RollUpPart = Pick<SubmittalPartRow, 'label' | 'on_submittal' | 'supply_house_id' | 'lead_time_days' | 'sequence_order'>

/** The parts the GC sees, in order. */
export function submittedParts<T extends Pick<SubmittalPartRow, 'on_submittal' | 'sequence_order'>>(parts: ReadonlyArray<T>): T[] {
  return [...parts].filter((p) => p.on_submittal).sort((a, b) => a.sequence_order - b.sequence_order)
}

/**
 * The row's own columns from its parts: the label the room, the package and every older reader
 * show (the GC's parts joined, null when none); the house of the first of them that has one
 * (else of any part); the longest lead time among them (the fixture is complete when its last
 * part lands).
 */
export function rollUpFromParts(parts: ReadonlyArray<RollUpPart>): { submitted_label: string | null; supply_house_id: string | null; lead_time_days: number | null } {
  const on = submittedParts(parts)
  const all = [...parts].sort((a, b) => a.sequence_order - b.sequence_order)
  const leads = on.map((p) => p.lead_time_days).filter((d): d is number => d != null)
  return {
    submitted_label: on.length > 0 ? on.map((p) => p.label.trim()).join(' + ') : null,
    supply_house_id: on.find((p) => p.supply_house_id)?.supply_house_id ?? all.find((p) => p.supply_house_id)?.supply_house_id ?? null,
    lead_time_days: leads.length > 0 ? Math.max(...leads) : null,
  }
}

/** Every house a row's parts come from, in part order, once each. */
export function partHouseIds(parts: ReadonlyArray<Pick<SubmittalPartRow, 'supply_house_id' | 'sequence_order'>>): string[] {
  const out: string[] = []
  for (const p of [...parts].sort((a, b) => a.sequence_order - b.sequence_order)) if (p.supply_house_id && !out.includes(p.supply_house_id)) out.push(p.supply_house_id)
  return out
}

/**
 * The parts a row built from the takeoff carries: every piece, in takeoff order. The pieces in
 * `onKeys` are on the GC's submittal; the rest are order only.
 */
export function partsFromPieces(pieces: ReadonlyArray<ProductPiece>, onKeys: ReadonlyArray<string>, itemId: string, bidId: string): SubmittalPartInsert[] {
  const on = new Set(onKeys)
  return pieces.map((p, i) => ({
    item_id: itemId,
    bid_id: bidId,
    sequence_order: i + 1,
    label: p.label,
    manufacturer: p.manufacturer,
    quantity: p.quantity,
    on_submittal: on.has(p.key),
    source: 'takeoff' as const,
    part_id: p.partId,
    source_line_id: p.lineId,
    source_template_item_id: p.templateItemId,
    assembly: p.assembly,
    supply_house_id: p.houseId,
  }))
}

/**
 * A part carried onto the next revision's row: the same part and its procurement key; the call
 * starts blank — unless `keepApproval` and the part was approved, when the approval comes along
 * marked carried (a resubmit of the parts sent back: the approved parts stand).
 */
export function carryPartInsert(p: SubmittalPartRow, itemId: string, keepApproval = false): SubmittalPartInsert {
  const approved = keepApproval && p.review_decision === 'approved'
  return {
    item_id: itemId,
    bid_id: p.bid_id,
    sequence_order: p.sequence_order,
    label: p.label,
    manufacturer: p.manufacturer,
    model: p.model,
    description: p.description,
    quantity: Number(p.quantity),
    on_submittal: p.on_submittal,
    source: (p.source === 'file' || p.source === 'hand' ? p.source : 'takeoff') as PartSource,
    part_id: p.part_id,
    source_line_id: p.source_line_id,
    source_template_item_id: p.source_template_item_id,
    assembly: p.assembly,
    priced_label: p.priced_label,
    reason_note: p.reason_note,
    supply_house_id: p.supply_house_id,
    lead_time_days: p.lead_time_days,
    stage: asPartStage(p.stage),
    sheet_file: p.sheet_file,
    sheet_pages: [...(p.sheet_pages ?? [])],
    procure_key: p.procure_key,
    carried_from_part_id: p.id,
    ...(approved
      ? { review_decision: 'approved', review_note: p.review_note, reviewed_at: p.reviewed_at, reviewed_by_name: p.reviewed_by_name, reviewed_by_email: p.reviewed_by_email, reviewed_by_person_id: p.reviewed_by_person_id, decision_source: 'carried' as const }
      : {}),
  }
}

/** The same part on another row that is bought on its own (a split tag): a procurement line of its own, no link back. */
export function copyPartInsert(p: SubmittalPartRow, itemId: string): SubmittalPartInsert {
  const c = carryPartInsert(p, itemId)
  delete c.procure_key
  return { ...c, carried_from_part_id: null }
}

/** One part as the row editor holds it. `id` is absent on a part typed in the editor. */
export type PartDraft = {
  id?: string
  label: string
  quantity: number
  on_submittal: boolean
  supply_house_id: string | null
  lead_time_days: number | null
  stage: PartStage | null
}

export function partToDraft(p: SubmittalPartRow): PartDraft {
  return { id: p.id, label: p.label, quantity: Number(p.quantity), on_submittal: p.on_submittal, supply_house_id: p.supply_house_id, lead_time_days: p.lead_time_days, stage: asPartStage(p.stage) }
}

/**
 * What Save writes for the editor's parts: the parts taken off, the parts changed (with only
 * what changed, plus their place), the parts typed in. Blank labels are dropped.
 */
export function diffPartDrafts(
  before: ReadonlyArray<SubmittalPartRow>,
  after: ReadonlyArray<PartDraft>,
  itemId: string,
  bidId: string,
): { deletes: string[]; updates: Array<{ id: string; patch: Partial<SubmittalPartInsert> }>; inserts: SubmittalPartInsert[] } {
  const kept = after.map((d) => ({ ...d, label: d.label.trim() })).filter((d) => d.label)
  const keptIds = new Set(kept.map((d) => d.id).filter((x): x is string => !!x))
  const byId = new Map(before.map((p) => [p.id, p]))
  const deletes = before.filter((p) => !keptIds.has(p.id)).map((p) => p.id)
  const updates: Array<{ id: string; patch: Partial<SubmittalPartInsert> }> = []
  const inserts: SubmittalPartInsert[] = []
  kept.forEach((d, i) => {
    const seq = i + 1
    const was = d.id ? byId.get(d.id) : undefined
    if (!was) {
      inserts.push({ item_id: itemId, bid_id: bidId, sequence_order: seq, label: d.label, quantity: d.quantity, on_submittal: d.on_submittal, source: 'hand', supply_house_id: d.supply_house_id, lead_time_days: d.lead_time_days, stage: d.stage })
      return
    }
    const patch: Partial<SubmittalPartInsert> = {}
    if (was.sequence_order !== seq) patch.sequence_order = seq
    if (was.label !== d.label) {
      patch.label = d.label
      // A renamed part is a different product: its maker and model are read again from the name.
      patch.manufacturer = null
      patch.model = null
      patch.part_id = null
    }
    if (Number(was.quantity) !== d.quantity) patch.quantity = d.quantity
    if (was.on_submittal !== d.on_submittal) patch.on_submittal = d.on_submittal
    if ((was.supply_house_id ?? null) !== d.supply_house_id) patch.supply_house_id = d.supply_house_id
    if ((was.lead_time_days ?? null) !== d.lead_time_days) patch.lead_time_days = d.lead_time_days
    if (asPartStage(was.stage) !== d.stage) patch.stage = d.stage
    if (Object.keys(patch).length > 0) updates.push({ id: was.id, patch })
  })
  return { deletes, updates, inserts }
}

/** "from LAV 1 assembly SPACEX" when every part from an assembly came from the same one; "" otherwise. */
export function assemblyLine(parts: ReadonlyArray<Pick<SubmittalPartRow, 'assembly'>>): string {
  const names = [...new Set(parts.map((p) => p.assembly?.trim()).filter((x): x is string => !!x))]
  return names.length === 1 ? `from ${names[0]}` : names.length > 1 ? `from ${names.join(' and ')}` : ''
}

/** The parts by row id, each list in order. */
export function partsByItem<T extends Pick<SubmittalPartRow, 'item_id' | 'sequence_order'>>(parts: ReadonlyArray<T>): Map<string, T[]> {
  const out = new Map<string, T[]>()
  for (const p of parts) out.set(p.item_id, [...(out.get(p.item_id) ?? []), p])
  for (const list of out.values()) list.sort((a, b) => a.sequence_order - b.sequence_order)
  return out
}

/** Each part's lead time as its box holds it, by place: the typed text, so "3 wk" survives a re-render. */
export type PartLeadTexts = Record<number, string>

/** True when a part's lead time box holds text that does not read as a lead time. */
export function partLeadTextsBad(leadTexts: PartLeadTexts, count: number): boolean {
  for (let i = 0; i < count; i++) {
    const t = leadTexts[i]
    if (t != null && t.trim() !== '' && parseLeadTime(t) == null) return true
  }
  return false
}

/** "2 approved · 1 revise · 1 to go" over the parts the GC sees; "" when none has a call yet. */
export function partCallsLine(parts: ReadonlyArray<Pick<SubmittalPartRow, 'on_submittal' | 'review_decision'>>): string {
  const gc = parts.filter((p) => p.on_submittal)
  const c = { approved: 0, revise: 0, rejected: 0, open: 0 }
  for (const p of gc) {
    if (p.review_decision === 'approved' || p.review_decision === 'revise' || p.review_decision === 'rejected') c[p.review_decision] += 1
    else c.open += 1
  }
  if (c.approved + c.revise + c.rejected === 0) return ''
  return [c.approved ? `${c.approved} approved` : '', c.revise ? `${c.revise} revise` : '', c.rejected ? `${c.rejected} rejected` : '', c.open ? `${c.open} to go` : ''].filter(Boolean).join(' · ')
}
