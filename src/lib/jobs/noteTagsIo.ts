import { supabase } from '../supabase'
import { withSupabaseRetry } from '../../utils/errorHandling'
import type { MyTag } from './noteTags'

/**
 * Tagged job notes (punch list #363): the reads and writes the section, the count above Jobs and
 * the Needs you line share, and the one signal that tells all three a tag changed.
 */

/** Every list in one read: what waits on the reader and what the reader asked, in job notes and task notes alike. */
export async function loadMyTags(): Promise<MyTag[]> {
  const rows = await withSupabaseRetry(async () => supabase.rpc('note_tags_mine'), 'read tagged notes')
  return (rows ?? []).map((r) => ({
    tagId: r.tag_id,
    kind: r.kind === 'waiting' ? 'waiting' : 'asked',
    source: r.source === 'task' ? 'task' : 'job',
    instanceId: r.instance_id ?? null,
    itemId: r.item_id ?? null,
    taskTitle: r.task_title ?? null,
    taskDate: r.task_date ?? null,
    taggedLeft: r.tagged_left === true,
    noteId: r.note_id,
    jobId: r.job_id ?? '',
    jobName: r.job_name ?? '',
    jobNumber: r.job_number ?? null,
    jobKind: r.job_kind ?? null,
    customerName: r.customer_name ?? null,
    noteBody: r.note_body ?? '',
    noteCreatedAt: r.note_created_at,
    taggerUserId: r.tagger_user_id,
    taggerName: r.tagger_name ?? '',
    taggedUserId: r.tagged_user_id,
    taggedName: r.tagged_name ?? '',
    createdAt: r.created_at,
    clearedAt: r.cleared_at ?? null,
    clearedHow: r.cleared_how === 'answered' || r.cleared_how === 'done' ? r.cleared_how : null,
    answerBody: r.answer_body ?? null,
    askerSeenAt: r.asker_seen_at ?? null,
  }))
}

/** The number above Jobs: tags that wait on the reader, and answers they have not seen. */
export async function loadMyTagsCount(): Promise<number> {
  const n = await withSupabaseRetry(async () => supabase.rpc('job_note_tags_count'), 'count tagged job notes')
  return typeof n === 'number' ? n : 0
}

/** An answer from the section: a typed note on the job, with any teammate picked in it. Not retried, so it posts once. */
export async function postTaggedNote(jobId: string, body: string, tagged: readonly string[]): Promise<string> {
  const { data, error } = await supabase.rpc('job_note_post_tagged', { p_job_id: jobId, p_body: body, p_tagged: [...tagged] })
  if (error) throw error
  if (!data) throw new Error('The note was not posted')
  return data
}

/**
 * A typed task note with the teammates picked in it (punch list #375), in one transaction: the note in the task's
 * thread and its tags. Returns the note's id. Not retried, so it posts once.
 */
export async function postTaggedTaskNote(instanceId: string, body: string, tagged: readonly string[]): Promise<string> {
  const { data, error } = await supabase.rpc('task_note_post_tagged', { p_instance_id: instanceId, p_body: body, p_tagged: [...tagged] })
  if (error) throw error
  if (!data) throw new Error('The note was not posted')
  return data
}

/** No reply needed, on a job tag or a task tag. False when the tag no longer waits. */
export async function markTagDone(tagId: string, source: 'job' | 'task' = 'job'): Promise<boolean> {
  const { data, error } = await supabase.rpc(source === 'task' ? 'task_note_tag_done' : 'job_note_tag_done', { p_tag_id: tagId })
  if (error) throw error
  return data === true
}

/**
 * The reader has had their answers on screen. Each kind has its own mark, so a list that shows one
 * kind marks that kind alone and the other still counts where it is shown.
 */
export async function markAnswersSeen(source: 'job' | 'task' = 'job'): Promise<number> {
  const { data, error } = await supabase.rpc(source === 'task' ? 'task_note_tags_seen' : 'job_note_tags_seen')
  if (error) throw error
  return typeof data === 'number' ? data : 0
}

/**
 * The phone notice for a note just posted, or for a No reply needed press (`notify-note-tag`). The function writes
 * the words from the rows. A notice that fails changes nothing on screen, so its failure is dropped: the tag is
 * already on the job and in the count.
 */
export function notifyNoteTag(what: { noteId: string } | { tagId: string } | { taskEventId: string } | { taskTagId: string }): void {
  // A task note is named by its line in the task's thread, and a task tag by its own id (punch list #375).
  const body = 'noteId' in what ? { note_id: what.noteId } : 'tagId' in what ? { tag_id: what.tagId } : 'taskEventId' in what ? { task_event_id: what.taskEventId } : { task_tag_id: what.taskTagId }
  void supabase.functions.invoke('notify-note-tag', { body }).then(
    () => {},
    () => {},
  )
}

// ---------- one signal, one shared count ----------

const listeners = new Set<() => void>()

/** Run `fn` whenever a tag is made, answered, cleared or seen in this tab. Returns the way to stop. */
export function onNoteTagsChanged(fn: () => void): () => void {
  listeners.add(fn)
  return () => {
    listeners.delete(fn)
  }
}

/** Tell the count, the section and the Needs you line to read again. */
export function noteTagsChanged(): void {
  for (const fn of [...listeners]) fn()
}
