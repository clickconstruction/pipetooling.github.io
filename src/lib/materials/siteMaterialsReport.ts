/**
 * The material location report (punch list #268): one Letter paper of what is in every cage and box
 * across a development's jobs, as the Materials on site ledger (#209) reads it. The owner, looking
 * at Gun Dog on 2026-11-04: *the ability to print a report that shows what materials are at all the
 * different locations … It needs to be able to be printed to pdf.*
 *
 * The rows are the ledger's own: a job's places, its live containers and its movements, summed by
 * `containerLines` (a count resets a line; on hand is the sum). The fold happens once; the paper is
 * then read two ways, by job (a job's section, its places, its cages and boxes, its Unsorted pile,
 * its boxes with no place yet) or by location (one section per place name across the jobs, then
 * Unsorted and No place yet by job), and the reader switches between them at leisure (the owner's
 * word on the mock-up). A retired container is on no paper. A job with nothing on site is one line in
 * the closing block, so the material reads first.
 *
 * Pure rules only. The read is `siteMaterialsRead.ts`, the paper
 * `components/materials/SiteMaterialsReportModal.tsx`, the door the Development page's Jobs & bids look.
 */
import { calendarYmdInAppTzFromIso, formatDenverCalendarDayShort, referenceDateForWorkDateYmd } from '../../utils/dateUtils'
import { pluralNoun } from '../batchWords'
import { manifestDateWords } from './containerManifest'
import { boxCode } from './labels'
import { UNITS } from './manifest'
import { compareLabels, containerLines, partKey, type Container, type Movement, type Place } from './onSite'
import { rollKey } from './siteRollup'

/** The two ways the paper is read. */
export type ReportView = 'job' | 'location' | 'part'
export const REPORT_VIEWS: ReadonlyArray<{ key: ReportView; label: string; title: string }> = [
  { key: 'job', label: 'By job', title: 'Each job, its places, and the cages and boxes at each' },
  { key: 'location', label: 'By location', title: 'Each place across the jobs, with every job’s cages and boxes at it' },
  { key: 'part', label: 'By part', title: 'Each part across the site’s jobs, with its total and the cages and boxes that hold it' },
]

export type ReportJobInput = { id: string; label: string; name: string }
export type ReportSiteInput = { name: string; customer: string | null; address: string | null }
/** The ledger's rows over the site's jobs, as `siteMaterialsRead.ts` hands them in. */
export type SiteMaterialsRows = { places: ReadonlyArray<Place>; containers: ReadonlyArray<Container>; movements: ReadonlyArray<Movement> }
export type SiteMaterialsReportInput = { site: ReportSiteInput; jobs: ReadonlyArray<ReportJobInput>; rows: SiteMaterialsRows; now: Date; printedBy: string | null }

export type ReportLine = {
  partKey: string
  partName: string
  manufacturer: string | null
  onHand: number
  /** The unit the delivery named ("ea", "roll"), or null when the part was added on site with none. */
  unit: string | null
  /** When something was last recorded on this line, ISO, and by whom. */
  lastRecordedAt: string | null
  lastRecordedBy: string | null
}

export type ReportBox = {
  containerId: string
  /** The eight-character code the label and the manifest carry; '' for Unsorted. */
  code: string
  stencil: string
  kind: 'cage' | 'box' | 'pile' | 'unsorted'
  where: string
  jobId: string
  jobLabel: string
  jobName: string
  placeId: string | null
  placeName: string | null
  /** The lines with something on hand, in name order; empty for an empty box. */
  lines: ReportLine[]
}

export type ReportJob = { jobId: string; label: string; name: string; boxes: ReportBox[]; places: Place[]; linesOnHand: number }
export type NothingLine = { jobId: string; label: string; name: string; words: string }
export type ReportCounts = { jobs: number; withMaterial: number; places: number; boxes: number; lines: number }

export type SiteMaterialsReport = {
  site: ReportSiteInput
  /** The app calendar's day the report was printed, YYYY-MM-DD. */
  printedOn: string
  printedBy: string | null
  /** The jobs with something on hand, in the order given. */
  jobs: ReportJob[]
  /** The jobs with nothing on site, one line each, in the order given. */
  nothing: NothingLine[]
  counts: ReportCounts
}

/** A group of boxes under one heading: a place, Unsorted, No place yet, or a job inside a location. */
export type ReportGroup = { key: string; heading: string; boxes: ReportBox[] }
/** A section of the paper: a job (by job) or a place name (by location), with its groups. */
export type ReportSection = { key: string; title: string; meta: string; groups: ReportGroup[] }

export const UNSORTED_HEADING = 'Unsorted'
export const UNSORTED_WORDS = 'Unsorted · delivered, not yet put away'
export const NO_PLACE_HEADING = 'No place yet'
export const EMPTY_BOX_WORDS = 'Empty'
export const NOTHING_ON_SITE_WORDS = 'Nothing on site yet. A job’s Materials page is where a cage or box is added, and the crew’s phone is where parts are counted into it.'
export const LEDGER_FOOT_WORDS = 'Read from the Materials on site ledger, every press on the phone and in the office summed to what is on hand.'

const unitWords = new Set(UNITS.map((u) => u.toLowerCase()))

/** The unit the newest delivery of a part on a job named, lower-cased, or null: the office writes the invoice's unit on the row, the phone writes *added on site*. */
export function unitOfPart(movements: ReadonlyArray<Movement>, jobId: string, key: string): string | null {
  let best: Movement | null = null
  for (const m of movements) {
    if (m.jobId !== jobId || m.reason !== 'delivered' || partKey(m.partId, m.partName) !== key) continue
    const note = m.note.trim().toLowerCase()
    if (!unitWords.has(note)) continue
    if (!best || m.at > best.at) best = m
  }
  return best ? best.note.trim().toLowerCase() : null
}

const kindOf = (c: Container): ReportBox['kind'] => (c.kind === 'unsorted' ? 'unsorted' : c.kind === 'cage' ? 'cage' : c.kind === 'box' ? 'box' : 'pile')

/** "J1042 · Lodge rough-in", or the name alone when the job has no number yet. */
export function jobWords(job: Pick<ReportJobInput, 'label' | 'name'>): string {
  const label = job.label.trim()
  const name = job.name.trim()
  if (label && name) return `${label} · ${name}`
  return label || name || 'a job with no name'
}

/** "A1 · cage", "T1 · pile", or the Unsorted words. */
export function boxWords(box: Pick<ReportBox, 'stencil' | 'kind'>): string {
  if (box.kind === 'unsorted') return UNSORTED_WORDS
  return `${box.stencil} · ${box.kind}`
}

/** The fold: the ledger over the site's jobs into the report's rows, once. */
export function buildSiteMaterialsReport({ site, jobs, rows, now, printedBy }: SiteMaterialsReportInput): SiteMaterialsReport {
  const live = rows.containers.filter((c) => !c.retiredAt)
  const liveIds = new Set(live.map((c) => c.id))
  const lines = containerLines(rows.movements)
  const linesByContainer = new Map<string, ReportLine[]>()
  for (const l of lines) {
    if (l.onHand <= 0 || !liveIds.has(l.containerId)) continue
    const c = live.find((x) => x.id === l.containerId)!
    const arr = linesByContainer.get(l.containerId) ?? []
    arr.push({ partKey: l.partKey, partName: l.partName, manufacturer: l.manufacturer, onHand: l.onHand, unit: unitOfPart(rows.movements, c.jobId, l.partKey), lastRecordedAt: l.lastTouchedAt, lastRecordedBy: l.lastTouchedBy || null })
    linesByContainer.set(l.containerId, arr)
  }
  for (const arr of linesByContainer.values()) arr.sort((a, b) => a.partName.localeCompare(b.partName) || a.partKey.localeCompare(b.partKey))

  const reportJobs: ReportJob[] = []
  const nothing: NothingLine[] = []
  const placesWithMaterial = new Set<string>()
  let boxCount = 0
  let lineCount = 0
  for (const job of jobs) {
    const jobPlaces = rows.places.filter((p) => p.jobId === job.id)
    const containers = live.filter((c) => c.jobId === job.id)
    const boxes: ReportBox[] = containers.map((c) => {
      const place = c.locationId ? jobPlaces.find((p) => p.id === c.locationId) ?? null : null
      return { containerId: c.id, code: c.kind === 'unsorted' ? '' : boxCode(c.id), stencil: c.label, kind: kindOf(c), where: c.where, jobId: job.id, jobLabel: job.label, jobName: job.name, placeId: place?.id ?? null, placeName: place?.name ?? null, lines: linesByContainer.get(c.id) ?? [] }
    })
    const real = boxes.filter((b) => b.kind !== 'unsorted')
    boxCount += real.length
    const linesOnHand = boxes.reduce((s, b) => s + b.lines.length, 0)
    lineCount += linesOnHand
    if (linesOnHand === 0) {
      nothing.push({ jobId: job.id, label: job.label, name: job.name, words: nothingWords(real) })
      continue
    }
    for (const b of boxes) if (b.placeId && b.lines.length) placesWithMaterial.add(b.placeId)
    const places = jobPlaces.filter((p) => real.some((b) => b.placeId === p.id)).sort((a, b) => compareLabels(a.name, b.name))
    reportJobs.push({ jobId: job.id, label: job.label, name: job.name, boxes, places, linesOnHand })
  }
  return {
    site,
    printedOn: calendarYmdInAppTzFromIso(now.toISOString()),
    printedBy,
    jobs: reportJobs,
    nothing,
    counts: { jobs: jobs.length, withMaterial: reportJobs.length, places: placesWithMaterial.size, boxes: boxCount, lines: lineCount },
  }
}

/** The closing block's words for a job with nothing on site: no box at all, or every box empty, each named with its place. */
export function nothingWords(boxes: ReadonlyArray<Pick<ReportBox, 'stencil' | 'placeName' | 'kind'>>): string {
  const real = boxes.filter((b) => b.kind !== 'unsorted')
  if (real.length === 0) return 'no cages or boxes on this job yet.'
  const names = [...real].sort((a, b) => compareLabels(a.stencil, b.stencil)).map((b) => (b.placeName ? `${b.stencil} at ${b.placeName}` : b.stencil))
  return `${names.join(', ')} ${names.length === 1 ? 'is' : 'are'} empty. Nothing on site.`
}

/** "24 jobs on the site · 1 with material · 1 place · 2 cages and boxes · 1 line on hand" */
export function countsWords(c: ReportCounts): string {
  return [
    `${c.jobs} ${pluralNoun('job', c.jobs)} on the site`,
    `${c.withMaterial} with material`,
    `${c.places} ${pluralNoun('place', c.places)}`,
    `${c.boxes} ${c.boxes === 1 ? 'cage or box' : 'cages and boxes'}`,
    `${c.lines} ${pluralNoun('line', c.lines)} on hand`,
  ].join(' · ')
}

/** The foot on every page: the ledger named, the day and who printed. */
export function footWords(report: Pick<SiteMaterialsReport, 'printedOn' | 'printedBy'>): string {
  return `${LEDGER_FOOT_WORDS} Printed ${manifestDateWords(report.printedOn)}${report.printedBy ? ` by ${report.printedBy}` : ''}.`
}

/** "Nov 2 · Jordan"; the year is added when it is not the printed day's. "—" when nothing was ever recorded. */
export function lastRecordedWords(line: Pick<ReportLine, 'lastRecordedAt' | 'lastRecordedBy'>, printedOn: string): string {
  if (!line.lastRecordedAt) return '—'
  const ymd = calendarYmdInAppTzFromIso(line.lastRecordedAt)
  const ms = referenceDateForWorkDateYmd(ymd).getTime()
  const sameYear = ymd.slice(0, 4) === printedOn.slice(0, 4)
  const day = sameYear ? formatDenverCalendarDayShort(ms) : new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(ms))
  return line.lastRecordedBy ? `${day} · ${line.lastRecordedBy}` : day
}

function byStencil(a: ReportBox, b: ReportBox): number {
  return compareLabels(a.stencil, b.stencil)
}

const boxesNoun = (n: number) => `${n} ${n === 1 ? 'cage or box' : 'cages and boxes'}`

/** The paper read by job: a section per job with material, its places in name order, then Unsorted when it holds anything, then No place yet. */
function sectionsByJob(report: SiteMaterialsReport): ReportSection[] {
  return report.jobs.map((job) => {
    const groups: ReportGroup[] = []
    for (const p of job.places) {
      groups.push({ key: `place:${p.id}`, heading: p.name, boxes: job.boxes.filter((b) => b.placeId === p.id && b.kind !== 'unsorted').sort(byStencil) })
    }
    const unsorted = job.boxes.filter((b) => b.kind === 'unsorted' && b.lines.length > 0)
    if (unsorted.length) groups.push({ key: 'unsorted', heading: UNSORTED_HEADING, boxes: unsorted })
    const none = job.boxes.filter((b) => !b.placeId && b.kind !== 'unsorted').sort(byStencil)
    if (none.length) groups.push({ key: 'no-place', heading: NO_PLACE_HEADING, boxes: none })
    const real = job.boxes.filter((b) => b.kind !== 'unsorted').length
    return {
      key: `job:${job.jobId}`,
      title: jobWords(job),
      meta: `${job.places.length} ${pluralNoun('place', job.places.length)} · ${boxesNoun(real)} · ${job.linesOnHand} ${pluralNoun('line', job.linesOnHand)} on hand`,
      groups,
    }
  })
}

const foldName = (name: string) => name.trim().toLowerCase().replace(/\s+/g, ' ')

/** The paper read by location: a section per place name across the jobs (the same name on two jobs folds to one), a group per job under it; then Unsorted by job, then No place yet by job. */
function sectionsByLocation(report: SiteMaterialsReport): ReportSection[] {
  const placed = new Map<string, { name: string; boxes: ReportBox[] }>()
  for (const job of report.jobs) {
    for (const b of job.boxes) {
      if (!b.placeId || !b.placeName || b.kind === 'unsorted') continue
      const k = foldName(b.placeName)
      const have = placed.get(k)
      if (have) have.boxes.push(b)
      else placed.set(k, { name: b.placeName, boxes: [b] })
    }
  }
  const groupsByJob = (boxes: ReportBox[]): ReportGroup[] => {
    const out: ReportGroup[] = []
    for (const job of report.jobs) {
      const mine = boxes.filter((b) => b.jobId === job.jobId).sort(byStencil)
      if (mine.length) out.push({ key: `job:${job.jobId}`, heading: jobWords(job), boxes: mine })
    }
    return out
  }
  const sections: ReportSection[] = [...placed.values()]
    .sort((a, b) => compareLabels(a.name, b.name))
    .map((p) => {
      const jobs = new Set(p.boxes.map((b) => b.jobId)).size
      return { key: `place:${foldName(p.name)}`, title: p.name, meta: `${jobs === 1 ? 'one job' : `${jobs} jobs each name a place ${p.name}`} · ${boxesNoun(p.boxes.length)}`, groups: groupsByJob(p.boxes) }
    })
  const unsorted = report.jobs.flatMap((j) => j.boxes.filter((b) => b.kind === 'unsorted' && b.lines.length > 0))
  if (unsorted.length) sections.push({ key: 'unsorted', title: `${UNSORTED_HEADING}, by job`, meta: 'delivered, not yet put away', groups: groupsByJob(unsorted) })
  const none = report.jobs.flatMap((j) => j.boxes.filter((b) => !b.placeId && b.kind !== 'unsorted'))
  if (none.length) sections.push({ key: 'no-place', title: NO_PLACE_HEADING, meta: 'boxes nobody has placed, by job', groups: groupsByJob(none) })
  return sections
}

/** The paper's sections for a view, from the one fold. By part has none: it is one list (`reportPartRows`). */
export function reportSections(report: SiteMaterialsReport, view: ReportView): ReportSection[] {
  return view === 'job' ? sectionsByJob(report) : view === 'location' ? sectionsByLocation(report) : []
}

/** One row of the paper read by part (punch list #330): a part across the site's jobs, its total and where it is. */
export type ReportPartRow = {
  key: string
  name: string
  total: number
  /** The unit every line of the row names, or null when they name none or differ. */
  unit: string | null
  /** The spellings folded into the row, most pieces first; one when nothing folded. */
  spellings: string[]
  /** The cages and boxes that hold it, most pieces first. */
  holds: Array<{ containerId: string; stencil: string; jobLabel: string; placeName: string | null; onHand: number }>
}

/**
 * The paper by part, from the one fold: one row per part across the site's jobs, the same rows the
 * site's screen draws (`rollKey`, the same-words fold; `canon` joins the names a person joined,
 * `bookNames` names a parts-book row whose lines were all typed). Each box's line keeps its own
 * count; a row adds lines. By name as people read it.
 */
export function reportPartRows(report: SiteMaterialsReport, canon: (key: string) => string = (key) => key, bookNames: ReadonlyMap<string, string> = new Map()): ReportPartRow[] {
  const rows = new Map<string, { row: ReportPartRow; spell: Map<string, number>; units: Set<string>; book: string | null }>()
  for (const job of report.jobs) {
    for (const box of job.boxes) {
      for (const line of box.lines) {
        const partId = line.partKey.startsWith('id:') ? line.partKey.slice('id:'.length) : null
        const key = canon(rollKey({ partId, partName: line.partName }))
        let a = rows.get(key)
        if (!a) {
          a = { row: { key, name: line.partName, total: 0, unit: null, spellings: [], holds: [] }, spell: new Map(), units: new Set(), book: null }
          rows.set(key, a)
        }
        a.row.total += line.onHand
        a.spell.set(line.partName, (a.spell.get(line.partName) ?? 0) + line.onHand)
        a.units.add(line.unit ?? '')
        if (partId && !a.book) a.book = line.partName
        a.row.holds.push({ containerId: box.containerId, stencil: box.kind === 'unsorted' ? UNSORTED_HEADING : box.stencil, jobLabel: box.jobLabel, placeName: box.placeName, onHand: line.onHand })
      }
    }
  }
  const out: ReportPartRow[] = []
  for (const a of rows.values()) {
    const spellings = [...a.spell.entries()].sort((x, y) => y[1] - x[1] || x[0].localeCompare(y[0])).map(([name]) => name)
    a.row.spellings = spellings
    a.row.name = a.book ?? bookNames.get(a.row.key) ?? spellings[0] ?? a.row.name
    a.row.unit = a.units.size === 1 ? [...a.units][0] || null : null
    a.row.holds.sort((x, y) => y.onHand - x.onHand || compareLabels(x.stencil, y.stencil))
    out.push(a.row)
  }
  return out.sort((x, y) => compareLabels(x.name, y.name) || x.key.localeCompare(y.key))
}

/** "104 parts · 1,940 pieces" over the by-part list. */
export function partRowsWords(rows: ReadonlyArray<Pick<ReportPartRow, 'total'>>): string {
  const pieces = rows.reduce((n, r) => n + r.total, 0)
  return `${rows.length.toLocaleString('en-US')} ${pluralNoun('part', rows.length)} · ${pieces.toLocaleString('en-US')} ${pluralNoun('piece', pieces)}`
}

/** The closing block's head: "Nothing on site · 23 jobs". */
export function nothingHeading(n: number): string {
  return `Nothing on site · ${n} ${pluralNoun('job', n)}`
}

/** The line under the window's title. */
export function reportLeadWords(view: ReportView): string {
  if (view === 'part') return 'Every part across the site’s jobs with its total and the cages and boxes that hold it, as the ledger reads it today. Print, then Save as PDF in the print window.'
  return view === 'job'
    ? 'What is in every cage and box across the site’s jobs, by job and place, as the ledger reads it today. Print, then Save as PDF in the print window.'
    : 'What is in every cage and box across the site’s jobs, by place with each job under it, as the ledger reads it today. Print, then Save as PDF in the print window.'
}
