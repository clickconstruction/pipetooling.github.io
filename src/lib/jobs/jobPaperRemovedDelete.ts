/**
 * Deleting a taken-off paper of a test job (punch list #443, row 10): the take-back of **Take off** on a paper's row
 * in *Papers before this job opens*.
 *
 * **Take off** sets `removed_at` on the paper's `job_required_papers` row and keeps the row, since signatures hang on
 * it. The pane and every read of a job's papers leave a taken-off row out, so on a ZZ test job the rows walks take off
 * piled up where no screen listed them. The table lets a signed-in person only read. Two functions of migration
 * 20261127023400 are the one door: `list_test_job_removed_papers` reads a test job's taken-off papers with what points
 * at each, and `delete_test_job_required_paper` deletes one. This is the rule for the fold that calls them. Pure: the
 * calls are `jobPaperRemovedDeleteIo.ts`, the fold is `components/jobs/JobPapersTakenOff.tsx`.
 *
 * - The fold is drawn for a dev on a ZZ test job and for nobody else (`isZzTestJob`: the job's name or its customer's
 *   starts with ZZ). View as a sample account is that account, so it draws nothing.
 * - Only a taken-off paper is listed. A paper still on its job has **Take off** on its own row.
 * - A paper anything points at stays, and its line says what, in the function's own sentence: a copy on a person's
 *   file (the database would clear the copy's pointer without a word), a GC proposal made on it (the database would
 *   delete the proposal with it) or taken as it, and a later paper that is a revision of it.
 * - The function holds every rule again, so a refusal it raises is passed on in its own words.
 */
import { isZzTestJob } from '../../../supabase/functions/_shared/zzTestJob'
import { calendarYmdInAppTzFromIso, formatWorkDateYmdWeekdayShortFriendly } from '../../utils/dateUtils'

/** What of a job says it is a test: its names. */
export interface RemovedPaperJob {
  job_name?: string | null
  customer_name?: string | null
}

/** Who is offered the fold: a dev, on a ZZ test job. Every other role, and every real job, sees nothing new. */
export function removedPapersDrawn(role: string | null | undefined, job: RemovedPaperJob | null | undefined): boolean {
  return role === 'dev' && !!job && isZzTestJob(job)
}

/** One taken-off paper as `list_test_job_removed_papers` answers it. A count that did not come as a number is NaN. */
export interface RemovedPaper {
  id: string
  paperName: string
  /** When the job first required it, and when it came off: instants, or null when the answer held none. */
  requiredAt: string | null
  removedAt: string | null
  /** Copies on people's files that name it (`person_contract_documents.job_required_paper_id`). */
  copies: number
  /** GC proposals made on it (`job_paper_proposals.required_paper_id`). */
  proposals: number
  /** GC proposals taken as it (`job_paper_proposals.taken_as`). */
  takenAs: number
  /** Papers that are a revision of it (`job_required_papers.revision_of`). */
  revisions: number
}

const text = (v: unknown): string => (typeof v === 'string' ? v.trim() : '')
const instant = (v: unknown): string | null => (typeof v === 'string' && Number.isFinite(Date.parse(v)) ? v : null)
const tally = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? Math.floor(v) : Number.NaN)

/**
 * The function's answer as the fold's rows, in the order it gave them: newest taken off first. Throws when the answer
 * is not `{ ok: true, papers: [...] }`, so a list is never drawn from half an answer. A row with no id is left out.
 */
export function parseRemovedPapers(raw: unknown): RemovedPaper[] {
  const answer = raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Record<string, unknown>) : null
  if (!answer || answer.ok !== true || !Array.isArray(answer.papers)) throw new Error('The taken-off papers could not be read.')
  const out: RemovedPaper[] = []
  for (const item of answer.papers) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) continue
    const p = item as Record<string, unknown>
    const id = text(p.id)
    if (!id) continue
    out.push({
      id,
      paperName: text(p.paper_name) || 'A paper with no name',
      requiredAt: instant(p.required_at),
      removedAt: instant(p.removed_at),
      copies: tally(p.copies),
      proposals: tally(p.proposals),
      takenAs: tally(p.taken_as),
      revisions: tally(p.revisions),
    })
  }
  return out
}

const some = (n: number, one: string, many: string): string => (n === 1 ? one : `${n} ${many}`)

/**
 * Why a taken-off paper stays because something points at it, in the sentence `delete_test_job_required_paper` raises
 * for the same tie and in its order; '' when nothing does. A count that could not be read holds the paper too.
 */
export function removedPaperStaysWhy(paper: Pick<RemovedPaper, 'copies' | 'proposals' | 'takenAs' | 'revisions'>): string {
  if ([paper.copies, paper.proposals, paper.takenAs, paper.revisions].some((n) => !Number.isFinite(n) || n < 0)) return 'What points at this paper could not be read. Nothing was deleted.'
  if (paper.copies > 0) return `${some(paper.copies, 'A copy on a person’s file names', 'copies on people’s files name')} this paper. It stays.`
  if (paper.proposals > 0) return `${some(paper.proposals, 'A GC proposal was', 'GC proposals were')} made on this paper. It stays.`
  if (paper.takenAs > 0) return `${some(paper.takenAs, 'A GC proposal was', 'GC proposals were')} taken as this paper. It stays.`
  if (paper.revisions > 0) return `${some(paper.revisions, 'Another paper is', 'other papers are')} a revision of this one. Delete the later one first.`
  return ''
}

/** The day a paper came off, as the screens write a day: *Tue, Nov 24*. '' when the answer held no day. */
export function removedPaperDayWords(removedAt: string | null | undefined): string {
  const ymd = removedAt && Number.isFinite(Date.parse(removedAt)) ? calendarYmdInAppTzFromIso(removedAt) : ''
  return ymd ? formatWorkDateYmdWeekdayShortFriendly(ymd) : ''
}

/** The fold's line: *Taken-off papers · 3*. */
export function removedPapersHeading(n: number): string {
  return `Taken-off papers · ${n}`
}

/** The line under the fold's heading, once it is open. */
export const REMOVED_PAPERS_NOTE = 'Only a developer sees this list, on a test job. A delete takes the paper for good.'

/** The press's word on a paper's line. */
export const REMOVED_PAPER_DELETE_PRESS = 'Delete…'

/** The confirm window's words. It names the paper, and the button names the act. */
export function removedPaperDeleteConfirm(paperName: string): { title: string; message: string; confirmLabel: string } {
  return {
    title: `Delete ${paperName} for good?`,
    message: 'This taken-off paper is deleted, and it cannot be brought back. Nobody’s signature goes with it.',
    confirmLabel: 'Delete the paper',
  }
}

/** What the toast says once it is gone. */
export function removedPaperDeletedWords(paperName: string): string {
  return `${paperName} was deleted.`
}
