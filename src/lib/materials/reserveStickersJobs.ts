/**
 * Print future stickers' *Which job?* window (punch list #304 and #329; the owner's call 5 of 2026-11-16, v2.7492): what
 * each job's card says before a job is picked. The window was a list of names with a box count; a card now says what
 * the job holds, the runs printed for it so far, the stickers reserved and not on a box yet with who printed them,
 * and the name a new run would open on. Pure: the jobs, the runs and the sites' names in, the words out. The window
 * is `PrintStickersWindow.tsx`, the reads `reserveStickersIo.ts`; the labels window's twin is `printLabelsJobs.ts`.
 *
 * Since v2.7523 a card with reserved stickers carries the presses that print them, one a run (`reservedPrint.ts`),
 * and its line before **Print future stickers** says that press reserves new ones.
 */
import { compareLabels } from './onSite'
import { labelBoxes, type OnSiteFindJob } from './onSiteFind'
import { labelPrintName, labelPrintNames } from './labels'
import { kindCountsWords, nameSpan } from './printLabelsJobs'
import { newRunBesideReservedWords, reservedRunsToPrint, type ReservedRunPrint } from './reservedPrint'
import { nextNameToReserve } from './stickerNames'
import { NO_RESERVED, notYetOnBoxWords, reservedByWords, reservedOfJob, type ReservedOfJob } from './stickerPlace'
import type { SiteStickerNames, StickerRunWithStickers } from './stickerRunsIo'

const count = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`

/** A job's runs added up: how many runs, their stickers, and how those stand. */
export type RunsSoFar = { runs: number; stickers: number; onBoxes: number; lost: number }

export function runsSoFar(runs: ReadonlyArray<Pick<StickerRunWithStickers, 'stickers'>>): RunsSoFar {
  let stickers = 0
  let onBoxes = 0
  let lost = 0
  for (const run of runs) {
    for (const s of run.stickers) {
      stickers += 1
      if (s.lostAt) lost += 1
      else if (s.containerId) onBoxes += 1
    }
  }
  return { runs: runs.length, stickers, onBoxes, lost }
}

/** *2 runs so far · 223 stickers · 114 on boxes · 3 lost*, or that a run here would be the job's first. */
export function runsSoFarWords(r: RunsSoFar): string {
  if (r.runs === 0) return 'A run here would be this job’s first.'
  const parts = [`${count(r.runs, 'run', 'runs')} so far`, count(r.stickers, 'sticker', 'stickers'), `${r.onBoxes} on boxes`]
  if (r.lost > 0) parts.push(`${r.lost} lost`)
  return parts.join(' · ')
}

/**
 * *A new run opens on G201.* Empty when the site has no name to go by yet, and the next window asks for the first.
 * On a card that has reserved stickers (v2.7523) the line first says what the other press does, *Print future stickers
 * reserves new ones.*, so it is not read as the press that prints the reserved ones.
 */
export function nextNameWords(name: string | null | undefined, hasReserved = false): string {
  if (hasReserved) return newRunBesideReservedWords(name)
  return name ? `A new run opens on ${name}.` : ''
}

export type StickerJobFacts = {
  jobId: string
  label: string
  number: string
  name: string
  where: string
  /** The job's live cages and boxes today; a run may come before the first. */
  boxes: number
  kinds: string
  names: ReturnType<typeof nameSpan>
  /** The runs printed for this job; null while unread or when the read failed, and the lines are left out. */
  soFar: RunsSoFar | null
  /** The stickers reserved and not on a box yet; none while unread. */
  reserved: ReservedOfJob
  /** The sentence for them, with who printed them and when; empty at none. */
  reservedWords: string
  /** The presses that print them, one for each run that holds some (v2.7523); none while unread. */
  toPrint: ReservedRunPrint[]
  /** The name a new run opens on; undefined while the site is unread, null when the site has none to offer. */
  nextName: string | null | undefined
  /** Why the job's boxes are not here, when its read failed. */
  failed: string | null
}

export type StickerJobsInput = {
  /** Each job's runs by its id; null while unread or when the read failed. */
  runsOf: ReadonlyMap<string, ReadonlyArray<StickerRunWithStickers>> | null
  /** Each job's site: its name, and the site's boxes and reserved names. Null while unread or when the read failed. */
  sitesOf: ReadonlyMap<string, { site: string; names: SiteStickerNames | null }> | null
  /** A printed day as words, *Nov 16*. */
  dayWords: (iso: string) => string
}

/** One job's card. A job with no box is a card too: stickers come before boxes. */
export function stickerJobFacts(job: OnSiteFindJob, input: StickerJobsInput): StickerJobFacts {
  const boxes = labelBoxes(job).sort((a, b) => compareLabels(a.label, b.label))
  const printNames = labelPrintNames(job.containers)
  const runs = input.runsOf?.get(job.jobId) ?? (input.runsOf ? [] : null)
  const reserved = runs ? reservedOfJob(runs) : NO_RESERVED
  const head = notYetOnBoxWords(reserved.count, reserved)
  const by = reservedByWords(reserved, reserved.printedAt ? input.dayWords(reserved.printedAt) : '')
  const site = input.sitesOf?.get(job.jobId)
  return {
    jobId: job.jobId,
    label: job.label,
    number: job.number?.trim() ?? '',
    name: job.name?.trim() || (job.number ? '' : job.label),
    where: [site?.site.trim() ?? '', job.address?.trim() ?? ''].filter(Boolean).join(' · '),
    boxes: boxes.length,
    kinds: kindCountsWords(boxes),
    names: nameSpan(boxes.map((b) => labelPrintName(printNames, b))),
    soFar: runs ? runsSoFar(runs) : null,
    reserved,
    reservedWords: head ? `${head}.${by ? ` ${by}` : ''}` : '',
    toPrint: runs ? reservedRunsToPrint(runs) : [],
    nextName: site?.names ? nextNameToReserve(site.names.boxes, site.names.blankNames) : site ? null : undefined,
    failed: job.failed ?? null,
  }
}

/** Every job, in order of need: stickers waiting for their boxes first, then the job's number and name. */
export function stickerJobsInOrder(jobs: ReadonlyArray<OnSiteFindJob>, input: StickerJobsInput): StickerJobFacts[] {
  return jobs
    .map((j) => stickerJobFacts(j, input))
    .sort((a, b) => Number(b.reserved.count > 0) - Number(a.reserved.count > 0) || a.label.localeCompare(b.label, undefined, { numeric: true }))
}

/** The cards a typed search leaves: every typed word in the job's number, name, site or street. */
export function findStickerJobs(facts: ReadonlyArray<StickerJobFacts>, query: string): StickerJobFacts[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean)
  if (words.length === 0) return [...facts]
  return facts.filter((f) => { const hay = `${f.label} ${f.where}`.toLowerCase(); return words.every((w) => hay.includes(w)) })
}

/** Beside a job's name: how many boxes it holds today, or that it has none yet. */
export function boxCountAside(n: number): string {
  return n === 0 ? 'no box yet' : ''
}

/** The question, as the window has always asked it. */
export const RESERVE_WHICH_JOB = 'Which job? New boxes made from the stickers go on it.'
/** The foot's question, before the press that prints labels for boxes already made. */
export const RESERVE_ALREADY_IN = 'Boxes that are already in the app?'
/** The door that goes to the job's own page, where reserved stickers are put on their boxes. */
export const RESERVE_OPEN_JOB_LABEL = 'Open the job’s boxes'
