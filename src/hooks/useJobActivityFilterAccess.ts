import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { ActivityFilterAccess } from '../lib/jobActivityFilter'
import {
  activityChipQuestions,
  settleActivityFilterAccess,
  type ActivityChipQuestion,
} from '../lib/jobs/jobActivityChipAccess'

type Answers = Partial<Record<ActivityChipQuestion['chip'], boolean>>

/** One job's answers per viewer role, kept for the visit so the chips do not blink in each time the job is opened. */
const answered = new Map<string, Answers>()

/**
 * Which of the Reports and Billing chips this viewer is drawn over one job's activity (`jobActivityChipAccess.ts`).
 * The office and the field roles are settled by the role with no read. A primary and a superintendent ask the
 * database's own gates once per job. A question that fails opens nothing: the chip is then left to the count.
 */
export function useJobActivityFilterAccess(
  jobId: string | null | undefined,
  role: string | null | undefined,
  /** The signed-in person, handed in by the host. Part of the key: two primaries on one phone share no answer. */
  viewerId: string | null | undefined,
): ActivityFilterAccess {
  const key = jobId && role && viewerId ? `${viewerId}:${role}:${jobId}` : null
  const [answers, setAnswers] = useState<{ key: string; answers: Answers } | null>(() => {
    const kept = key ? answered.get(key) : undefined
    return key && kept ? { key, answers: kept } : null
  })

  useEffect(() => {
    if (!key || !jobId) return
    const kept = answered.get(key)
    if (kept) {
      setAnswers({ key, answers: kept })
      return
    }
    const questions = activityChipQuestions(role, jobId)
    if (questions.length === 0) return
    let cancelled = false
    void Promise.all(
      questions.map(async (q): Promise<[ActivityChipQuestion['chip'], boolean | null]> => {
        try {
          const { data, error } = await supabase.rpc(q.rpc as never, q.args as never)
          return [q.chip, error ? null : data === true]
        } catch {
          return [q.chip, null]
        }
      }),
    ).then((pairs) => {
      const next: Answers = {}
      let whole = true
      for (const [chip, value] of pairs) {
        if (value == null) whole = false
        else next[chip] = value
      }
      // A failed question is asked again on the next open; a whole answer is kept.
      if (whole) answered.set(key, next)
      if (!cancelled) setAnswers({ key, answers: next })
    })
    return () => {
      cancelled = true
    }
  }, [key, jobId, role])

  return useMemo(
    () => settleActivityFilterAccess(role, answers && answers.key === key ? answers.answers : {}),
    [role, answers, key],
  )
}
