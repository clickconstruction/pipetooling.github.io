/**
 * Materials on site (punch list #209): the manifest a crew laminates and hangs on a cage, a box or
 * a pallet. One Letter page per container: the job and the site, the stencil, the day the manifest
 * was printed, the day something was last recorded in the container, every item with its number as
 * the ledger reads it, and ruled lines at the foot for what is added on site by hand. The owner's
 * ask of 2026-11-02: a paper that formalises what is on site, in a document holder on the container.
 *
 * Pure rules only. The print is `components/materials/ManifestPrintModal.tsx`; the office page's
 * **Print the manifest** opens it, and the phone links to it through `?manifest=<container id>`.
 */
import { countedLabel } from '../batchWords'
import { calendarYmdInAppTzFromIso, referenceDateForWorkDateYmd } from '../../utils/dateUtils'
import { boxCode } from './labels'
import { compareLabels, type Container, type ContainerLine, type Movement, type Place } from './onSite'

/** Which containers print: every live one, or the ids picked. */
export type ManifestPick = 'all' | ReadonlyArray<string>

/** A page always carries at least this many ruled lines for the pen. */
export const MANIFEST_BLANK_ROWS = 6
/** Items and ruled lines together fill at least this many rows, so a near-empty box still gives a page of lines. 11 fills a Letter sheet at full size under the header with the foot still on it: an empty box's page lays out about 905px of the sheet's 960, room for a job name that wraps once more (measured 2026-11-03, v2.6432, once the print stopped shrinking). */
export const MANIFEST_MIN_ROWS = 11

/** The columns over the ruled lines, as the header reads them. */
export const MANIFEST_ADDED_COLUMNS = ['Item', 'Qty', 'Who', 'Date'] as const
export const MANIFEST_ADDED_HEADER = 'Added on site'

export type ManifestItem = { partName: string; manufacturer: string | null; onHand: number }

export type ManifestPage = {
  containerId: string
  /** The eight-character code the label's QR carries, so the paper and the label name the same box. */
  code: string
  /** The stencil: A1, B7. */
  stencil: string
  kind: 'cage' | 'box' | 'pile'
  /** The place on site, or '' when nobody said. */
  place: string
  where: string
  job: string
  site: string
  /** The app calendar's day the manifest was printed, YYYY-MM-DD. */
  printedOn: string
  /** The app calendar's day something was last recorded in this container, or null when nothing ever was. */
  lastRecordedOn: string | null
  lastRecordedBy: string | null
  items: ManifestItem[]
  blankRows: number
}

export type ManifestInput = {
  containers: ReadonlyArray<Container>
  pick: ManifestPick
  lines: ReadonlyArray<ContainerLine>
  movements: ReadonlyArray<Movement>
  places: ReadonlyArray<Pick<Place, 'id' | 'name'>>
  job: string
  site: string
  now: Date
}

/** The containers a manifest can hang on: live, not the job's Unsorted row, in stencil order; narrowed to the pick. */
export function manifestContainers(containers: ReadonlyArray<Container>, pick: ManifestPick): Container[] {
  const live = containers.filter((c) => !c.retiredAt && c.kind !== 'unsorted')
  const picked = pick === 'all' ? live : live.filter((c) => pick.includes(c.id))
  return [...picked].sort((a, b) => compareLabels(a.label, b.label))
}

/** The newest row that touched a container on either side, or null when none has. */
export function lastRecorded(movements: ReadonlyArray<Movement>, containerId: string): { at: string; byName: string } | null {
  let best: Movement | null = null
  for (const m of movements) {
    if (m.fromContainerId !== containerId && m.toContainerId !== containerId) continue
    if (!best || m.at > best.at) best = m
  }
  return best ? { at: best.at, byName: best.byName } : null
}

/** What is in the container as the ledger reads it: the lines with something on hand, in name order. */
export function manifestItems(lines: ReadonlyArray<ContainerLine>, containerId: string): ManifestItem[] {
  return lines
    .filter((l) => l.containerId === containerId && l.onHand > 0)
    .map((l) => ({ partName: l.partName, manufacturer: l.manufacturer, onHand: l.onHand }))
    .sort((a, b) => a.partName.localeCompare(b.partName))
}

/** How many ruled lines a page gets under `n` items: at least `MANIFEST_BLANK_ROWS`, and enough to reach `MANIFEST_MIN_ROWS`. */
export function manifestBlankRows(n: number): number {
  return Math.max(MANIFEST_BLANK_ROWS, MANIFEST_MIN_ROWS - n)
}

/** One page per container picked, in stencil order. */
export function manifestPages({ containers, pick, lines, movements, places, job, site, now }: ManifestInput): ManifestPage[] {
  const printedOn = calendarYmdInAppTzFromIso(now.toISOString())
  return manifestContainers(containers, pick).map((c) => {
    const items = manifestItems(lines, c.id)
    const last = lastRecorded(movements, c.id)
    return {
      containerId: c.id,
      code: boxCode(c.id),
      stencil: c.label,
      kind: c.kind === 'box' ? 'box' : c.kind === 'cage' ? 'cage' : 'pile',
      place: places.find((p) => p.id === c.locationId)?.name ?? '',
      where: c.where,
      job,
      site,
      printedOn,
      lastRecordedOn: last ? calendarYmdInAppTzFromIso(last.at) : null,
      lastRecordedBy: last?.byName || null,
      items,
      blankRows: manifestBlankRows(items.length),
    }
  })
}

/** A calendar day as the paper reads it: `2026-11-02` → *November 2, 2026*. */
export function manifestDateWords(ymd: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return ymd
  return referenceDateForWorkDateYmd(ymd).toLocaleDateString('en-US', { timeZone: 'UTC', month: 'long', day: 'numeric', year: 'numeric' })
}

/** The line under *Last recorded*: the day and who, or the words for a container nothing was ever put in. */
export function lastRecordedWords(page: Pick<ManifestPage, 'lastRecordedOn' | 'lastRecordedBy'>): string {
  if (!page.lastRecordedOn) return 'Nothing recorded yet'
  return page.lastRecordedBy ? `${manifestDateWords(page.lastRecordedOn)} by ${page.lastRecordedBy}` : manifestDateWords(page.lastRecordedOn)
}

/** The press names its count: *Print 1 manifest*, *Print 4 manifests*; *Print manifests* at zero, when the press is dead. */
export function manifestPressWords(n: number): string {
  return countedLabel('Print', n, 'manifest')
}

/** The line under the picker: which boxes the press prints. */
export function manifestPickWords(picked: number, total: number): string {
  if (total === 0) return 'This job has no cage or box yet.'
  if (picked === 0) return 'Pick a box to print.'
  if (picked === total) return total === 1 ? 'The one box on this job, one page.' : `Every box on this job, ${total} pages, one a box.`
  return `${picked} of ${total} boxes, one page each.`
}
