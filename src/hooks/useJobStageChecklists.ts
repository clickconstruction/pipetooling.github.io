/**
 * A checklist per stage (punch list #164, PR 3): one read behind the strip on Job Mode and the job window, and the
 * sheet it opens. The job's stages (`list_job_stage_progress`), every live question and the job's answers come in
 * together; `jobStageChecklists` reads each stage against its own. A failed read gives no rows, so the strip draws
 * nothing and the window stands as before: the checklists are an addition, never a gate on the screen. An answer the
 * sheet saves lands in the map at once, so the strip's count moves with the press.
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { jobStageChecklists, type JobStageChecklist, type JobStageRef, type StageChecklistQuestion } from '../lib/jobs/stageChecklist'
import { supabaseStageChecklistSheetIo, type JobAnswer, type StageChecklistSheetIo } from '../lib/jobs/stageChecklistSheetIo'
import { formatErrorMessage } from '../utils/errorHandling'

export interface JobStageChecklistsRead {
  /** The job's stages with their standing, in order; null while loading or after a failed read. */
  rows: JobStageChecklist[] | null
  stages: JobStageRef[]
  questions: StageChecklistQuestion[]
  answersByFixture: ReadonlyMap<string, JobAnswer[]>
  loading: boolean
  error: string | null
  /** Put a saved answer in place, so every reader moves with the press. */
  putAnswer: (answer: JobAnswer) => void
  reload: () => void
  /** The io the sheet writes through, the one this read came through. */
  io: StageChecklistSheetIo
}

const EMPTY: ReadonlyMap<string, JobAnswer[]> = new Map()

export function useJobStageChecklists(jobId: string | null | undefined, io?: StageChecklistSheetIo, rev = 0): JobStageChecklistsRead {
  const sheetIo = useMemo(() => io ?? supabaseStageChecklistSheetIo(), [io])
  const [loaded, setLoaded] = useState<{ jobId: string; stages: JobStageRef[]; questions: StageChecklistQuestion[]; answers: JobAnswer[] } | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [tick, setTick] = useState(0)

  useEffect(() => {
    let live = true
    if (!jobId) {
      setLoaded(null)
      return
    }
    setLoading(true)
    setError(null)
    Promise.all([sheetIo.stages(jobId), sheetIo.questions(), sheetIo.answers(jobId)]).then(
      ([stages, questions, answers]) => {
        if (!live) return
        setLoaded({ jobId, stages, questions, answers })
        setLoading(false)
      },
      (e: unknown) => {
        if (!live) return
        setLoaded(null)
        setError(formatErrorMessage(e, 'The stage checklists did not read.'))
        setLoading(false)
      },
    )
    return () => {
      live = false
    }
  }, [jobId, sheetIo, rev, tick])

  const current = loaded && jobId && loaded.jobId === jobId ? loaded : null
  const answersByFixture = useMemo(() => {
    if (!current) return EMPTY
    const map = new Map<string, JobAnswer[]>()
    for (const a of current.answers) map.set(a.fixtureId, [...(map.get(a.fixtureId) ?? []), a])
    return map
  }, [current])
  const rows = useMemo(() => (current ? jobStageChecklists(current.stages, current.questions, answersByFixture) : null), [current, answersByFixture])

  const putAnswer = useCallback((answer: JobAnswer) => {
    setLoaded((prev) => (prev ? { ...prev, answers: [...prev.answers.filter((a) => a.id !== answer.id), answer] } : prev))
  }, [])
  const reload = useCallback(() => setTick((t) => t + 1), [])

  return { rows, stages: current?.stages ?? [], questions: current?.questions ?? [], answersByFixture, loading, error, putAnswer, reload, io: sheetIo }
}
