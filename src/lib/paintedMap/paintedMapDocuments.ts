/**
 * A job's painted maps as the Documents tab lists them, and every map as the Documents page's
 * Painted maps tab lists them (punch list #345). Pure.
 *
 * A painted map is not a document: it is live, and a place added next week is on it next week. So
 * the Documents tab does not store a map. It lists the job's maps, each a door to the map as it is
 * now, so the office finds them where it looks for everything else about a job. A copy that went
 * out, a print or a PDF, is already filed under *Sent from this job* with its day.
 *
 * The list is the one under the job's address (`mapsForJob`): the job's own maps first, then its
 * development's, each newest first.
 */
import { mapSummaryWords, mapsForJob, paintedByWords, type PaintedLine, type PaintedMap, type PaintedPlace } from './paintedMap'

type WholeMap = { map: PaintedMap; lines: ReadonlyArray<Pick<PaintedLine, 'lengthM' | 'measuredFt'>>; places: ReadonlyArray<Pick<PaintedPlace, 'id'>> }

/** One painted map as a row of the Documents tab. */
export type PaintedMapDocumentRow = {
  id: string
  name: string
  /** `about 830 ft · 3 places · Painted by Dana on Nov 13.` A map with nothing on it says so. */
  detail: string
  /** `from Dry Creek Ridge`: the map is the development's and shows on each of its jobs. Null for the job's own. */
  from: string | null
}

export const PAINTED_MAP_DOCUMENT_WORDS = {
  heading: 'Painted maps',
  paint: 'Paint a map',
  loading: 'Loading…',
  /** The empty state's first words. The press that follows starts a map. */
  none: 'No painted map is on this job.',
  noneTail: 'starts the first.',
  /** A map with no line and no place yet. */
  empty: 'nothing on it yet',
  failedLead: 'The painted maps did not load:',
  retry: 'Try again',
  /** Under the list, for whoever can read sent copies: where the fixed copies are. */
  copies: 'A map here is the map as it is now. A copy printed or saved as a PDF is under Sent from this job, with the day it was made.',
  /** The same, for whoever cannot read sent copies. */
  live: 'A map here is the map as it is now.',
} as const

/**
 * The rows for a job: its own maps, then its development's. `nameOf` gives a painter's name and
 * `dayOf` the day in the app's words; either may come back empty and the row reads without it.
 */
export function paintedMapDocumentRows(
  wholes: ReadonlyArray<WholeMap>,
  jobId: string,
  developmentId: string | null,
  developmentLabel: string | null,
  nameOf: (userId: string | null) => string | null,
  dayOf: (iso: string) => string | null,
): PaintedMapDocumentRow[] {
  const byId = new Map(wholes.map((w) => [w.map.id, w]))
  return mapsForJob(
    wholes.map((w) => w.map),
    jobId,
    developmentId,
  ).map((m) => {
    const whole = byId.get(m.id)
    const summary = whole ? mapSummaryWords(whole.lines, whole.places.length) : ''
    const by = paintedByWords(nameOf(m.createdBy), dayOf(m.createdAt))
    return {
      id: m.id,
      name: m.name,
      detail: [summary || PAINTED_MAP_DOCUMENT_WORDS.empty, by].filter(Boolean).join(' · '),
      from: m.fromDevelopment ? `from ${(developmentLabel ?? '').trim() || 'the development'}` : null,
    }
  })
}

/** A map's home as the search read tells it: in words, where the reader can see the home. */
type MapHome = { id: string; jobLabel: string | null; developmentLabel: string | null }

/** One painted map as a row of the Documents page's Painted maps tab. */
export type PaintedMapLibraryRow = {
  id: string
  name: string
  /** `J523 · Mission Flats`, `Dry Creek Ridge, every lot`, `On a job` or `On no job yet`. */
  where: string
  /** `about 830 ft · 3 places`, or that nothing is on it yet. */
  holds: string
  /** `Painted by Dana on Nov 13.` Null when neither is known. */
  painted: string | null
  /** The map's own words, for the find box and a second line under the name. */
  words: string
}

export const PAINTED_MAP_LIBRARY_WORDS = {
  heading: 'Painted maps',
  lead: 'Every painted map you can open, newest first. A map here is the map as it is now.',
  paint: 'Paint a map',
  find: 'Find a map by its name, its job or its words',
  loading: 'Loading…',
  none: 'No painted map yet.',
  noneTail: 'starts the first.',
  clear: 'Clear the search',
  failedLead: 'The painted maps did not load:',
  retry: 'Try again',
  noJob: 'On no job yet',
  /** The map is on a job or a site the reader cannot see by name. */
  aJob: 'On a job',
  columns: { map: 'Map', where: 'Where', holds: 'On it', painted: 'Painted' },
} as const

/**
 * Every map the reader can open, in the order the read gave them (newest first). `homes` is the
 * search's read of each map's home in words; a map it lacks still lists, with what its row knows.
 */
export function paintedMapLibraryRows(
  wholes: ReadonlyArray<WholeMap>,
  homes: ReadonlyArray<MapHome>,
  nameOf: (userId: string | null) => string | null,
  dayOf: (iso: string) => string | null,
): PaintedMapLibraryRow[] {
  const homeOf = new Map(homes.map((h) => [h.id, h]))
  return wholes.map((w) => {
    const home = homeOf.get(w.map.id)
    const site = (home?.developmentLabel ?? '').trim()
    const where = (home?.jobLabel ?? '').trim() || (site ? `${site}, every lot` : w.map.jobId || w.map.developmentId ? PAINTED_MAP_LIBRARY_WORDS.aJob : PAINTED_MAP_LIBRARY_WORDS.noJob)
    return {
      id: w.map.id,
      name: w.map.name,
      where,
      holds: mapSummaryWords(w.lines, w.places.length) || PAINTED_MAP_DOCUMENT_WORDS.empty,
      painted: paintedByWords(nameOf(w.map.createdBy), dayOf(w.map.createdAt)),
      words: (w.map.words ?? '').trim(),
    }
  })
}

/** The rows a search holds: every word typed must be in the map's name, its home, its words or its painter. */
export function findPaintedMapLibrary(rows: ReadonlyArray<PaintedMapLibraryRow>, find: string): PaintedMapLibraryRow[] {
  const asked = find.toLowerCase().split(/\s+/).filter(Boolean)
  if (asked.length === 0) return [...rows]
  return rows.filter((r) => {
    const hay = [r.name, r.where, r.words, r.painted ?? ''].join(' ').toLowerCase()
    return asked.every((word) => hay.includes(word))
  })
}

/** `12 painted maps`, `3 of 12 painted maps`, and that only the newest are listed at the read's cap. */
export function paintedMapLibraryCountWords(shown: number, all: number, max: number): string {
  const noun = `painted map${all === 1 ? '' : 's'}`
  const count = shown === all ? `${all} ${noun}` : `${shown} of ${all} ${noun}`
  return all >= max ? `${count}. Only the newest ${max} are listed.` : count
}

/** `Nothing matches “gate”.` The search's empty state. */
export function paintedMapLibraryNoMatchWords(find: string): string {
  return `Nothing matches “${find.trim()}”.`
}
