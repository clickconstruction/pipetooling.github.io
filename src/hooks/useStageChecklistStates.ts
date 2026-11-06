/**
 * A checklist per stage (punch list #164, PR 4): the board's read behind the Pipeline's not-ready mark. One read of
 * the company's live questions, one chunked read of the items added on the board's jobs (#237), one of the questions
 * skipped on them (PR 1b) and one of the answers on those jobs, as `useJobCrewPositions` reads the crew: fail-soft, so a missing table (a client ahead of the push), a refused read or any error is an empty read and
 * the row draws what it drew before. Each row turns the read into its own marks with `stageChecklistMarks`. The open
 * stage-check requests on those jobs read beside the answers (#245, PR 3), on their own fail-soft, so a refused read of
 * the inbox never costs the board its marks.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { fetchAllRowsChunkedIn } from '../lib/supabasePaging'
import { withSkips, type StageChecklistAnswer, type StageChecklistQuestion } from '../lib/jobs/stageChecklist'
import { loadJobItems, loadJobSkips, loadQuestions } from '../lib/jobs/stageChecklistIo'
import { loadOpenStageCheckCounts } from '../lib/jobs/stageCheckDispatchIo'
import { NO_WITH_DISPATCH } from '../lib/jobs/stageChecklistMarks'

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
  /** The open stage-check requests by fixture id (#245, PR 3): the flag on the mark. */
  withDispatchByFixture: ReadonlyMap<string, number>
  loading: boolean
  reload: () => void
}

export function useStageChecklistStates(jobIds: ReadonlyArray<string>, enabled: boolean): StageChecklistStates {
  const [questions, setQuestions] = useState<readonly StageChecklistQuestion[]>([])
  const [answersByFixture, setAnswers] = useState<ReadonlyMap<string, readonly StageChecklistAnswer[]>>(NO_ANSWERS)
  const [withDispatchByFixture, setWithDispatch] = useState<ReadonlyMap<string, number>>(NO_WITH_DISPATCH)
  const [loading, setLoading] = useState(false)
  const [tick, setTick] = useState(0)
  const seq = useRef(0)
  const key = useMemo(() => [...new Set(jobIds)].sort().join(','), [jobIds])

  useEffect(() => {
    if (!enabled || key.length === 0) {
      setQuestions([])
      setAnswers(NO_ANSWERS)
      setWithDispatch(NO_WITH_DISPATCH)
      return
    }
    const mine = ++seq.current
    const ids = key.split(',')
    let cancelled = false
    setLoading(true)
    void (async () => {
      try {
        // The company's questions, then the items added on the board's jobs (#237): one chunked read on a partial index.
        const [company, items] = await Promise.all([loadQuestions(), loadJobItems(ids)])
        if (cancelled || mine !== seq.current) return
        // A skip leaves a company question off one stage (PR 1b), so a company with none has nothing to read.
        const skips = company.length > 0 ? await loadJobSkips(ids) : []
        if (cancelled || mine !== seq.current) return
        const q = withSkips([...company, ...items], skips)
        // No question anywhere: nothing to read on the jobs, nothing to draw.
        if (q.length === 0) {
          setQuestions([])
          setAnswers(NO_ANSWERS)
          setWithDispatch(NO_WITH_DISPATCH)
          return
        }
        // The answers, and beside them the checks with Dispatch (#245, PR 3); that read fails soft on its own.
        const [rows, open] = await Promise.all([
          fetchAllRowsChunkedIn<AnswerMarkRow, string>(
            ids,
            (chunk, from, to) => db.from('stage_checklist_answers').select('fixture_id, question_id, pick, photo_file_name').in('job_id', chunk).order('id').range(from, to),
            'stageChecklistStates.answers',
          ),
          loadOpenStageCheckCounts([...ids]).catch(() => NO_WITH_DISPATCH),
        ])
        if (cancelled || mine !== seq.current) return
        setQuestions(q)
        setAnswers(markAnswersFromRows(rows))
        setWithDispatch(open)
      } catch {
        if (cancelled || mine !== seq.current) return
        setQuestions([])
        setAnswers(NO_ANSWERS)
        setWithDispatch(NO_WITH_DISPATCH)
      } finally {
        if (!cancelled && mine === seq.current) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [key, enabled, tick])

  const reload = useCallback(() => setTick((t) => t + 1), [])
  return { questions, answersByFixture, withDispatchByFixture, loading, reload }
}
