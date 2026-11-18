import { calendarYmdInAppTzFromIso } from '../../utils/dateUtils'
import { formatYmdMonthDay } from './billedExpectedPay'
import { formatUsdNoCents } from './jobFormatting'
import { lienJobPathStanding, type LienJobPathRow } from './lienJobPath'
import { lienBoxFoldWords, lienPublicNotListedWhy, type LienPublicPaper } from './lienPublicProperty'

/**
 * The bin *Off the lien path* (v2.7521 the read, the bin's screen after it): the jobs a person took off the lien path
 * for a reason of their own (`lienJobPath.ts`), each with why, who and the day, so the desk can say where every job
 * stands and nobody has to remember why one is missing from the bins.
 *
 * Pure. The desk's read (`useLienDeskData`) hands the jobs on as `offPathJobs`, as it hands on the public ones.
 */

/** A job a person took off the lien path, as the desk's read hands it on. */
export type LienOffPathJob = {
  jobId: string
  number: string
  name: string
  gcName: string
  /** What the job's sent bills still owe, by the desk's own rule. */
  unpaid: number
  /** Why it is off the path, in the person's words. */
  reason: string
  /** When it was taken off, as stored; null on a row that does not say. */
  since: string | null
  /** Who took it off (`users.id`); null when the person is gone. */
  byUserId: string | null
  /** That person's name, when the read found it. */
  byName?: string | null
  /** When the job went on the attorney's list (the Collections flag), or null when it is not on it. */
  attorneySince: string | null
  /** The job's status (`jobs_ledger.status`): the Collections flag takes a billed job only. */
  status?: string | null
  /** The desk's papers on the job, as they stood when it left: nothing is voided, so they are there when it comes back. */
  papers: LienPublicPaper[]
}

export type LienOffPathBinRow = {
  jobId: string
  /** "523 · Mission Hills". */
  label: string
  unpaidWords: string
  /** "TF Harper · off since Nov 16, by Dana · with the attorney since Nov 16". */
  line: string
  /** The reason, on its own line. */
  reason: string
}

export type LienOffPathBin = {
  title: string
  count: number
  totalWords: string
  /** The box folded to one line (v2.7854, punch list #390): *2 jobs · $1,400 unpaid*. */
  foldWords: string
  rows: LienOffPathBinRow[]
  backLabel: string
}

export const LIEN_OFF_PATH_BIN_TITLE = 'Off the lien path'
export const LIEN_OFF_PATH_BACK_LABEL = 'Put it back…'
/** What a row says when the stored reason is empty, which the press never allows. */
export const LIEN_OFF_PATH_NO_REASON = 'No reason was written down.'

const dayOf = (iso: string | null | undefined) => (iso ? formatYmdMonthDay(calendarYmdInAppTzFromIso(iso)) : '')

/** "off since Nov 16, by Dana": the day and the person, each only when known. */
export function lienOffPathSinceWords(since: string | null | undefined, byName: string | null | undefined): string {
  const day = dayOf(since)
  const by = (byName ?? '').trim()
  return `off${day ? ` since ${day}` : ''}${by ? `${day ? ',' : ''} by ${by}` : ''}`
}

function attorneyWords(j: Pick<LienOffPathJob, 'attorneySince' | 'status'>): string {
  if (j.attorneySince) return `with the attorney since ${dayOf(j.attorneySince)}`
  const why = lienPublicNotListedWhy(j.status)
  return why ? `not on the attorney’s list, the job ${why}` : 'not on the attorney’s list'
}

/** The bin, the most money first; null with no job off the lien path. `userName` names who took a job off when the job's own `byName` is empty. */
export function buildLienOffPathBin(jobs: ReadonlyArray<LienOffPathJob>, opts: { userName?: (id: string) => string | null | undefined } = {}): LienOffPathBin | null {
  if (jobs.length === 0) return null
  const sorted = [...jobs].sort((a, b) => b.unpaid - a.unpaid || (a.number < b.number ? -1 : 1))
  return {
    title: LIEN_OFF_PATH_BIN_TITLE,
    count: sorted.length,
    totalWords: `${formatUsdNoCents(sorted.reduce((s, j) => s + Math.round(j.unpaid), 0))} unpaid`,
    foldWords: lienBoxFoldWords(sorted.length, sorted.reduce((s, j) => s + Math.round(j.unpaid), 0)),
    rows: sorted.map((j) => ({
      jobId: j.jobId,
      label: j.name ? `${j.number} · ${j.name}` : j.number,
      unpaidWords: formatUsdNoCents(j.unpaid),
      line: [j.gcName, lienOffPathSinceWords(j.since, (j.byName ?? '').trim() || (j.byUserId ? opts.userName?.(j.byUserId) : null)), attorneyWords(j)].filter(Boolean).join(' · '),
      reason: j.reason.trim() || LIEN_OFF_PATH_NO_REASON,
    })),
    backLabel: LIEN_OFF_PATH_BACK_LABEL,
  }
}

/**
 * What the job's own Lien window says on a job a person took off the lien path. The window stays whole under it, as it
 * does for a job paid in kind: the law's lien days run whether or not the desk watches them.
 */
export function lienOffPathWindowNote(job: LienJobPathRow | null | undefined): { head: string; line: string } | null {
  const standing = lienJobPathStanding(job)
  if (!standing.off) return null
  const day = dayOf(standing.at)
  const why = standing.reason || LIEN_OFF_PATH_NO_REASON
  return {
    head: LIEN_OFF_PATH_BIN_TITLE,
    line: `Someone took this job off the lien path${day ? ` on ${day}` : ''}. The reason given: ${why}${/[.!?]$/.test(why) ? '' : '.'} It is off the Lien desk, so nobody is reminded of its lien dates there. They still run, and every paper still drafts here.`,
  }
}
