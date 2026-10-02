/**
 * Bring a draft up to date (2026-10-01). A row built from the takeoff keeps the parts it was
 * built with; when the takeoff reads more — an assembly opened into its parts, a fixture whose
 * pieces were switched — **Refresh from the takeoff** writes them, keeping what the estimator set
 * on a part (house, lead time, stage, pages, call) where the takeoff still has that part. A row
 * whose parts came from the house's file is the newer truth and is left alone. And a row typed
 * by hand for one fixture's part — BP375's three Josam carriers, "Carrier for WC-1 and WC-2." —
 * can be **folded** into that fixture as a part, its order and delivery dates with it. Pure.
 */
import { asPartStage, formatPartQty, isCarrier, partsFromPieces, splitPartLabel, type SubmittalPartInsert, type SubmittalPartRow } from './itemParts'
import type { TakeoffCandidate } from './takeoffCandidates'
import type { SubmittalItemRow } from './submittalRevision'
import { tagSet } from './houseFileParts'

export type RefreshPlanRow = {
  itemId: string
  tag: string
  /** What the row reads now. */
  before: string
  /** What it will read: the parts the GC sees, short. */
  after: string
  parts: number
  gc: number
}

export type RefreshSkip = { itemId: string; tag: string; why: 'house_file' | 'same' | 'no_takeoff' }

const short = (labels: ReadonlyArray<string>) => labels.map((l) => splitPartLabel(l).head).join(' + ')
/** One part reads whole; several read by maker and model. */
const before = (labels: ReadonlyArray<string>) => (labels.length <= 1 ? (labels[0] ?? '').trim() : short(labels))

/** A takeoff part's identity: the assembly item it sits in, else its takeoff line. */
function pieceKey(p: { source_template_item_id?: string | null; source_line_id?: string | null; templateItemId?: string | null; lineId?: string | null }): string | null {
  return p.templateItemId ?? p.source_template_item_id ?? p.lineId ?? p.source_line_id ?? null
}

/** The rows a refresh would change, and the rows it would leave and why. */
export function planTakeoffRefresh(items: ReadonlyArray<SubmittalItemRow>, partsByItem: ReadonlyMap<string, ReadonlyArray<SubmittalPartRow>>, candidates: ReadonlyArray<TakeoffCandidate>): { rows: RefreshPlanRow[]; skipped: RefreshSkip[] } {
  const byCountRow = new Map(candidates.map((c) => [c.countRowId, c] as const))
  const rows: RefreshPlanRow[] = []
  const skipped: RefreshSkip[] = []
  for (const it of items) {
    if (!it.source_count_row_id) continue
    const tag = it.tag.trim() || it.specified_description || 'a row'
    const c = byCountRow.get(it.source_count_row_id)
    if (!c || c.pieces.length === 0) {
      skipped.push({ itemId: it.id, tag, why: 'no_takeoff' })
      continue
    }
    const have = partsByItem.get(it.id) ?? []
    if (have.some((p) => p.source === 'file')) {
      skipped.push({ itemId: it.id, tag, why: 'house_file' })
      continue
    }
    const takeoffHave = have.filter((p) => p.source === 'takeoff')
    const nowKeys = takeoffHave.map((p) => `${pieceKey(p)}|${p.label}|${p.on_submittal}|${Number(p.quantity)}`).sort().join('~')
    const nextKeys = c.pieces.map((p) => `${pieceKey(p)}|${p.label}|${c.productKeys.includes(p.key)}|${p.quantity}`).sort().join('~')
    if (have.length > 0 && nowKeys === nextKeys) {
      skipped.push({ itemId: it.id, tag, why: 'same' })
      continue
    }
    const gc = c.pieces.filter((p) => c.productKeys.includes(p.key))
    rows.push({
      itemId: it.id,
      tag,
      before: have.length > 0 ? before(have.filter((p) => p.on_submittal).map((p) => p.label)) || '(nothing for the GC)' : `one line, no parts: ${before((it.submitted_label ?? '').split(' + ').filter((l) => l.trim())) || '—'}`,
      after: gc.length > 0 ? short(gc.map((p) => `${p.label}${formatPartQty(p.quantity) ? ` ${formatPartQty(p.quantity)}` : ''}`)) : '(every part order only)',
      parts: c.pieces.length,
      gc: gc.length,
    })
  }
  return { rows, skipped }
}

/** What a refresh or a fold writes on a row's parts. */
export type PartWrites = { deletes: string[]; updates: Array<{ id: string; patch: Partial<SubmittalPartInsert> }>; inserts: SubmittalPartInsert[] }

/**
 * What a refresh writes on one row: a takeoff part the takeoff still has keeps its record — the
 * house, lead time, stage, pages and call the estimator set — with the takeoff's name, count and
 * switch; a new piece is a new part; a takeoff part the takeoff dropped comes off. A part that
 * opened into pieces (an assembly read as one line before its contents loaded) hands its
 * procurement key, house, lead time, stage and pages to the first piece off the same takeoff
 * line, so a date typed on the log for it holds. Parts typed by hand stay, after the takeoff's.
 */
export function takeoffRefreshWrites(rowParts: ReadonlyArray<SubmittalPartRow>, c: TakeoffCandidate, itemId: string, bidId: string): PartWrites {
  const fresh = partsFromPieces(c.pieces, c.productKeys, itemId, bidId)
  const takeoffHave = rowParts.filter((p) => p.source === 'takeoff')
  const byKey = new Map<string, SubmittalPartRow>()
  for (const p of takeoffHave) {
    const k = pieceKey(p)
    if (k && !byKey.has(k)) byKey.set(k, p)
  }
  const kept = new Set<string>()
  const updates: Array<{ id: string; patch: Partial<SubmittalPartInsert> }> = []
  const inserts: SubmittalPartInsert[] = []
  fresh.forEach((f) => {
    const k = pieceKey(f)
    const was = k ? byKey.get(k) : undefined
    if (was && !kept.has(was.id)) {
      kept.add(was.id)
      updates.push({ id: was.id, patch: { sequence_order: f.sequence_order, label: f.label, quantity: f.quantity, on_submittal: f.on_submittal, assembly: f.assembly, part_id: f.part_id } })
    } else inserts.push(f)
  })
  const gone = takeoffHave.filter((p) => !kept.has(p.id))
  for (const old of gone) {
    const heir = inserts.find((f) => !f.procure_key && old.source_line_id && f.source_line_id === old.source_line_id)
    if (!heir) continue
    heir.procure_key = old.procure_key
    heir.supply_house_id = heir.supply_house_id ?? old.supply_house_id
    heir.lead_time_days = old.lead_time_days
    heir.stage = asPartStage(old.stage)
    heir.sheet_file = old.sheet_file
    heir.sheet_pages = [...(old.sheet_pages ?? [])]
  }
  // Hand parts follow the takeoff's.
  rowParts.filter((p) => p.source === 'hand').sort((a, b) => a.sequence_order - b.sequence_order).forEach((p, i) => {
    updates.push({ id: p.id, patch: { sequence_order: fresh.length + i + 1 } })
  })
  return { deletes: gone.map((p) => p.id), updates, inserts }
}

export type FoldSuggestion = { fromId: string; fromTag: string; intoId: string; intoTag: string }

/** One spelling for a tag: "WC-1", "WC 1" and "wc1" all read WC1. */
const canonTag = (t: string) => t.toUpperCase().replace(/[^A-Z0-9]/g, '')

/** The tags a note names: "Carrier for WC-1 and WC-2." → WC1, WC2. */
function tagsNamedIn(text: string | null | undefined): string[] {
  const out = new Set<string>()
  for (const m of (text ?? '').toUpperCase().matchAll(/\b([A-Z]{1,5})[- ]?(\d{1,3}[A-Z]?)\b/g)) out.add(`${m[1]}${m[2]}`)
  return [...out]
}

/**
 * The rows typed by hand for another row's fixture: a row with no takeoff line and no parts
 * whose note (or name) names every tag of exactly one other row — "Carrier for WC-1 and WC-2."
 * folds into WC-1, WC-2.
 */
export function foldSuggestions(items: ReadonlyArray<SubmittalItemRow>, partsByItem: ReadonlyMap<string, ReadonlyArray<SubmittalPartRow>>): FoldSuggestion[] {
  const out: FoldSuggestion[] = []
  for (const from of items) {
    if (from.source_count_row_id || (partsByItem.get(from.id) ?? []).length > 0) continue
    const named = tagsNamedIn(`${from.reason_note ?? ''} ${from.specified_description ?? ''}`)
    if (named.length === 0) continue
    const hits = items.filter((it) => {
      if (it.id === from.id) return false
      const have = tagSet(it.tag).map(canonTag)
      return have.length > 0 && have.length === named.length && have.every((t) => named.includes(t))
    })
    if (hits.length === 1) out.push({ fromId: from.id, fromTag: from.tag.trim() || 'a row', intoId: hits[0]!.id, intoTag: hits[0]!.tag.trim() })
  }
  return out
}

/** A row's own product as one part: what a row with no parts lists once another row folds into it. */
function rowAsPart(row: SubmittalItemRow, itemId: string, bidId: string, sequenceOrder: number, procureKey: string): SubmittalPartInsert {
  const call = row.review_decision
    ? { review_decision: row.review_decision, review_note: row.review_note, reviewed_at: row.reviewed_at, reviewed_by_name: row.reviewed_by_name, reviewed_by_email: row.reviewed_by_email, reviewed_by_person_id: row.reviewed_by_person_id, decision_source: asCallSource(row.decision_source) }
    : {}
  return {
    item_id: itemId,
    bid_id: bidId,
    sequence_order: sequenceOrder,
    label: (row.submitted_label ?? '').trim() || [row.submitted_manufacturer, row.submitted_model].filter(Boolean).join(' ') || [row.specified_manufacturer, row.specified_model].filter(Boolean).join(' ') || row.specified_description?.trim() || row.tag.trim() || 'Part',
    manufacturer: row.submitted_manufacturer,
    model: row.submitted_model,
    on_submittal: true,
    source: 'hand',
    supply_house_id: row.supply_house_id,
    lead_time_days: row.lead_time_days,
    sheet_file: row.sheet_file,
    sheet_pages: [...(row.sheet_pages ?? [])],
    reason_note: row.reason_note,
    procure_key: procureKey,
    ...call,
  }
}

function asCallSource(v: string | null | undefined): 'room' | 'entered' | 'robot' | 'carried' {
  return v === 'entered' || v === 'robot' || v === 'carried' ? v : 'room'
}

export type FoldPlan = PartWrites & {
  /** The procurement lines to move onto a part: the tag's own line → the part's key. */
  moveLines: Array<{ tag: string; partKey: string }>
  /** What the row it joins will list for the GC, short. */
  after: string
}

/**
 * Fold one row into another as a part (2026-10-01, BP375's carriers): the row's product, house,
 * lead time, cut-sheet pages and call become a part of `into`, typed by hand, after its parts. A
 * row with no parts yet first lists its own product as its first part, so the GC still sees the
 * fixture. Each row's procurement line moves onto its part, so an order date typed for the
 * carrier holds. The folded row itself is the caller's to delete. `mint` makes procurement keys.
 */
export function foldWrites(from: SubmittalItemRow, into: SubmittalItemRow, intoParts: ReadonlyArray<SubmittalPartRow>, bidId: string, mint: () => string, opts: { replaceId?: string | null } = {}): FoldPlan {
  const inserts: SubmittalPartInsert[] = []
  const moveLines: Array<{ tag: string; partKey: string }> = []
  // 2026-10-02 · in place of one of the row's parts: the folded part takes its place and its
  // name as what was priced, and that part comes off (BP375: the Josam in place of the Zurn).
  const replaced = opts.replaceId ? intoParts.find((p) => p.id === opts.replaceId) ?? null : null
  let seq = intoParts.reduce((m, p) => Math.max(m, p.sequence_order), 0)
  if (intoParts.length === 0) {
    const key = mint()
    inserts.push(rowAsPart(into, into.id, bidId, ++seq, key))
    if (into.tag.trim()) moveLines.push({ tag: into.tag.trim(), partKey: key })
  }
  const key = mint()
  const folded = rowAsPart(from, into.id, bidId, replaced ? replaced.sequence_order : ++seq, key)
  if (replaced) {
    folded.priced_label = replaced.label
    folded.on_submittal = replaced.on_submittal
  }
  // A carrier goes in at Rough In.
  if (isCarrier(folded.label)) folded.stage = 'rough_in'
  inserts.push(folded)
  if (from.tag.trim()) moveLines.push({ tag: from.tag.trim(), partKey: key })
  const kept = intoParts.filter((p) => p.id !== replaced?.id)
  const gcSees = [...kept.filter((p) => p.on_submittal).map((p) => ({ label: p.label, seq: p.sequence_order })), ...inserts.filter((p) => p.on_submittal !== false).map((p) => ({ label: p.label, seq: p.sequence_order }))]
    .sort((a, b) => a.seq - b.seq)
    .map((p) => p.label)
  return { deletes: replaced ? [replaced.id] : [], updates: [], inserts, moveLines, after: short(gcSees) }
}

/**
 * The part a folded row most likely replaces on the row it joins: a carrier for a carrier
 * (BP375's Josam in place of the takeoff's Zurn). Null when nothing matches; the window then
 * adds it as an extra part unless the estimator picks one.
 */
export function foldReplaceSuggestion(from: SubmittalItemRow, intoParts: ReadonlyArray<SubmittalPartRow>): string | null {
  const label = (from.submitted_label ?? '').trim() || [from.submitted_manufacturer, from.submitted_model].filter(Boolean).join(' ')
  if (!isCarrier(label) && !isCarrier(from.tag) && !isCarrier(from.reason_note)) return null
  const match = intoParts.filter((p) => isCarrier(p.label)).sort((a, b) => a.sequence_order - b.sequence_order)
  return match.length === 1 ? match[0]!.id : null
}
