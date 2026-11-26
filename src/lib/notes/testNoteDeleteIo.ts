/**
 * Deleting a test job's note and a test task's comment (punch list #443, row 13): the counts and the deletes. The rule
 * is `testNoteDelete.ts`.
 *
 * All of it runs as the signed-in person. Each table's own policy lets a dev delete a test row nobody's tag names as
 * its answer, and nobody else (`jobs_ledger_thread_notes_delete_dev`, `checklist_instance_events_delete_dev`), so a
 * delete by any other role, or of any other row, reaches no row and is said as a refusal.
 */
import { supabase } from '../supabase'
import { withSupabaseRetry } from '../../utils/errorHandling'
import { jobNoteDeleteProblem, noteAnswersProblem, taskCommentDeleteProblem } from './testNoteDelete'

/** How many tags name this note as their answer. Throws when the read fails, so a note is never deleted on no answer. */
export async function countJobNoteAnswers(noteId: string): Promise<number> {
  const result = await supabase.from('jobs_ledger_note_tags').select('id', { count: 'exact' }).eq('answer_note_id', noteId).limit(1)
  if (result.error) throw result.error
  if (typeof result.count !== 'number') throw new Error('The tags that may name this as their answer could not be counted. Nothing was deleted.')
  return result.count
}

/** How many tags name this comment as their answer. Throws when the read fails. */
export async function countTaskCommentAnswers(eventId: string): Promise<number> {
  const result = await supabase.from('task_note_tags').select('id', { count: 'exact' }).eq('answer_event_id', eventId).limit(1)
  if (result.error) throw result.error
  if (typeof result.count !== 'number') throw new Error('The tags that may name this as their answer could not be counted. Nothing was deleted.')
  return result.count
}

/**
 * Delete one job note. The job is read again here, right before the delete, and the answers counted; a note that fails
 * the rule is refused with its reason. The delete is sent once, and a delete that reaches no row is said.
 */
export async function deleteTestJobNote(noteId: string, jobId: string): Promise<void> {
  const job = await withSupabaseRetry(() => supabase.from('jobs_ledger').select('job_name, customer_name').eq('id', jobId).maybeSingle(), 'read the job')
  const fixed = jobNoteDeleteProblem(job)
  if (fixed) throw new Error(fixed)
  const answers = noteAnswersProblem(await countJobNoteAnswers(noteId))
  if (answers) throw new Error(answers)
  const gone = await withSupabaseRetry(() => supabase.from('jobs_ledger_thread_notes').delete().eq('id', noteId).select('id'), 'delete the note', { maxRetries: 0 })
  if (!gone || gone.length === 0) throw new Error('The note was not deleted. You may not have leave to delete it, or it is gone already.')
}

/**
 * Delete one task comment. The comment and its task are read again here, right before the delete, and the answers
 * counted; a comment that fails the rule is refused with its reason. The delete is sent once.
 */
export async function deleteTestTaskComment(eventId: string): Promise<void> {
  const event = await withSupabaseRetry(
    () => supabase.from('checklist_instance_events').select('id, event_type, instance_id, checklist_instances(checklist_items(title))').eq('id', eventId).maybeSingle(),
    'read the comment',
  )
  const row = event as unknown as { event_type: string; checklist_instances: { checklist_items: { title: string | null } | null } | null } | null
  const fixed = taskCommentDeleteProblem(row, row?.checklist_instances?.checklist_items?.title ?? null)
  if (fixed) throw new Error(fixed)
  const answers = noteAnswersProblem(await countTaskCommentAnswers(eventId))
  if (answers) throw new Error(answers)
  const gone = await withSupabaseRetry(() => supabase.from('checklist_instance_events').delete().eq('id', eventId).eq('event_type', 'comment').select('id'), 'delete the comment', { maxRetries: 0 })
  if (!gone || gone.length === 0) throw new Error('The comment was not deleted. You may not have leave to delete it, or it is gone already.')
}
