import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { tagsByNote, type NoteTagRow } from '../lib/jobs/noteTags'
import { onNoteTagsChanged } from '../lib/jobs/noteTagsIo'

const EMPTY: ReadonlyMap<string, NoteTagRow[]> = new Map()

/**
 * The tags on one task's notes, by note (punch list #375): `useJobNoteTags` for a task. A tag stays
 * with the task, so one read holds every day row's. `itemId` null reads nothing. `rev` is anything
 * that changes when the thread does (its length), and the reader's own post is read again when
 * `noteTagsChanged` says so. A thread that shows one day row alone, as History's and the Roadmap
 * card's do, hands `instanceId` in place of the task and reads that day's tags.
 *
 * A read that fails leaves the notes as they were: the chips and the waiting words are an addition
 * to a line that already reads whole, so no error is drawn for them.
 */
export function useTaskNoteTags(taskItemId: string | null, rev: unknown, instanceId: string | null = null): ReadonlyMap<string, NoteTagRow[]> {
  // One key for either read: the task, or the one day row.
  const itemId = instanceId ? `day:${instanceId}` : taskItemId
  const [state, setState] = useState<{ itemId: string | null; byNote: ReadonlyMap<string, NoteTagRow[]> }>({ itemId: null, byNote: EMPTY })

  const [changed, setChanged] = useState(0)
  useEffect(() => (itemId ? onNoteTagsChanged(() => setChanged((n) => n + 1)) : undefined), [itemId])

  useEffect(() => {
    if (!itemId) return
    let live = true
    void supabase
      .from('task_note_tags')
      .select('event_id, tagged_user_id, tagged_name, tagger_user_id, created_at, cleared_at, cleared_how')
      .eq(instanceId ? 'instance_id' : 'item_id', instanceId ?? taskItemId ?? '')
      .then(({ data, error }) => {
        if (!live || error || !data) return
        const rows: NoteTagRow[] = data.map((r) => ({
          noteId: r.event_id,
          taggedUserId: r.tagged_user_id,
          taggedName: r.tagged_name,
          taggerUserId: r.tagger_user_id,
          createdAt: r.created_at,
          clearedAt: r.cleared_at,
          clearedHow: r.cleared_how === 'answered' || r.cleared_how === 'done' ? r.cleared_how : null,
        }))
        setState({ itemId, byNote: rows.length === 0 ? EMPTY : tagsByNote(rows) })
      })
    return () => {
      live = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- itemId stands for the task or the day row
  }, [itemId, rev, changed])

  return state.itemId === itemId ? state.byNote : EMPTY
}
