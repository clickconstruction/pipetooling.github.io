/**
 * Deleting a test job's note and a test task's comment (punch list #443, row 13): the take-back of **Post note** on a
 * job's Activity and of **Post** under a note a person was tagged in on a task.
 *
 * A posted note has no edit and no delete, so a note a walk posted on a ZZ Test job stood on its Activity for good.
 * Since migration 20261126030238 each table has a delete policy for a developer, with the rule in the policy, so a
 * delete past this screen reaches no other row. This is the rule for the presses that call it, said in words before
 * the call. Pure: the counts and the deletes are `testNoteDeleteIo.ts`; the presses sit on a note's row in
 * `components/JobThreadNotesPanel.tsx` and on a comment's line in `components/checklist/ChecklistItemActivity.tsx`.
 *
 * - The press is drawn for a dev and for nobody else. View as a sample account is that account, so it draws nothing.
 * - A job's note goes only on a ZZ test job (`isZzTestJob`: the job's own name or its customer's name starts with ZZ).
 * - A task's comment goes only on a task whose title starts with ZZ (`isZzTestName`), and only a comment: the lines
 *   the app writes (done, reopened, a line ticked) are never offered.
 * - A note or a comment another tag names as its answer stays: the tag's `answer_note_id` / `answer_event_id` is
 *   `ON DELETE SET NULL`, and the database would forget the answer without a word. The note's own tags go with it.
 *   Its press reads dead with the count before it is pressed (finding 273): an answer is always a note of the tag's
 *   own job or task, so the tags each panel already reads for its chips hold every answer (`noteAnswerCounts`), with
 *   no read of the press's own. The count inside the delete stays as the last check.
 * - A job's note is kept in Deleted records by the notes table's own trigger. A comment is not kept anywhere.
 */
import { isZzTestJob, isZzTestName } from '../../../supabase/functions/_shared/zzTestJob'

/** Who is offered the delete: a dev. Every other role sees nothing new. */
export function testNoteDeleteDrawn(role: string | null | undefined): boolean {
  return role === 'dev'
}

/** Why a job's note can never be deleted from here, whatever points at it; '' when it may be, once its answers are counted. */
export function jobNoteDeleteProblem(job: { job_name?: string | null; customer_name?: string | null } | null | undefined): string {
  if (!job) return 'The job could not be read, so nobody knows whether it is a test job. Nothing was deleted.'
  if (!isZzTestJob(job)) return 'Only a note on a test job can be deleted. The job’s name or its customer’s name must start with ZZ.'
  return ''
}

/** Why a task's comment can never be deleted from here; '' when it may be, once its answers are counted. */
export function taskCommentDeleteProblem(event: { event_type?: string | null } | null | undefined, itemTitle: string | null | undefined): string {
  if (!event) return 'The comment is not there any more. Read the task again.'
  if (event.event_type !== 'comment') return 'Only a comment a person wrote can be deleted. The app’s own lines stay.'
  if (!isZzTestName(itemTitle)) return 'Only a comment on a test task can be deleted. The task’s title must start with ZZ.'
  return ''
}

/**
 * Why a note or comment stays once its answers are counted; '' when nothing names it. `answers` is how many tags name
 * it as their answer, and null when the count could not be read: nothing is deleted on no answer.
 */
export function noteAnswersProblem(answers: number | null): string {
  if (answers == null || !Number.isFinite(answers) || answers < 0) return 'The tags that may name this as their answer could not be counted. Nothing was deleted.'
  if (answers === 1) return '1 tag names this as its answer. It stays.'
  if (answers > 1) return `${answers} tags name this as their answer. It stays.`
  return ''
}

/**
 * How many tags name each note or comment as their answer, from the tag rows a panel already holds by note
 * (`useJobNoteTags`, `useTaskNoteTags`). A note nothing names has no entry. A panel whose tags did not load holds
 * none, so every press stays live and the delete's own count answers.
 */
export function noteAnswerCounts(byNote: ReadonlyMap<string, readonly { answerNoteId?: string | null }[]>): ReadonlyMap<string, number> {
  const out = new Map<string, number>()
  for (const rows of byNote.values()) {
    for (const r of rows) if (r.answerNoteId) out.set(r.answerNoteId, (out.get(r.answerNoteId) ?? 0) + 1)
  }
  return out
}

/** Why one note's or comment's press is dead: the fixed reason first, then its answers; '' when the press is live. */
export function noteDeleteWhy(fixed: string, answers: number | undefined): string {
  return fixed || noteAnswersProblem(answers ?? 0)
}

/** The confirm window's words for a job's note. The button names the act. */
export function jobNoteDeleteConfirm(authorName: string): { title: string; message: string; confirmLabel: string } {
  return {
    title: `Delete ${authorName}’s note?`,
    message: 'It leaves this job’s Activity for everyone, with its tags. Deleted records keeps a copy. Anyone it told by push keeps that push.',
    confirmLabel: 'Delete the note',
  }
}

/** The confirm window's words for a task's comment. The button names the act. */
export function taskCommentDeleteConfirm(authorName: string): { title: string; message: string; confirmLabel: string } {
  return {
    title: `Delete ${authorName}’s comment?`,
    message: 'It leaves this task’s activity for everyone, with its tags, and nothing keeps a copy. Anyone it told by push keeps that push.',
    confirmLabel: 'Delete the comment',
  }
}

/** The press's word on a row. */
export const TEST_NOTE_DELETE_PRESS = 'Delete…'
/** What the toast says once one is gone. */
export const JOB_NOTE_DELETED_WORDS = 'The note was deleted.'
export const TASK_COMMENT_DELETED_WORDS = 'The comment was deleted.'
