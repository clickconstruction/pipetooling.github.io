/**
 * A job's painted maps as the Documents tab lists them (punch list #345). Pure.
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
  /** A row's press: the map's Share sheet, without opening the map. */
  share: 'Share',
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
