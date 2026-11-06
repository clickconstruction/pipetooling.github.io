// @vitest-environment jsdom
/**
 * The board's read behind the Pipeline's mark (punch list #237, PR 1b): a question skipped on one job's stage leaves that
 * stage's count on the Pipeline too, and a company with no questions reads no skips. Made-up questions on made-up jobs.
 */
import { renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { StageChecklistQuestion } from '../lib/jobs/stageChecklist'
import { stageChecklistMarks } from '../lib/jobs/stageChecklistMarks'

const io = vi.hoisted(() => ({ loadQuestions: vi.fn(), loadJobItems: vi.fn(), loadJobSkips: vi.fn(), answers: vi.fn(), withDispatch: vi.fn() }))

vi.mock('../lib/supabase', () => ({ supabase: { from: () => ({}) } }))
vi.mock('../lib/jobs/stageChecklistIo', () => ({ loadQuestions: io.loadQuestions, loadJobItems: io.loadJobItems, loadJobSkips: io.loadJobSkips }))
vi.mock('../lib/supabasePaging', () => ({ fetchAllRowsChunkedIn: io.answers }))
vi.mock('../lib/jobs/stageCheckDispatchIo', () => ({ loadOpenStageCheckCounts: io.withDispatch }))

import { useStageChecklistStates } from './useStageChecklistStates'

const Q: StageChecklistQuestion[] = [
  { id: 't1', kind: 'trim_set', order: 1, words: 'Did the final water test hold?', asksPhoto: false },
  { id: 't2', kind: 'trim_set', order: 2, words: 'Are the cleanouts capped?', asksPhoto: false },
]

afterEach(() => {
  vi.clearAllMocks()
})

beforeEach(() => {
  io.withDispatch.mockResolvedValue(new Map())
})

describe('useStageChecklistStates', () => {
  it('counts a stage without the question skipped on it, and the other job’s stage with it', async () => {
    io.loadQuestions.mockResolvedValue(Q)
    io.loadJobItems.mockResolvedValue([])
    io.loadJobSkips.mockResolvedValue([{ id: 's1', fixtureId: 'f-a', questionId: 't1', why: 'Slab on grade', by: 'Pat Sample', byId: 'u-pat', at: null }])
    io.answers.mockResolvedValue([
      { fixture_id: 'f-a', question_id: 't2', pick: 'yes', photo_file_name: null },
      { fixture_id: 'f-b', question_id: 't2', pick: 'yes', photo_file_name: null },
    ])
    const { result } = renderHook(() => useStageChecklistStates(['job-a', 'job-b'], true))
    await waitFor(() => expect(result.current.questions).toHaveLength(2))
    expect(io.loadJobSkips).toHaveBeenCalledWith(['job-a', 'job-b'])
    const marks = stageChecklistMarks(
      [
        { id: 'f-a', name: 'Trim Set' },
        { id: 'f-b', name: 'Trim Set' },
      ],
      result.current.questions,
      result.current.answersByFixture,
    )!
    expect(marks.get('f-a')).toMatchObject({ standing: 'ready', asked: 1, answered: 1 })
    expect(marks.get('f-b')).toMatchObject({ standing: 'not_ready', asked: 2, answered: 1 })
  })

  it('reads no skips for a company with no questions', async () => {
    io.loadQuestions.mockResolvedValue([])
    io.loadJobItems.mockResolvedValue([{ ...Q[0]!, id: 'j1', fixtureId: 'f-a' }])
    io.answers.mockResolvedValue([])
    const { result } = renderHook(() => useStageChecklistStates(['job-a'], true))
    await waitFor(() => expect(result.current.questions).toHaveLength(1))
    expect(io.loadJobSkips).not.toHaveBeenCalled()
  })

  it('reads the checks with Dispatch beside the answers, and a refused read of them keeps the marks (#245, PR 3)', async () => {
    io.loadQuestions.mockResolvedValue(Q)
    io.loadJobItems.mockResolvedValue([])
    io.loadJobSkips.mockResolvedValue([])
    io.answers.mockResolvedValue([{ fixture_id: 'f-a', question_id: 't1', pick: 'yes', photo_file_name: null }])
    io.withDispatch.mockResolvedValue(new Map([['f-a', 1]]))
    const { result } = renderHook(() => useStageChecklistStates(['job-a'], true))
    await waitFor(() => expect(result.current.withDispatchByFixture.get('f-a')).toBe(1))
    expect(io.withDispatch).toHaveBeenCalledWith(['job-a'])
    const marks = stageChecklistMarks([{ id: 'f-a', name: 'Trim Set' }], result.current.questions, result.current.answersByFixture, result.current.withDispatchByFixture)!
    expect(marks.get('f-a')).toMatchObject({ standing: 'not_ready', withDispatch: 1 })

    io.withDispatch.mockRejectedValue(new Error('refused'))
    const again = renderHook(() => useStageChecklistStates(['job-b'], true))
    await waitFor(() => expect(again.result.current.questions).toHaveLength(2))
    expect(again.result.current.withDispatchByFixture.size).toBe(0)
  })
})
