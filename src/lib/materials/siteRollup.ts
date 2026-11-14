/**
 * A site's materials on one screen (punch list #330): every part across the jobs of one site, with
 * its total and the boxes that hold it, and the figures a manager reads first. A site is a
 * development's jobs (#208); every box still belongs to one job, and nothing here changes that.
 *
 * The fold is a reading of the FINISHED lines, never of the ledger. `containerLines` sums each
 * spelling in each box on its own, because a count resets its line: two spellings made one key
 * before the sums would let one count wipe the other's pieces and report them missing. So each
 * line keeps its own number and its own count, and a row here adds lines.
 *
 * Two names are one row only when their words are the same (`sameWordsKey`): case, spaces,
 * punctuation, the inch mark written as a word or a curly quote, word order and a plural. A name
 * never folds by closeness: on the first site read, dozens of pairs two letters apart differed
 * only in a size.
 *
 * Pure rules only. The screen is `components/materials/SiteMaterialsView.tsx`; the rows come from
 * the on-site store, which the desk has already read.
 */
import { compareLabels, countIsDue, daysSince, STALE_COUNT_DAYS, UNSORTED_LABEL, type Container, type ContainerLine, type Movement, type Place } from './onSite'

/** One job of the site as the store holds it: its boxes, its places and its lines as `containerLines` reads them. */
export type SiteRollupJob = {
  jobId: string
  /** How the job reads in a row: its number and name. */
  label: string
  containers: ReadonlyArray<Container>
  places: ReadonlyArray<Place>
  lines: ReadonlyArray<ContainerLine>
}

/** One box that holds some of a part. */
export type SiteBoxHold = {
  containerId: string
  /** The stencil, or Unsorted. */
  label: string
  jobId: string
  jobLabel: string
  /** The place the box stands in; empty when nobody said. */
  placeName: string
  /** The name this box's line was typed under. */
  spelling: string
  /** The line's own key in the ledger (`partKey`): what a price typed off an invoice is kept under. */
  partKey: string
  onHand: number
  /** When this line was last counted in this box; null when never. */
  lineCountedAt: string | null
  /** The box is due a count by the 14-day rule. Never true for Unsorted. */
  due: boolean
  /** Pieces pressed Can't find since the line's last count. */
  cannotFind: number
  /** Pieces short at the line's last count; 0 when it counted right or over. */
  short: number
}

/** One row of the roll-up: a part across the site's jobs. */
export type SitePartRow = {
  key: string
  /** The name the row reads by: the parts book's, or the spelling with the most pieces. */
  name: string
  partId: string | null
  manufacturer: string | null
  /** Every spelling folded into the row, most pieces first; one entry when nothing folded. */
  spellings: Array<{ name: string; pieces: number }>
  total: number
  /** The boxes that hold it, most pieces first. */
  boxes: SiteBoxHold[]
  cannotFind: number
  short: number
  /** A box that holds it is due a count. */
  due: boolean
  /** The newest count of any of its lines; null when none was ever counted. */
  countedAt: string | null
  /** The same-words keys folded into the row: one unless a person joined names (`partTies.ts`). */
  memberKeys: string[]
}

const INCH = '"'
/** Stands between two sizes of one fitting (3x4, 1/2 x 3/8) so the word-order fold never swaps them. */
const BY = '×'

/** A plural as a crew types it: tees, couplings, boxes. Never a short word or one that ends in ss. */
function singular(word: string): string {
  if (!/^[a-z]+$/.test(word) || word.length < 4) return word
  if (/(xes|ches|shes|sses)$/.test(word)) return word.slice(0, -2)
  if (word.endsWith('s') && !word.endsWith('ss')) return word.slice(0, -1)
  return word
}

/** The words that say a fitting has two ends, each with its own size: `1/2 pex x 3/4 mip`, `4" to 2" reducer`, `3 by 4`. */
const TWO_ENDS = new Set(['x', BY, 'by', 'to'])

/**
 * The same-words fold of a typed name: the words that make it, in one order. `2" 90 PVC`,
 * `2 inch 90 pvc`, `PVC 2”90` and `2inch 90s pvc` are one key; `3" 90 pvc` is another, and so is
 * `2" 90` with no material named. A bare `2` is never read as `2"`: that would be a guess.
 *
 * Two things keep their place (v2.7249, punch list #344 PR 7). **A fitting with two ends keeps the order it was
 * typed in.** Sorting the words made `1/2 pex x 3/4 mip adapter` and `3/4 pex x 1/2 mip adapter` one key, and
 * `4" to 2" reducer` and `2" to 4"`: the `×` guard only held when the `x` sat right between two numbers. A name that
 * holds `x`, `by` or `to` as a word is now folded word for word and never sorted, so the same fitting typed in
 * another order is two rows a person may join, never two fittings in one row. Two sizes glued by the `×` (`3x4`,
 * `1/2 x 3/8`) were always one word and still sort with the rest. **A decimal keeps its point.** The punctuation
 * sweep turned `.5"` into `5"` and `1.5` into `1 5`; a point that leads or sits inside a number stays, and `0.5`
 * reads as `.5`. A point after a letter (`no.4`) is still punctuation.
 */
export function sameWordsKey(name: string): string {
  let s = name.toLowerCase()
  s = s.replace(/[“”″]/g, INCH).replace(/[‘’′]/g, "'")
  // The inch mark as a word, glued to its digit or not: 2 inch, 2inch, 4in, 4 in.
  s = s.replace(/(\d)\s*(?:inches|inch|in\.?)(?![a-z])/g, `$1${INCH}`)
  s = s.replace(/(\d)\s+"/g, `$1${INCH}`)
  // A plural glued to a number: 90s.
  s = s.replace(/(\d)s(?![a-z])/g, '$1')
  // Two sizes of one fitting stay in the order typed: 3x4, 3 x 4, 1/2 X 3/8.
  s = s.replace(/(\d"?)\s*x\s*(?=\d)/g, `$1${BY}`)
  // A mixed number: 1-1/2 and 1 1/2.
  s = s.replace(/(\d)-(?=\d+\/\d)/g, '$1 ')
  // A point that leads or sits inside a number is the number's own; any other is punctuation.
  s = s.replace(/\.(?!\d)/g, ' ').replace(/([a-z"])\.(?=\d)/g, '$1 ').replace(/(^|[^\d.])0\.(?=\d)/g, '$1.')
  s = s.replace(/[,;:()[\]!?*#]/g, ' ').replace(/-/g, ' ')
  // A size glued to its word, either way round: 2"90, 3/4tees, pex3/4.
  s = s.replace(/"(?=[^\s×])/g, `${INCH} `).replace(/(\d)(?=[a-z])/g, '$1 ').replace(/([a-z])(?=\d)/g, '$1 ')
  const words = s.split(/\s+/).filter(Boolean).map(singular)
  // Two ends, two sizes: the order is part of what the fitting is.
  if (words.some((w) => TWO_ENDS.has(w))) return words.join(' ')
  return words.sort().join(' ')
}

/** The row a line belongs to: the parts book's id, or the typed name's same-words fold. */
export function rollKey(line: Pick<ContainerLine, 'partId' | 'partName'>): string {
  return line.partId ? `id:${line.partId}` : `words:${sameWordsKey(line.partName)}`
}

/** A line a manager should see: something on hand, a Can't find since its count, or a shortfall at its count (the crew's own rule, `linesOf`). */
function shown(l: ContainerLine): boolean {
  return l.onHand > 0 || l.cannotFindSinceCount > 0 || (l.lastCountDiff ?? 0) < 0
}

/** When each box was last counted: the newest count of any line in it. */
export function boxCountedAt(lines: ReadonlyArray<ContainerLine>): Map<string, string> {
  const out = new Map<string, string>()
  for (const l of lines) {
    if (!l.lastCountAt) continue
    const cur = out.get(l.containerId)
    if (!cur || l.lastCountAt > cur) out.set(l.containerId, l.lastCountAt)
  }
  return out
}

function liveBoxes(job: SiteRollupJob): Container[] {
  return job.containers.filter((c) => !c.retiredAt)
}

function placeOf(job: SiteRollupJob, c: Container): string {
  if (!c.locationId) return ''
  return job.places.find((p) => p.id === c.locationId)?.name ?? ''
}

function boxIsDue(c: Container, countedAt: string | undefined, now: Date): boolean {
  return c.kind !== 'unsorted' && countIsDue(countedAt ? { at: countedAt } : null, now)
}

/**
 * The roll-up: one row per part across the site's jobs, by name as people read it (2" before 10").
 * `canon` maps a same-words key to the row it belongs to once a person has joined names
 * (`tieCanon` in `partTies.ts`); left out, every key is its own row. `bookNames` names a
 * parts-book row that holds no book line of its own: a typed name tied to the book (PR 4).
 */
export function sitePartRows(jobs: ReadonlyArray<SiteRollupJob>, now: Date, canon: (key: string) => string = (key) => key, bookNames: ReadonlyMap<string, string> = new Map()): SitePartRow[] {
  const rows = new Map<string, SitePartRow>()
  /** A row that holds a parts-book line reads by the book's name. */
  const bookName = new Map<string, string>()
  for (const job of jobs) {
    const live = new Map(liveBoxes(job).map((c) => [c.id, c] as const))
    const counted = boxCountedAt(job.lines)
    for (const l of job.lines) {
      const c = live.get(l.containerId)
      if (!c || !shown(l)) continue
      const own = rollKey(l)
      const key = canon(own)
      let row = rows.get(key)
      if (!row) {
        row = { key, name: l.partName, partId: null, manufacturer: l.manufacturer, spellings: [], total: 0, boxes: [], cannotFind: 0, short: 0, due: false, countedAt: null, memberKeys: [] }
        rows.set(key, row)
      }
      if (!row.memberKeys.includes(own)) row.memberKeys.push(own)
      // A row with a parts-book line reads as the book's part, whatever was typed beside it.
      if (l.partId && !row.partId) row.partId = l.partId
      const short = Math.max(0, -(l.lastCountDiff ?? 0))
      const due = boxIsDue(c, counted.get(c.id), now)
      row.boxes.push({ containerId: c.id, label: c.kind === 'unsorted' ? UNSORTED_LABEL : c.label, jobId: job.jobId, jobLabel: job.label, placeName: placeOf(job, c), spelling: l.partName, partKey: l.partKey, onHand: l.onHand, lineCountedAt: l.lastCountAt, due, cannotFind: l.cannotFindSinceCount, short })
      row.total += l.onHand
      row.cannotFind += l.cannotFindSinceCount
      row.short += short
      row.due = row.due || due
      if (l.lastCountAt && (!row.countedAt || l.lastCountAt > row.countedAt)) row.countedAt = l.lastCountAt
      if (!row.manufacturer && l.manufacturer) row.manufacturer = l.manufacturer
      if (l.partId && !bookName.has(key)) bookName.set(key, l.partName)
      const spelling = row.spellings.find((s) => s.name === l.partName)
      if (spelling) spelling.pieces += l.onHand
      else row.spellings.push({ name: l.partName, pieces: l.onHand })
    }
  }
  const out = [...rows.values()]
  for (const row of out) {
    row.spellings.sort((a, b) => b.pieces - a.pieces || a.name.localeCompare(b.name))
    row.name = bookName.get(row.key) ?? bookNames.get(row.key) ?? row.spellings[0]?.name ?? row.name
    // A row keyed on a parts-book part is that part, even when every line under it was typed.
    if (!row.partId && row.key.startsWith('id:')) row.partId = row.key.slice('id:'.length)
    row.memberKeys.sort()
    row.boxes.sort((a, b) => b.onHand - a.onHand || compareLabels(a.label, b.label))
  }
  return out.sort((a, b) => compareLabels(a.name, b.name) || a.key.localeCompare(b.key))
}

/** A box on the by-place reading, with its lines. */
export type SitePlaceBox = {
  containerId: string
  label: string
  kind: Container['kind']
  where: string
  jobId: string
  jobLabel: string
  countedAt: string | null
  due: boolean
  lines: Array<{ partKey: string; name: string; onHand: number; cannotFind: number; short: number }>
}

/** A place across the site's jobs: the same name on two jobs is one section, with the jobs named. */
export type SitePlaceSection = { key: string; name: string; jobLabels: string[]; boxes: SitePlaceBox[]; pieces: number }

export const UNSORTED_SECTION = 'Unsorted'
export const NO_PLACE_SECTION = 'No place yet'

/** The boxes by place: the places in name order (folded by name across jobs), then Unsorted, then the boxes with no place. */
export function sitePlaceSections(jobs: ReadonlyArray<SiteRollupJob>, now: Date): SitePlaceSection[] {
  const sections = new Map<string, SitePlaceSection>()
  const section = (key: string, name: string): SitePlaceSection => {
    let s = sections.get(key)
    if (!s) {
      s = { key, name, jobLabels: [], boxes: [], pieces: 0 }
      sections.set(key, s)
    }
    return s
  }
  for (const job of jobs) {
    const counted = boxCountedAt(job.lines)
    for (const c of liveBoxes(job)) {
      const lines = job.lines.filter((l) => l.containerId === c.id && shown(l)).map((l) => ({ partKey: l.partKey, name: l.partName, onHand: l.onHand, cannotFind: l.cannotFindSinceCount, short: Math.max(0, -(l.lastCountDiff ?? 0)) }))
      if (c.kind === 'unsorted' && lines.length === 0) continue
      const place = placeOf(job, c)
      const s = c.kind === 'unsorted' ? section('~unsorted', UNSORTED_SECTION) : place ? section(`place:${place.trim().toLowerCase()}`, place.trim()) : section('~none', NO_PLACE_SECTION)
      if (!s.jobLabels.includes(job.label)) s.jobLabels.push(job.label)
      s.boxes.push({ containerId: c.id, label: c.kind === 'unsorted' ? UNSORTED_LABEL : c.label, kind: c.kind, where: c.where, jobId: job.jobId, jobLabel: job.label, countedAt: counted.get(c.id) ?? null, due: boxIsDue(c, counted.get(c.id), now), lines })
      s.pieces += lines.reduce((n, l) => n + l.onHand, 0)
    }
  }
  const out = [...sections.values()]
  for (const s of out) s.boxes.sort((a, b) => compareLabels(a.label, b.label) || a.jobLabel.localeCompare(b.jobLabel))
  const rank = (s: SitePlaceSection) => (s.key === '~unsorted' ? 1 : s.key === '~none' ? 2 : 0)
  return out.sort((a, b) => rank(a) - rank(b) || compareLabels(a.name, b.name))
}

/** A box falls due inside this many days: counted long enough ago that the 14-day rule catches it this week. */
export const DUE_SOON_DAYS = 7
/** The record reads quiet, in amber, when nothing was recorded for this many days. */
export const QUIET_DAYS = 7

export type SiteGlance = {
  /** The newest thing recorded on any line of the site; null when the site has no row. */
  lastRecorded: { at: string; byName: string | null } | null
  /** Whole days since then; null with it. */
  quietDays: number | null
  /** Live cages, boxes and piles; Unsorted is not a box. */
  boxes: number
  jobsWithBoxes: number
  /** Distinct place names across the jobs. */
  places: number
  lines: number
  pieces: number
  dueNow: number
  /** Not due yet, due inside `DUE_SOON_DAYS`. */
  dueSoon: number
  /** Lines with a Can't find since their count. */
  cannotFindLines: number
  /** Lines short at their last count. */
  shortLines: number
}

/** The figures over the list. Every one is a count of the same lines and boxes the list draws. */
export function siteGlance(jobs: ReadonlyArray<SiteRollupJob>, now: Date): SiteGlance {
  let lastRecorded: SiteGlance['lastRecorded'] = null
  let boxes = 0
  let jobsWithBoxes = 0
  let lines = 0
  let pieces = 0
  let dueNow = 0
  let dueSoon = 0
  let cannotFindLines = 0
  let shortLines = 0
  const places = new Set<string>()
  for (const job of jobs) {
    const live = liveBoxes(job)
    const liveIds = new Set(live.map((c) => c.id))
    const counted = boxCountedAt(job.lines)
    const real = live.filter((c) => c.kind !== 'unsorted')
    if (real.length > 0) jobsWithBoxes += 1
    boxes += real.length
    for (const c of real) {
      const place = placeOf(job, c)
      if (place) places.add(place.trim().toLowerCase())
      const at = counted.get(c.id)
      if (boxIsDue(c, at, now)) dueNow += 1
      else if (at && daysSince(at, now) >= STALE_COUNT_DAYS - DUE_SOON_DAYS) dueSoon += 1
    }
    for (const l of job.lines) {
      if (l.lastTouchedAt && (!lastRecorded || l.lastTouchedAt > lastRecorded.at)) lastRecorded = { at: l.lastTouchedAt, byName: l.lastTouchedBy }
      if (!liveIds.has(l.containerId) || !shown(l)) continue
      if (l.onHand > 0) {
        lines += 1
        pieces += l.onHand
      }
      if (l.cannotFindSinceCount > 0) cannotFindLines += 1
      if ((l.lastCountDiff ?? 0) < 0) shortLines += 1
    }
  }
  return { lastRecorded, quietDays: lastRecorded ? Math.max(0, daysSince(lastRecorded.at, now)) : null, boxes, jobsWithBoxes, places: places.size, lines, pieces, dueNow, dueSoon, cannotFindLines, shortLines }
}

/** What came in and what was used on the site in the last seven days, in pieces, and the invoices or POs behind the deliveries. */
export function siteWeekFlow(movements: ReadonlyArray<Movement>, now: Date): { cameIn: number; used: number; invoices: number } {
  const since = new Date(now.getTime() - 7 * 86_400_000).toISOString()
  let cameIn = 0
  let used = 0
  const sources = new Set<string>()
  for (const m of movements) {
    if (m.at < since) continue
    if (m.reason === 'delivered') {
      cameIn += m.quantity
      if (m.source?.trim()) sources.add(m.source.trim().toLowerCase())
    } else if (m.reason === 'used') used += m.quantity
  }
  return { cameIn, used, invoices: sources.size }
}

/** The list narrowed by a figure: every row, the rows with a box due a count, with a Can't find, or short at a count. */
export type SiteFilter = 'all' | 'due' | 'cannot' | 'short'

export function filterPartRows(rows: ReadonlyArray<SitePartRow>, filter: SiteFilter): SitePartRow[] {
  if (filter === 'due') return rows.filter((r) => r.due)
  if (filter === 'cannot') return rows.filter((r) => r.cannotFind > 0)
  if (filter === 'short') return rows.filter((r) => r.short > 0)
  return [...rows]
}

function hay(row: SitePartRow): string {
  return [row.name, row.manufacturer ?? '', ...row.spellings.map((s) => s.name), ...row.boxes.flatMap((b) => [b.label, b.placeName])].join(' ').toLowerCase()
}

/** The search on the screen: the rows whose names, maker, boxes or places hold every word typed. Every row for no words. */
export function searchPartRows(rows: ReadonlyArray<SitePartRow>, query: string): SitePartRow[] {
  const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean)
  if (words.length === 0) return [...rows]
  return rows.filter((r) => {
    const h = hay(r)
    return words.every((w) => h.includes(w))
  })
}

function n(count: number, one: string, many: string): string {
  return `${count.toLocaleString('en-US')} ${count === 1 ? one : many}`
}

/** "206 pieces in the 2 rows shown": the sum a search or a filter leaves, so nobody adds lines in their head. */
export function shownTotalWords(rows: ReadonlyArray<Pick<SitePartRow, 'total'>>): string {
  const pieces = rows.reduce((sum, r) => sum + r.total, 0)
  return `${n(pieces, 'piece', 'pieces')} in the ${rows.length === 1 ? '1 row' : `${rows.length.toLocaleString('en-US')} rows`} shown`
}

/** "2 days ago by Priya" · "today by Priya" · "9 days ago" · "nothing recorded yet". */
export function lastRecordedWords(glance: Pick<SiteGlance, 'lastRecorded' | 'quietDays'>): { big: string; small: string } {
  if (!glance.lastRecorded || glance.quietDays == null) return { big: 'Nothing yet', small: 'no press on this site' }
  const d = glance.quietDays
  const big = d === 0 ? 'Today' : d === 1 ? 'Yesterday' : `${d} days ago`
  return { big, small: glance.lastRecorded.byName ? `by ${glance.lastRecorded.byName}` : '' }
}

/** "96 boxes on 2 jobs at 3 places" for the head and the desk's site row. */
export function siteBoxesWords(glance: Pick<SiteGlance, 'boxes' | 'jobsWithBoxes' | 'places'>): string {
  const at = glance.places > 0 ? ` at ${n(glance.places, 'place', 'places')}` : ''
  return `${n(glance.boxes, 'box', 'boxes')} on ${n(glance.jobsWithBoxes, 'job', 'jobs')}${at}`
}

/** "3 spellings" beside a row that folded more than one name; empty otherwise. */
export function spellingsWords(row: Pick<SitePartRow, 'spellings'>): string {
  return row.spellings.length > 1 ? `${row.spellings.length} spellings` : ''
}

/** One row of the desk: a site with the jobs under it, or a job on no site. */
export type DeskGroup = { kind: 'site'; siteId: string; name: string; jobIds: string[] } | { kind: 'job'; jobId: string }

/**
 * The desk's rows grouped by site: a development with at least one job on the desk is one group in
 * the order its first job stood, its jobs under it; a job on no site keeps its own row, after the
 * sites. A development whose name was not read falls back to its jobs as plain rows.
 */
export function groupDeskBySite(jobIds: ReadonlyArray<string>, siteOfJob: ReadonlyMap<string, string | null>, siteNames: ReadonlyMap<string, string>): DeskGroup[] {
  const sites: Array<Extract<DeskGroup, { kind: 'site' }>> = []
  const loose: DeskGroup[] = []
  for (const jobId of jobIds) {
    const siteId = siteOfJob.get(jobId) ?? null
    const name = siteId ? siteNames.get(siteId) : undefined
    if (!siteId || !name) {
      loose.push({ kind: 'job', jobId })
      continue
    }
    const group = sites.find((s) => s.siteId === siteId)
    if (group) group.jobIds.push(jobId)
    else sites.push({ kind: 'site', siteId, name, jobIds: [jobId] })
  }
  return [...sites, ...loose]
}
