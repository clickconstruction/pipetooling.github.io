import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { tagsByNote, type NoteTagRow } from '../lib/jobs/noteTags'
import { onNoteTagsChanged } from '../lib/jobs/noteTagsIo'

const EMPTY: ReadonlyMap<string, NoteTagRow[]> = new Map()

/**
 * The tags on one job's notes, by note (punch list #363). `jobId` null reads nothing, so a row
 * that has not loaded its feed asks for none. `rev` is anything that changes when the feed does
 * (its length), so a note someone else posted brings its tags with it. The reader's own post is
 * read when `noteTagsChanged` says so (v2.7426): the feed grows by the optimistic row before the
 * tag exists, and swapping that row for the real one does not change the length.
 *
 * A read that fails leaves the notes as they were: the chips and the waiting words are an
 * addition to a line that already reads whole, so no error is drawn for them.
 *
 * Each row carries the note that answered it (`answerNoteId`), which is always a note of the same job: a dev's
 * **Delete…** on a test job's note reads its answers from here, with no read of its own (punch list #443, row 13).
 */
export function useJobNoteTags(jobId: string | null, rev: unknown): ReadonlyMap<string, NoteTagRow[]> {
  const [state, setState] = useState<{ jobId: string | null; byNote: ReadonlyMap<string, NoteTagRow[]> }>({ jobId: null, byNote: EMPTY })

  // A tag made, answered or cleared in this tab: read this job's tags again.
  const [changed, setChanged] = useState(0)
  useEffect(() => (jobId ? onNoteTagsChanged(() => setChanged((n) => n + 1)) : undefined), [jobId])

  useEffect(() => {
    if (!jobId) return
    let live = true
    void supabase
      .from('jobs_ledger_note_tags')
      .select('note_id, tagged_user_id, tagged_name, tagger_user_id, created_at, cleared_at, cleared_how, answer_note_id')
      .eq('job_id', jobId)
      .then(({ data, error }) => {
        if (!live || error || !data) return
        const rows: NoteTagRow[] = data.map((r) => ({
          noteId: r.note_id,
          taggedUserId: r.tagged_user_id,
          taggedName: r.tagged_name,
          taggerUserId: r.tagger_user_id,
          createdAt: r.created_at,
          clearedAt: r.cleared_at,
          clearedHow: r.cleared_how === 'answered' || r.cleared_how === 'done' ? r.cleared_how : null,
          answerNoteId: r.answer_note_id ?? null,
        }))
        setState({ jobId, byNote: rows.length === 0 ? EMPTY : tagsByNote(rows) })
      })
    return () => {
      live = false
    }
  }, [jobId, rev, changed])

  return state.jobId === jobId ? state.byNote : EMPTY
}
