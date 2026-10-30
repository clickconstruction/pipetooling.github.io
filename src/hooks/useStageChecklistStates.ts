/**
 * A checklist per stage (punch list #164, PR 4): the board's read behind the Pipeline's not-ready mark. One read of
 * the live questions and one chunked read of the answers on the board's jobs, as `useJobCrewPositions` reads the
 * crew: fail-soft, so a missing table (a client ahead of the push), a refused read or any error is an empty read and
 * the row draws what it drew before. Each row turns the read into its own marks with `stageChecklistMarks`.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { fetchAllRowsChunkedIn } from '../lib/supabasePaging'
import type { StageChecklistAnswer, StageChecklistQuestion } from '../lib/jobs/stageChecklist'
import { loadQuestions } from '../lib/jobs/stageChecklistIo'

// The tables are younger than the generated types; the types PR after the push removes this cast.
const db = supabase as unknown as SupabaseClient

type AnswerMarkRow = { fixture_id: string; question_id: string; pick: string | null; photo_file_name: string | null }

const NO_ANSWERS: ReadonlyMap<string, readonly StageChecklistAnswer[]> = new Map()

/** The rows the mark needs under the kernel's shape: the pick, and whether a photo is on the row. */
export function markAnswersFromRows(rows: readonly AnswerMarkRow[]): ReadonlyMap<string, readonly StageChecklistAnswer[]> {
  const out = new Map<string, StageChecklistAnswer[]>()
  for (const r of rows) {
    const pick = r.pick === 'yes' || r.pick === 'no' || r.pick === 'not_here' ? r.pick : null
    const photo = r.photo_file_name ? { fileName: r.photo_file_name, takenAt: '', state: 'waiting' as const, driveFileId: null, failWhy: null } : null
    out.set(r.fixture_id, [...(out.get(r.fixture_id) ?? []), { questionId: r.question_id, pick, note: '', photo }])
  }
  return out
}

export interface StageChecklistStates {
  questions: readonly StageChecklistQuestion[]
  answersByFixture: ReadonlyMap<string, readonly StageChecklistAnswer[]>
  loading: boolean
  reload: () => void
}

export function useStageChecklistStates(jobIds: ReadonlyArray<string>, enabled: boolean): StageChecklistStates {
  const [questions, setQuestions] = useState<readonly StageChecklistQuestion[]>([])
  const [answersByFixture, setAnswers] = useState<ReadonlyMap<string, readonly StageChecklistAnswer[]>>(NO_ANSWERS)
  const [loading, setLoading] = useState(false)
  const [tick, setTick] = useState(0)
  const seq = useRef(0)
  const key = useMemo(() => [...new Set(jobIds)].sort().join(','), [jobIds])

  useEffect(() => {
    if (!enabled || key.length === 0) {
      setQuestions([])
      setAnswers(NO_ANSWERS)
      return
    }
    const mine = ++seq.current
    const ids = key.split(',')
    let cancelled = false
    setLoading(true)
    void (async () => {
      try {
        const q = await loadQuestions()
        if (cancelled || mine !== seq.current) return
        // No question anywhere: nothing to read on the jobs, nothing to draw.
        if (q.length === 0) {
          setQuestions([])
          setAnswers(NO_ANSWERS)
          return
        }
        const rows = await fetchAllRowsChunkedIn<AnswerMarkRow, string>(
          ids,
          (chunk, from, to) => db.from('stage_checklist_answers').select('fixture_id, question_id, pick, photo_file_name').in('job_id', chunk).order('id').range(from, to),
          'stageChecklistStates.answers',
        )
        if (cancelled || mine !== seq.current) return
        setQuestions(q)
        setAnswers(markAnswersFromRows(rows))
      } catch {
        if (cancelled || mine !== seq.current) return
        setQuestions([])
        setAnswers(NO_ANSWERS)
      } finally {
        if (!cancelled && mine === seq.current) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [key, enabled, tick])

  const reload = useCallback(() => setTick((t) => t + 1), [])
  return { questions, answersByFixture, loading, reload }
}
