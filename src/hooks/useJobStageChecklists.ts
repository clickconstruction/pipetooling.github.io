/**
 * A checklist per stage (punch list #164, PR 3): one read behind the strip on Job Mode and the job window, and the
 * sheet it opens. The job's stages (`list_job_stage_progress`), every live question and the job's answers come in
 * together; `jobStageChecklists` reads each stage against its own. A failed read gives no rows, so the strip draws
 * nothing and the window stands as before: the checklists are an addition, never a gate on the screen. An answer the
 * sheet saves lands in the map at once, so the strip's count moves with the press. The questions read are the
 * company's and the items added on this job (#237), and an item added, skipped, moved or taken off lands the same way
 * (PR 1b). The job window holds two readers at once, the strip above its tabs and the Documents section inside them, so
 * a press that lands on one lands on every reader of the same job. Whether this person authors on the job is asked apart
 * from the read, only for the roles it can answer yes for, so no one's list waits on it.
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { jobStageChecklists, type JobStageChecklist, type JobStageRef, type StageChecklistQuestion } from '../lib/jobs/stageChecklist'
import { supabaseStageChecklistSheetIo, type JobAnswer, type StageChecklistSheetIo } from '../lib/jobs/stageChecklistSheetIo'
import { recoveryFailureFromError, type OfflineRecoveryLastError } from '../lib/offlineRecoveryState'
import { OUTBOX_LANDED_EVENT, type OutboxLandedDetail } from './useOutboxReplay'

export interface JobStageChecklistsRead {
  /** The job's stages with their standing, in order; null while loading or after a failed read. */
  rows: JobStageChecklist[] | null
  stages: JobStageRef[]
  questions: StageChecklistQuestion[]
  answersByFixture: ReadonlyMap<string, JobAnswer[]>
  loading: boolean
  error: string | null
  /** The failure with its kind, for a retry panel on a surface that shows one (the Documents read-out, #237). */
  failure: OfflineRecoveryLastError | null
  /** Put a saved answer in place, so every reader moves with the press. */
  putAnswer: (answer: JobAnswer) => void
  /** Put a check added for one of the job's stages in place (#237), so the count moves at once. */
  putQuestion: (question: StageChecklistQuestion) => void
  /** Put changed questions in place: a skip, a put back or a new order (PR 1b). */
  putQuestions: (questions: readonly StageChecklistQuestion[]) => void
  /** Take a retired item out of the list. */
  dropQuestion: (questionId: string) => void
  /** A job item now on the company's list: the company's row replaces it, and its answer follows (PR 1b). */
  promoteQuestion: (fromId: string, company: StageChecklistQuestion) => void
  /** The database's answer to who authors on this job; false until it answers, and for anyone it was not asked for. */
  mayAuthor: boolean
  reload: () => void
  /** The io the sheet writes through, the one this read came through. */
  io: StageChecklistSheetIo
}

const EMPTY: ReadonlyMap<string, JobAnswer[]> = new Map()

type Loaded = { jobId: string; stages: JobStageRef[]; questions: StageChecklistQuestion[]; answers: JobAnswer[] }

/** A press that landed on a job's checklists. */
type ChecklistChange = { answer: JobAnswer } | { questions: readonly StageChecklistQuestion[] } | { droppedId: string } | { promotedFromId: string; company: StageChecklistQuestion }

function withChange(loaded: Loaded, change: ChecklistChange): Loaded {
  if ('answer' in change) return { ...loaded, answers: [...loaded.answers.filter((a) => a.id !== change.answer.id), change.answer] }
  if ('questions' in change) {
    const landed = new Set(change.questions.map((q) => q.id))
    return { ...loaded, questions: [...loaded.questions.filter((q) => !landed.has(q.id)), ...change.questions] }
  }
  if ('promotedFromId' in change) {
    return {
      ...loaded,
      questions: [...loaded.questions.filter((q) => q.id !== change.promotedFromId), change.company],
      answers: loaded.answers.map((a) => (a.questionId === change.promotedFromId ? { ...a, questionId: change.company.id } : a)),
    }
  }
  return { ...loaded, questions: loaded.questions.filter((q) => q.id !== change.droppedId) }
}

/** The mounted readers of each job, so a press that lands on one lands on them all. */
const readers = new Map<string, Set<(change: ChecklistChange) => void>>()

export function useJobStageChecklists(jobId: string | null | undefined, io?: StageChecklistSheetIo, rev = 0, askMayAuthor = false): JobStageChecklistsRead {
  const sheetIo = useMemo(() => io ?? supabaseStageChecklistSheetIo(), [io])
  const [mayAuthor, setMayAuthor] = useState(false)
  const [loaded, setLoaded] = useState<Loaded | null>(null)
  const [loading, setLoading] = useState(false)
  const [failure, setFailure] = useState<OfflineRecoveryLastError | null>(null)
  const [tick, setTick] = useState(0)

  useEffect(() => {
    let live = true
    if (!jobId) {
      setLoaded(null)
      return
    }
    setLoading(true)
    setFailure(null)
    Promise.all([sheetIo.stages(jobId), sheetIo.questions(jobId), sheetIo.answers(jobId)]).then(
      ([stages, questions, answers]) => {
        if (!live) return
        setLoaded({ jobId, stages, questions, answers })
        setLoading(false)
      },
      (e: unknown) => {
        if (!live) return
        setLoaded(null)
        setFailure(recoveryFailureFromError(e, 'The stage checklists did not read.'))
        setLoading(false)
      },
    )
    return () => {
      live = false
    }
  }, [jobId, sheetIo, rev, tick])

  useEffect(() => {
    let live = true
    setMayAuthor(false)
    if (!jobId || !askMayAuthor) return
    sheetIo.mayAuthor(jobId).then(
      (yes) => {
        if (live) setMayAuthor(yes)
      },
      () => {
        if (live) setMayAuthor(false)
      },
    )
    return () => {
      live = false
    }
  }, [jobId, sheetIo, askMayAuthor])

  useEffect(() => {
    if (!jobId) return
    const take = (change: ChecklistChange) => setLoaded((prev) => (prev && prev.jobId === jobId ? withChange(prev, change) : prev))
    const here = readers.get(jobId) ?? new Set<(change: ChecklistChange) => void>()
    readers.set(jobId, here.add(take))
    return () => {
      here.delete(take)
      if (here.size === 0) readers.delete(jobId)
    }
  }, [jobId])

  const current = loaded && jobId && loaded.jobId === jobId ? loaded : null
  const answersByFixture = useMemo(() => {
    if (!current) return EMPTY
    const map = new Map<string, JobAnswer[]>()
    for (const a of current.answers) map.set(a.fixtureId, [...(map.get(a.fixtureId) ?? []), a])
    return map
  }, [current])
  const rows = useMemo(() => (current ? jobStageChecklists(current.stages, current.questions, answersByFixture) : null), [current, answersByFixture])

  const announce = useCallback(
    (change: ChecklistChange) => {
      if (jobId) readers.get(jobId)?.forEach((take) => take(change))
    },
    [jobId],
  )
  const putAnswer = useCallback((answer: JobAnswer) => announce({ answer }), [announce])
  const putQuestion = useCallback((question: StageChecklistQuestion) => announce({ questions: [question] }), [announce])
  const putQuestions = useCallback((questions: readonly StageChecklistQuestion[]) => announce({ questions }), [announce])
  const dropQuestion = useCallback((questionId: string) => announce({ droppedId: questionId }), [announce])
  const promoteQuestion = useCallback((fromId: string, company: StageChecklistQuestion) => announce({ promotedFromId: fromId, company }), [announce])
  const reload = useCallback(() => setTick((t) => t + 1), [])

  // A signed answer that waited on the phone landed (#237 PR 2): the job's readers read again, so the row reads signed.
  useEffect(() => {
    if (!jobId || typeof window === 'undefined') return
    const onLanded = (e: Event) => {
      const detail = (e as CustomEvent<OutboxLandedDetail>).detail
      if (detail?.kind === 'checklist-sign') reload()
    }
    window.addEventListener(OUTBOX_LANDED_EVENT, onLanded)
    return () => window.removeEventListener(OUTBOX_LANDED_EVENT, onLanded)
  }, [jobId, reload])

  return { rows, stages: current?.stages ?? [], questions: current?.questions ?? [], answersByFixture, loading, error: failure?.message ?? null, failure, putAnswer, putQuestion, putQuestions, dropQuestion, promoteQuestion, mayAuthor, reload, io: sheetIo }
}
