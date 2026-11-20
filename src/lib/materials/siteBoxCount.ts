/**
 * The Job Mode card's door to Materials on site (the owner's pick of 2026-11-20, Way B): one press beside
 * Job calendar on every job the card names, with the count of what is on the job's site when there is anything.
 *
 * The count is the site's, never the one job's: a big site's cages often sit under a sister job, so the job a crew
 * clocks in on may hold two boxes of ninety. It is a head count of the live cages, boxes and loose piles the reader
 * may reach, read by `siteBoxCountIo.ts` and kept on the phone so the press draws its number with no signal.
 *
 * Pure: the words, the address, the chunks of an `in` filter and the kept counts' text. No React, no Supabase.
 */

export const SITE_BOX_DOOR_LABEL = 'Materials on site'

/** The press's tooltip on a job whose site holds nothing the reader can see, as the old link said it. */
export const SITE_BOX_DOOR_TITLE = 'What is in the cages and boxes on this job, and what you used'

/** The On site tab of the Job Parts Tally, on the job the card names. */
export function siteBoxDoorHref(jobId: string | null | undefined): string {
  const id = (jobId ?? '').trim()
  return id ? `/tally?tab=on-site&job=${id}` : '/tally?tab=on-site'
}

export type SiteBoxDoorWords = {
  label: string
  /** The number on the press, or null when there is nothing to count or the count is not read yet. */
  count: string | null
  /** What a screen reader says: the label alone, or the label and what the count means. */
  aria: string
  title: string
}

/** *1 cage or box on this site* · *14 cages and boxes on this site*. */
export function siteBoxCountSentence(n: number): string {
  return n === 1 ? '1 cage or box on this site' : `${n} cages and boxes on this site`
}

export function siteBoxDoorWords(count: number | null | undefined): SiteBoxDoorWords {
  const n = typeof count === 'number' && Number.isFinite(count) ? Math.max(0, Math.floor(count)) : 0
  if (n === 0) return { label: SITE_BOX_DOOR_LABEL, count: null, aria: SITE_BOX_DOOR_LABEL, title: SITE_BOX_DOOR_TITLE }
  const sentence = siteBoxCountSentence(n)
  return { label: SITE_BOX_DOOR_LABEL, count: String(n), aria: `${SITE_BOX_DOOR_LABEL}, ${sentence}`, title: `${sentence}. Open them to take, count or move material.` }
}

/** A site's job ids in runs short enough for one `in` filter's address. */
export function siteJobIdChunks(ids: ReadonlyArray<string>, size = 80): string[][] {
  const unique = [...new Set(ids.map((id) => id.trim()).filter(Boolean))]
  const step = Math.max(1, Math.floor(size))
  const out: string[][] = []
  for (let i = 0; i < unique.length; i += step) out.push(unique.slice(i, i + step))
  return out
}

// ---------------------------------------------------------------------------
// The counts kept on the phone
// ---------------------------------------------------------------------------

export const SITE_BOX_COUNT_KEY = 'pt.siteBoxCount.v1'
/** How many jobs' counts the phone keeps: a crew's jobs of a few weeks. */
export const SITE_BOX_COUNT_KEPT = 40
/** A count older than this is read again when the page comes back to the front. */
export const SITE_BOX_COUNT_FRESH_MS = 5 * 60 * 1000

type Kept = Record<string, { n: number; at: number }>

function parseKept(raw: string | null | undefined): Kept {
  if (!raw) return {}
  try {
    const v: unknown = JSON.parse(raw)
    if (!v || typeof v !== 'object' || Array.isArray(v)) return {}
    const out: Kept = {}
    for (const [jobId, row] of Object.entries(v as Record<string, unknown>)) {
      if (!row || typeof row !== 'object') continue
      const { n, at } = row as { n?: unknown; at?: unknown }
      if (typeof n === 'number' && Number.isFinite(n) && n >= 0 && typeof at === 'number' && Number.isFinite(at)) out[jobId] = { n: Math.floor(n), at }
    }
    return out
  } catch {
    return {}
  }
}

/** The count the phone kept for a job with when it was read, or null when it kept none. */
export function keptSiteBoxCount(raw: string | null | undefined, jobId: string): { n: number; at: number } | null {
  return parseKept(raw)[jobId] ?? null
}

/** The kept text with one job's count set, the oldest dropped past `SITE_BOX_COUNT_KEPT`. */
export function keepSiteBoxCount(raw: string | null | undefined, jobId: string, n: number, at: number): string {
  const kept = parseKept(raw)
  kept[jobId] = { n: Math.max(0, Math.floor(n)), at }
  const newest = Object.entries(kept)
    .sort((a, b) => b[1].at - a[1].at)
    .slice(0, SITE_BOX_COUNT_KEPT)
  return JSON.stringify(Object.fromEntries(newest))
}

/** Whether a kept count is due another read. */
export function siteBoxCountIsStale(at: number | null | undefined, now: number): boolean {
  return at == null || now - at >= SITE_BOX_COUNT_FRESH_MS
}
