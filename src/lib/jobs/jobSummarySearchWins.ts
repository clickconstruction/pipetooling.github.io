import {
  jobSummaryRowInBudgetFilter,
  jobSummaryRowInStatus,
  jobSummaryRowInWindow,
  jobSummarySearchOn,
  type JobSummaryEnrichedRow,
  type JobSummaryLedgerRowInput,
  type JobSummaryViewPrefs,
} from './jobSummaryLedgerView'

/**
 * The search wins (v2.5745). The owner typed 891 on Jobs → Job Summary with the
 * defaults on (Show · Finished, Worked in · This year, the HCP # 500 floor) and the
 * page drew no row: the kernel ANDed the search with every chip, and the floor had
 * dropped the sub-500 rows in the fetch before the search could see them. A job
 * number, a name or an address typed in the box is an explicit ask, so the chips
 * step aside for the rows it matches (`filterAndSortJobSummaryRows`), the floor
 * lifts an exact number match, and this kernel says what matched and what each
 * chip would have hidden — in plain words (`src/lib/plainWords.ts`).
 *
 * Two kernels: `jobSummaryUnderFloorMatches` picks the rows under the floor a search
 * reaches — an exact job number lifts its row (one job, so the card-charge batch that
 * refetches on every listed id is not paid per keystroke), a looser name or address
 * match is counted and given the floor's door — and `jobSummarySearchNote` writes the
 * line under the controls.
 */

/** What the search box reads on a job: the two numbers, the name and the address. */
export type JobSummarySearchable = {
  hcp_number?: string | null
  click_number?: string | null
  job_name?: string | null
  job_address?: string | null
}

const norm = (v: string | null | undefined): string => (v ?? '').trim().toLowerCase()

/** The query names this job exactly by its HCP or Click number. */
export function jobSummarySearchIsExactNumber(job: JobSummarySearchable, search: string): boolean {
  const q = norm(search)
  if (!q) return false
  return norm(job.hcp_number) === q || norm(job.click_number) === q
}

/** The loose match the box applies: the query appears in a number, the name or the address. */
export function jobSummarySearchReaches(job: JobSummarySearchable, search: string): boolean {
  const q = norm(search)
  if (!q) return true
  return [job.hcp_number, job.click_number, job.job_name, job.job_address].some((v) => norm(v).includes(q))
}

export type JobSummaryUnderFloorMatches<J> = {
  /** Rows the search names by exact number: lifted from under the floor and drawn. */
  lift: J[]
  /** Rows the search reaches by name or address only: counted, with the floor's door. */
  alsoMatch: number
}

/**
 * The rows under the HCP # floor a search reaches. `pool` is every row the floor
 * dropped (the fetch's and the client's); an exact number match lifts its row, a
 * looser match is counted so the note can say "N more older jobs match by name".
 */
export function jobSummaryUnderFloorMatches<J extends JobSummarySearchable>(pool: readonly J[], search: string): JobSummaryUnderFloorMatches<J> {
  if (!jobSummarySearchOn(search)) return { lift: [], alsoMatch: 0 }
  const lift: J[] = []
  let alsoMatch = 0
  for (const j of pool) {
    if (jobSummarySearchIsExactNumber(j, search)) lift.push(j)
    else if (jobSummarySearchReaches(j, search)) alsoMatch += 1
  }
  return { lift, alsoMatch }
}

export type JobSummarySearchNoteInput<R extends JobSummaryLedgerRowInput> = {
  search: string
  /** The rows drawn for the search (the view's rows). */
  rows: readonly JobSummaryEnrichedRow<R>[]
  prefs: Pick<JobSummaryViewPrefs, 'status' | 'window' | 'budgetFilter'>
  startYmd: string
  endYmd: string
  /** The HCP # floor in force; −1 means none. */
  floor: number
  /** Ids of the drawn rows that were lifted from under the floor. */
  liftedJobIds?: ReadonlySet<string>
  /** Exact number matches under the floor still being read. */
  liftPending?: number
  /** Looser matches under the floor, counted but not lifted. */
  underFloorAlso?: number
}

export type JobSummarySearchNote = {
  /** False while the box is empty: no line to draw. */
  on: boolean
  matched: number
  /** Of the drawn rows, how many each chip would have hidden. */
  heldByStatus: number
  heldByWindow: number
  heldByBudget: number
  lifted: number
  /** One idea per sentence, none over 20 words, no glue — the plain words rules. */
  sentences: string[]
  sentence: string
}

const jobsWord = (n: number) => (n === 1 ? 'job' : 'jobs')
const jobLabel = (job: JobSummarySearchable): string => {
  const n = (job.hcp_number ?? '').trim() || (job.click_number ?? '').trim()
  return n ? `Job ${n}` : ((job.job_name ?? '').trim() || 'The job')
}
const floorName = (floor: number) => `the HCP # ${floor} floor`

/** The line under the controls while a search is on: what matched, and what each chip or the floor would have hidden. */
export function jobSummarySearchNote<R extends JobSummaryLedgerRowInput>(args: JobSummarySearchNoteInput<R>): JobSummarySearchNote {
  const { search, rows, prefs, startYmd, endYmd, floor } = args
  const liftedIds = args.liftedJobIds ?? new Set<string>()
  const liftPending = Math.max(0, args.liftPending ?? 0)
  const underFloorAlso = Math.max(0, args.underFloorAlso ?? 0)
  const off: JobSummarySearchNote = { on: false, matched: 0, heldByStatus: 0, heldByWindow: 0, heldByBudget: 0, lifted: 0, sentences: [], sentence: '' }
  if (!jobSummarySearchOn(search)) return off

  const q = search.trim()
  let heldByStatus = 0
  let heldByWindow = 0
  let heldByBudget = 0
  let lifted = 0
  for (const r of rows) {
    if (!jobSummaryRowInStatus(r, prefs.status)) heldByStatus += 1
    if (!jobSummaryRowInWindow(r, prefs.window, startYmd, endYmd)) heldByWindow += 1
    if (!jobSummaryRowInBudgetFilter(r, prefs.budgetFilter)) heldByBudget += 1
    if (liftedIds.has(r.row.job.id)) lifted += 1
  }
  const matched = rows.length
  const sentences: string[] = []

  if (matched === 0) {
    if (liftPending > 0) {
      sentences.push(`Looking under ${floorName(floor)} for ${q}.`)
    } else {
      sentences.push(`No job matches ${q}.`)
      if (underFloorAlso === 0) sentences.push('Check the number, or clear the search box to see the list again.')
    }
  } else {
    sentences.push(matched === 1 ? '1 job matches your search.' : `${matched} jobs match your search.`)
    const first = rows[0]
    if (matched === 1 && first) {
      const label = jobLabel(first.row.job)
      const statusWhy = prefs.status === 'finished' ? 'is still in progress' : 'is finished already'
      if (lifted > 0) sentences.push(`${label} sits under ${floorName(floor)}, so the floor stepped aside.`)
      const subject = lifted > 0 ? 'The job' : label
      if (heldByStatus > 0 && heldByWindow > 0) sentences.push(`${subject} ${statusWhy} and was not worked in this window, so both chips stepped aside.`)
      else if (heldByStatus > 0) sentences.push(`${subject} ${statusWhy}, so the Show chip stepped aside.`)
      else if (heldByWindow > 0) sentences.push(`${subject} was not worked in this window, so the Worked in chip stepped aside.`)
      if (heldByBudget > 0) sentences.push(`${subject} is not on the Budget chip's footing, so that chip stepped aside.`)
    } else {
      if (heldByStatus > 0) sentences.push(`${heldByStatus} ${heldByStatus === 1 ? 'is' : 'are'} ${prefs.status === 'finished' ? 'still in progress' : 'finished already'}.`)
      if (heldByWindow > 0) sentences.push(`${heldByWindow} ${heldByWindow === 1 ? 'was' : 'were'} not worked in this window.`)
      if (heldByBudget > 0) sentences.push(`${heldByBudget} ${heldByBudget === 1 ? 'is' : 'are'} not on the Budget chip's footing.`)
      if (lifted > 0) sentences.push(`${lifted} ${lifted === 1 ? 'sits' : 'sit'} under ${floorName(floor)}.`)
      if (heldByStatus + heldByWindow + heldByBudget + lifted > 0) sentences.push('The chips and the floor step aside while you search.')
    }
    if (liftPending > 0) sentences.push(`Still looking under ${floorName(floor)} for ${liftPending} more.`)
  }
  if (underFloorAlso > 0) {
    sentences.push(
      `${underFloorAlso} more older ${jobsWord(underFloorAlso)} under ${floorName(floor)} ${underFloorAlso === 1 ? 'matches' : 'match'} by name or address.`,
    )
    sentences.push('Press show all under the table to see them.')
  }
  return { on: true, matched, heldByStatus, heldByWindow, heldByBudget, lifted, sentences, sentence: sentences.join(' ') }
}
