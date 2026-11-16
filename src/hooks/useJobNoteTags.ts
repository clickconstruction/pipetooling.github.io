import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { tagsByNote, type NoteTagRow } from '../lib/jobs/noteTags'

const EMPTY: ReadonlyMap<string, NoteTagRow[]> = new Map()

/**
 * The tags on one job's notes, by note (punch list #363). `jobId` null reads nothing, so a row
 * that has not loaded its feed asks for none. `rev` is anything that changes when the feed does
 * (its length), so a note just posted brings its tags with it.
 *
 * A read that fails leaves the notes as they were: the chips and the waiting words are an
 * addition to a line that already reads whole, so no error is drawn for them.
 */
export function useJobNoteTags(jobId: string | null, rev: unknown): ReadonlyMap<string, NoteTagRow[]> {
  const [state, setState] = useState<{ jobId: string | null; byNote: ReadonlyMap<string, NoteTagRow[]> }>({ jobId: null, byNote: EMPTY })

  useEffect(() => {
    if (!jobId) return
    let live = true
    void supabase
      .from('jobs_ledger_note_tags')
      .select('note_id, tagged_user_id, tagged_name, tagger_user_id, created_at, cleared_at, cleared_how')
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
        }))
        setState({ jobId, byNote: rows.length === 0 ? EMPTY : tagsByNote(rows) })
      })
    return () => {
      live = false
    }
  }, [jobId, rev])

  return state.jobId === jobId ? state.byNote : EMPTY
}
