/**
 * Field photo → Google Drive handover kernel (v2.2300). Long-term all customer
 * photos live in Google Drive; Quick Estimate field photos land in Supabase
 * Storage first. The Quickfill section lists every estimate still holding
 * Supabase photos so the office can download them, move them to Drive, and
 * replace them with the folder link. This kernel owns the pure parts: grouping,
 * labels, and link validation.
 */

export type HandoverPhotoRow = {
  id: string
  estimate_id: string
  storage_path: string
  filename: string | null
  created_at: string
}

export type HandoverEstimateRow = {
  id: string
  estimate_number: number | null
  doc_kind: string
  title: string
  status: string
  customerName: string | null
}

export type HandoverGroup = {
  estimateId: string
  estimateNumber: number | null
  /** "CO #78 — Herber Custom Homes" / "Estimate #79 — Field estimate — Mike…" */
  label: string
  status: string
  photos: HandoverPhotoRow[]
  /** Oldest photo in the group — groups sort oldest-first so backlog surfaces. */
  oldestAt: string
}

export function handoverGroupLabel(e: HandoverEstimateRow): string {
  const kind = e.doc_kind === 'change_order' ? 'CO' : 'Estimate'
  const num = e.estimate_number != null ? ` #${e.estimate_number}` : ''
  const who = e.customerName?.trim() || e.title.trim()
  return `${kind}${num}${who ? ` — ${who}` : ''}`
}

/**
 * Group photos by estimate, oldest group first. Estimates with a recorded
 * handover (already moved) must be filtered out by the caller's query; an
 * estimate row missing from `estimates` (RLS or deleted) is skipped.
 */
export function groupFieldPhotosByEstimate(
  photos: HandoverPhotoRow[],
  estimates: HandoverEstimateRow[],
): HandoverGroup[] {
  const byId = new Map(estimates.map((e) => [e.id, e]))
  const groups = new Map<string, HandoverGroup>()
  for (const p of photos) {
    const e = byId.get(p.estimate_id)
    if (!e) continue
    let g = groups.get(p.estimate_id)
    if (!g) {
      g = {
        estimateId: p.estimate_id,
        estimateNumber: e.estimate_number,
        label: handoverGroupLabel(e),
        status: e.status,
        photos: [],
        oldestAt: p.created_at,
      }
      groups.set(p.estimate_id, g)
    }
    g.photos.push(p)
    if (p.created_at < g.oldestAt) g.oldestAt = p.created_at
  }
  const list = [...groups.values()]
  for (const g of list) g.photos.sort((a, b) => a.created_at.localeCompare(b.created_at))
  list.sort((a, b) => a.oldestAt.localeCompare(b.oldestAt))
  return list
}

/** A pasted Drive link is usable when it's an https URL (drive.google.com preferred, not required). */
export function isDriveLinkValid(text: string): boolean {
  return /^https:\/\/\S+\.\S+/.test(text.trim())
}
