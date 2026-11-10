import { compareLabels, placeName, searchContainers, searchLines, type Container, type ContainerLine, type Place } from './onSite'

/**
 * Find a part or a box on any job (punch list #304): one search across every job the store has
 * read, where the phone's own search stops at one job. Pure: the jobs' containers, lines and places
 * in, the hits out. A line matches as the one-job search matches it (`searchLines`: every word in
 * the part's name or maker); a box matches by the start of its stencil (`searchContainers`).
 */

export type OnSiteFindJob = {
  jobId: string
  /** How the job reads in a row: its number and name. */
  label: string
  containers: ReadonlyArray<Container>
  lines: ReadonlyArray<ContainerLine>
  places: ReadonlyArray<Place>
}

export type OnSiteFindHit = {
  jobId: string
  jobLabel: string
  container: Container
  /** The place the box stands in, empty when nobody said. */
  place: string
  /** The line that matched, or null when the box itself matched by its stencil. */
  line: ContainerLine | null
}

export const ON_SITE_FIND_MAX = 60

/**
 * The hits, a job at a time: `firstJobId`'s first (the job the phone is on), then the others by
 * label. Inside a job, the boxes whose stencil matched, then the lines by box. Retired boxes are
 * left out. `total` is the count before the cap.
 */
export function findOnSite(jobs: ReadonlyArray<OnSiteFindJob>, query: string, opts: { firstJobId?: string | null; max?: number } = {}): { hits: OnSiteFindHit[]; total: number } {
  if (!query.trim()) return { hits: [], total: 0 }
  const max = opts.max ?? ON_SITE_FIND_MAX
  const ordered = [...jobs].sort((a, b) => {
    if (a.jobId === opts.firstJobId) return -1
    if (b.jobId === opts.firstJobId) return 1
    return a.label.localeCompare(b.label, undefined, { numeric: true })
  })
  const hits: OnSiteFindHit[] = []
  for (const job of ordered) {
    const live = new Map(job.containers.filter((c) => !c.retiredAt).map((c) => [c.id, c] as const))
    const place = (c: Container) => (c.locationId ? placeName(job.places, c.locationId) : '')
    for (const c of searchContainers([...live.values()], query)) {
      hits.push({ jobId: job.jobId, jobLabel: job.label, container: c, place: place(c), line: null })
    }
    const lines = searchLines(job.lines, query)
      .filter((l) => live.has(l.containerId))
      .sort((a, b) => compareLabels(live.get(a.containerId)!.label, live.get(b.containerId)!.label) || a.partName.localeCompare(b.partName))
    for (const l of lines) {
      const c = live.get(l.containerId)!
      hits.push({ jobId: job.jobId, jobLabel: job.label, container: c, place: place(c), line: l })
    }
  }
  return { hits: hits.slice(0, max), total: hits.length }
}

function count(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`
}

/** "3 lines in 2 boxes on 2 jobs", and what the cap left out. Empty for no hit. */
export function findOnSiteWords(found: { hits: ReadonlyArray<OnSiteFindHit>; total: number }): string {
  if (found.total === 0) return ''
  const boxes = new Set(found.hits.map((h) => h.container.id)).size
  const jobs = new Set(found.hits.map((h) => h.jobId)).size
  const lines = found.hits.filter((h) => h.line).length
  const head = lines > 0 ? `${count(lines, 'line', 'lines')} in ${count(boxes, 'box', 'boxes')}` : count(boxes, 'box', 'boxes')
  const tail = found.total > found.hits.length ? `, the first ${found.hits.length} of ${found.total}` : ''
  return `${head} on ${count(jobs, 'job', 'jobs')}${tail}`
}

/** The jobs with a live box other than `jobId`, by label: what an empty job points at. */
export function otherJobsWithBoxes(jobs: ReadonlyArray<OnSiteFindJob>, jobId: string | null): Array<{ jobId: string; label: string; boxes: number }> {
  return jobs
    .filter((j) => j.jobId !== jobId)
    .map((j) => ({ jobId: j.jobId, label: j.label, boxes: j.containers.filter((c) => !c.retiredAt && c.kind !== 'unsorted').length }))
    .filter((j) => j.boxes > 0)
    .sort((a, b) => a.label.localeCompare(b.label, undefined, { numeric: true }))
}

/** "Your boxes are on 2 other jobs." */
export function otherJobsWords(n: number): string {
  return n === 1 ? 'Your boxes are on 1 other job.' : `Your boxes are on ${n} other jobs.`
}

/** The boxes a label is printed for: live, and never the Unsorted row a delivery lands in. */
export function labelBoxes(job: Pick<OnSiteFindJob, 'containers'>): Container[] {
  return job.containers.filter((c) => !c.retiredAt && c.kind !== 'unsorted')
}

/** "1 label" · "6 labels", beside a job in Print labels' *Which job?* */
export function labelCountWords(n: number): string {
  return n === 1 ? '1 label' : `${n} labels`
}
