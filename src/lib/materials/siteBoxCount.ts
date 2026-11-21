/**
 * The Job Mode card's door to Materials on site (the owner's pick of 2026-11-20, Way B): one press beside
 * Job calendar on every job the card names, with the count of what is on the job's site when there is anything.
 *
 * The count is the site's, never the one job's: a big site's cages often sit under a sister job, so the job a crew
 * clocks in on may hold two boxes of ninety. It is a head count of the live cages, boxes and loose piles the reader
 * may reach, read by `siteBoxCountIo.ts` and kept on the phone so the press draws its number with no signal.
 *
 * Since v2.8103 one database read, `on_site_door_facts`, answers two more facts of the site: how many of its boxes are
 * due a count and how many printed stickers wait for a box. The card says them on one line under the press, and only
 * where there is something to say (`siteDoorNews`).
 *
 * Pure: the words, the address, the chunks of an `in` filter and the kept facts' text. No React, no Supabase.
 */
import { val } from '../valuesInPlace'

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
// The site's facts: its boxes, the ones due a count, the stickers waiting
// ---------------------------------------------------------------------------

/** What `on_site_door_facts` answers of a job's site, under the reader's own access. */
export type SiteDoorFacts = { boxes: number; due: number; stickers: number }

const whole = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? Math.floor(v) : null)

/** The database's answer as facts, or null when it is not one (an older database, an empty answer). */
export function siteDoorFactsOf(raw: unknown): SiteDoorFacts | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  const { boxes, due, stickers } = raw as Record<string, unknown>
  const b = whole(boxes)
  if (b == null) return null
  return { boxes: b, due: Math.min(whole(due) ?? 0, b), stickers: whole(stickers) ?? 0 }
}

/** A bare head count as facts: what an older database can say. */
export function siteDoorFactsFromCount(boxes: number): SiteDoorFacts {
  return { boxes: Math.max(0, Math.floor(boxes)), due: 0, stickers: 0 }
}

export type SiteDoorNews = {
  /** *⟪due|2⟫ due a count*, or null when every box was counted inside 14 days. */
  due: string | null
  /** *⟪stickers|6⟫ stickers ready for a box*, or null when none wait. */
  stickers: string | null
  /** Both, plain, for a screen reader. */
  plain: string
}

/**
 * The line under the press: what on the site wants a hand. Null when nothing does, and then no line is drawn.
 * Each number is marked with `val`, so the card draws it apart from its words.
 */
export function siteDoorNews(facts: SiteDoorFacts | null | undefined): SiteDoorNews | null {
  if (!facts) return null
  const due = facts.due > 0 ? `${val('due', String(facts.due))} due a count` : null
  const stickers = facts.stickers > 0 ? `${val('stickers', String(facts.stickers))} ${facts.stickers === 1 ? 'sticker' : 'stickers'} ready for a box` : null
  if (!due && !stickers) return null
  const plain = [facts.due > 0 ? `${facts.due} due a count` : '', facts.stickers > 0 ? `${facts.stickers} ${facts.stickers === 1 ? 'sticker' : 'stickers'} ready for a box` : ''].filter(Boolean).join(', ')
  return { due, stickers, plain }
}

// ---------------------------------------------------------------------------
// The facts kept on the phone
// ---------------------------------------------------------------------------

export const SITE_BOX_COUNT_KEY = 'pt.siteBoxCount.v1'
/** How many jobs' facts the phone keeps: a crew's jobs of a few weeks. */
export const SITE_BOX_COUNT_KEPT = 40
/** Facts older than this are read again when the page comes back to the front. */
export const SITE_BOX_COUNT_FRESH_MS = 5 * 60 * 1000

/** One job's kept facts. `n` is the boxes, the name the first build kept it under. */
type KeptRow = { n: number; due?: number; stickers?: number; at: number }
type Kept = Record<string, KeptRow>

function parseKept(raw: string | null | undefined): Kept {
  if (!raw) return {}
  try {
    const v: unknown = JSON.parse(raw)
    if (!v || typeof v !== 'object' || Array.isArray(v)) return {}
    const out: Kept = {}
    for (const [jobId, row] of Object.entries(v as Record<string, unknown>)) {
      if (!row || typeof row !== 'object') continue
      const { n, due, stickers, at } = row as Record<string, unknown>
      const boxes = whole(n)
      if (boxes == null || typeof at !== 'number' || !Number.isFinite(at)) continue
      out[jobId] = { n: boxes, due: Math.min(whole(due) ?? 0, boxes), stickers: whole(stickers) ?? 0, at }
    }
    return out
  } catch {
    return {}
  }
}

/** The facts the phone kept for a job with when they were read, or null when it kept none. A count kept by the first build reads with nothing due and no stickers. */
export function keptSiteDoorFacts(raw: string | null | undefined, jobId: string): { facts: SiteDoorFacts; at: number } | null {
  const row = parseKept(raw)[jobId]
  return row ? { facts: { boxes: row.n, due: row.due ?? 0, stickers: row.stickers ?? 0 }, at: row.at } : null
}

/** The kept text with one job's facts set, the oldest dropped past `SITE_BOX_COUNT_KEPT`. */
export function keepSiteDoorFacts(raw: string | null | undefined, jobId: string, facts: SiteDoorFacts, at: number): string {
  const kept = parseKept(raw)
  kept[jobId] = { n: Math.max(0, Math.floor(facts.boxes)), due: Math.max(0, Math.floor(facts.due)), stickers: Math.max(0, Math.floor(facts.stickers)), at }
  const newest = Object.entries(kept)
    .sort((a, b) => b[1].at - a[1].at)
    .slice(0, SITE_BOX_COUNT_KEPT)
  return JSON.stringify(Object.fromEntries(newest))
}

/** Whether kept facts are due another read. */
export function siteBoxCountIsStale(at: number | null | undefined, now: number): boolean {
  return at == null || now - at >= SITE_BOX_COUNT_FRESH_MS
}
