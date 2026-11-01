/**
 * How many photos each report in a list carries (punch list #229, PR 3): the folded rows on the Dashboard's Recent
 * reports, the Reports tab's cards and the job window's thread say *📷 2* before anyone opens a card. One read per
 * list, never one a row: the ids go up in chunks, the rows come back as `report_id` only, and the count is made
 * here. A report with no photos has no badge, so every old row draws as it did.
 */

/** The badge's glyph: the same camera the strip and the tiles draw with. */
export const PHOTO_BADGE_GLYPH = '📷'

/** The most ids one read carries; a longer list goes up in pieces so the URL stays short. */
export const PHOTO_COUNT_CHUNK = 150

/** The ids in pieces of at most `size`, the order kept, empty and repeated ids dropped. */
export function chunkIds(ids: ReadonlyArray<string>, size: number = PHOTO_COUNT_CHUNK): string[][] {
  const seen = new Set<string>()
  const clean: string[] = []
  for (const id of ids) {
    if (!id || seen.has(id)) continue
    seen.add(id)
    clean.push(id)
  }
  const out: string[][] = []
  for (let i = 0; i < clean.length; i += size) out.push(clean.slice(i, i + size))
  return out
}

/** The count per report from the rows a read answered; a report with no row is absent, never zero. */
export function countPhotosByReport(rows: ReadonlyArray<{ report_id: string | null }>): Map<string, number> {
  const counts = new Map<string, number>()
  for (const r of rows) {
    if (!r.report_id) continue
    counts.set(r.report_id, (counts.get(r.report_id) ?? 0) + 1)
  }
  return counts
}

/** The badge on a folded row: *📷 2* with *2 photos* for a reader, or null for a report with none. */
export function photoBadge(count: number | undefined): { text: string; label: string } | null {
  if (!count || count <= 0) return null
  return { text: `${PHOTO_BADGE_GLYPH} ${count}`, label: count === 1 ? '1 photo' : `${count} photos` }
}

/** The ids whose count the list does not hold yet, so a list that grows reads only the new rows. */
export function idsToRead(ids: ReadonlyArray<string>, known: ReadonlyMap<string, number>, asked: ReadonlySet<string>): string[] {
  return ids.filter((id) => id && !known.has(id) && !asked.has(id))
}
