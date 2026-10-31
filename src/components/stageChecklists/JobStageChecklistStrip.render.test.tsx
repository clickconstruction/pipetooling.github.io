// @vitest-environment jsdom
/**
 * The stage checklist strip and its sheet over a fake io (punch list #164, PR 3). A job whose kinds have no questions
 * draws nothing; a job with questions lists each stage with its standing; the sheet answers a question with one press,
 * the strip's count moves, a photo question waits on its photo, and Done lights once every question is answered. A
 * read that fails draws nothing. Made-up questions and a made-up job only.
 */
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { JobStageRef, StageChecklistQuestion } from '../../lib/jobs/stageChecklist'
import type { AnswerKey, JobAnswer, StageChecklistSheetIo } from '../../lib/jobs/stageChecklistSheetIo'
import { renderWithProviders } from '../../test/renderSmokeMocks'
import { JobStageChecklistStrip } from './JobStageChecklistStrip'

vi.mock('../../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../../test/renderSmokeMocks')
  return { supabase: makeSupabaseStub() }
})
vi.mock('../../hooks/useAuth', async () => {
  const { makeUseAuthValue, useAuthModuleMock } = await import('../../test/renderSmokeMocks')
  const value = () => makeUseAuthValue({ role: 'helpers', profileName: 'Jordan Vale' })
  return { ...useAuthModuleMock(), useAuth: value, useOptionalAuth: value }
})

const JOB = 'job-zz-1'
const STAGES: JobStageRef[] = [
  { fixtureId: 'f1', name: 'Rough In', sequenceOrder: 1 },
  { fixtureId: 'f2', name: 'Top Out', sequenceOrder: 2 },
  { fixtureId: 'f3', name: 'Trim Set', sequenceOrder: 3 },
]
const Q: StageChecklistQuestion[] = [
  { id: 'q1', kind: 'rough_in', order: 1, words: 'Did the water test hold?', asksPhoto: true },
  { id: 'q2', kind: 'rough_in', order: 2, words: 'Are the stub-outs marked?', asksPhoto: false },
]

let seq = 0
const answer = (key: AnswerKey, over: Partial<JobAnswer> = {}): JobAnswer => ({ id: over.id ?? `a${++seq}`, fixtureId: key.fixtureId, questionId: key.questionId, pick: null, note: '', photo: null, storagePath: null, reportPhotoId: null, ...over })

function fakeIo(over: Partial<StageChecklistSheetIo> = {}, answers: JobAnswer[] = [], questions: StageChecklistQuestion[] = Q): StageChecklistSheetIo {
  const kept = new Map<string, JobAnswer>(answers.map((a) => [`${a.fixtureId}|${a.questionId}`, a]))
  const row = (key: AnswerKey) => kept.get(`${key.fixtureId}|${key.questionId}`) ?? answer(key)
  return {
    stages: vi.fn(async () => STAGES),
    questions: vi.fn(async () => questions),
    answers: vi.fn(async () => [...kept.values()]),
    pick: vi.fn(async (key, pick) => {
      const next = { ...row(key), pick }
      kept.set(`${key.fixtureId}|${key.questionId}`, next)
      return next
    }),
    note: vi.fn(async (key, note) => {
      const next = { ...row(key), note }
      kept.set(`${key.fixtureId}|${key.questionId}`, next)
      return next
    }),
    photo: vi.fn(async (input) => {
      const next = { ...row(input), photo: { fileName: input.fileName, takenAt: input.takenAt, state: 'waiting' as const, driveFileId: null, failWhy: null }, storagePath: `${input.jobId}/x.jpg` }
      kept.set(`${input.fixtureId}|${input.questionId}`, next)
      return next
    }),
    photoUrl: vi.fn(async () => null),
    ...over,
  }
}

afterEach(() => cleanup())

describe('JobStageChecklistStrip', () => {
  it('draws nothing on a job whose kinds have no questions, and nothing on a failed read', async () => {
    const io = fakeIo({}, [], [])
    renderWithProviders(<JobStageChecklistStrip jobId={JOB} io={io} />)
    await waitFor(() => expect(io.answers).toHaveBeenCalled())
    expect(document.querySelector('[data-job-stage-checklists]')).toBeNull()
    cleanup()
    const broken = fakeIo({ answers: vi.fn(async () => { throw new Error('permission denied for table stage_checklist_answers') }) })
    renderWithProviders(<JobStageChecklistStrip jobId={JOB} io={broken} />)
    await waitFor(() => expect(broken.answers).toHaveBeenCalled())
    expect(document.querySelector('[data-job-stage-checklists]')).toBeNull()
  })

  it('lists the stages with questions and their standing, and leaves out the kind with none', async () => {
    renderWithProviders(<JobStageChecklistStrip jobId={JOB} io={fakeIo()} />)
    const row = await screen.findByRole('button', { name: 'Rough In checklist: 0 of 2 answered, not ready' })
    expect(row.getAttribute('data-stage-checklist-row')).toBe('not_ready')
    expect(screen.queryByText('Top Out')).toBeNull()
    expect(screen.queryByText('Trim Set')).toBeNull()
  })

  it('answers in the sheet press by press, waits on the photo, and lights Done once filled', async () => {
    const io = fakeIo()
    renderWithProviders(<JobStageChecklistStrip jobId={JOB} io={io} />)
    fireEvent.click(await screen.findByRole('button', { name: 'Rough In checklist: 0 of 2 answered, not ready' }))
    expect(await screen.findByText('1. Did the water test hold?')).toBeTruthy()
    const done = () => screen.getByRole('button', { name: 'Done' }) as HTMLButtonElement
    expect(done().disabled).toBe(true)

    // Yes on the photo question: the pick lands, and the row still waits on its photo.
    const first = screen.getByRole('group', { name: 'Did the water test hold?' })
    fireEvent.click(first.querySelector('button')!)
    await waitFor(() => expect(io.pick).toHaveBeenCalledWith({ jobId: JOB, fixtureId: 'f1', questionId: 'q1' }, 'yes', { userId: expect.any(String), name: 'Jordan Vale' }))
    expect(await screen.findByText('Take the photo this one asks for.')).toBeTruthy()
    expect(document.querySelector('[data-checklist-foot]')!.textContent).toBe('0 of 2 answered. Rough In reads not ready on the Pipeline until every question is answered.')

    // Not here on the second: answered, no photo asked.
    const second = screen.getByRole('group', { name: 'Are the stub-outs marked?' })
    fireEvent.click(second.querySelectorAll('button')[2]!)
    await waitFor(() => expect(document.querySelector('[data-checklist-foot]')!.textContent).toContain('1 of 2 answered.'))
    expect(done().disabled).toBe(true)

    // The photo through the io: the question is answered, the stage filled, the strip's row reads ready.
    const saved = await io.photo({ jobId: JOB, fixtureId: 'f1', questionId: 'q1', blob: new Blob(['x']), fileName: '2026-10-29 Rough In · Did the water test hold.jpg', takenAt: '2026-10-29T15:00:00.000Z' }, { userId: 'u', name: 'Jordan Vale' })
    expect(saved.photo?.state).toBe('waiting')
    cleanup()
    renderWithProviders(<JobStageChecklistStrip jobId={JOB} io={io} />)
    expect(await screen.findByRole('button', { name: 'Rough In checklist: Checklist filled' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Rough In checklist: Checklist filled' }))
    await waitFor(() => expect(document.querySelector('[data-checklist-foot]')!.textContent).toBe('2 of 2 answered. Rough In reads ready on the Pipeline.'))
    expect(done().disabled).toBe(false)
    expect(await screen.findByText('On its way to the customer’s Drive folder.')).toBeTruthy()
  })

  it('shows a photo taken on a field report (punch list #189, PR 6): the thumbnail from the report bucket, the words saying where it came from', async () => {
    const fromReport = answer(
      { jobId: JOB, fixtureId: 'f1', questionId: 'q1' },
      { id: 'a-r', pick: 'yes', reportPhotoId: 'rp1', photo: { fileName: '2026-10-31 Rough In · Did the water test hold.jpg', takenAt: '2026-10-31T15:00:00.000Z', state: 'waiting', driveFileId: null, failWhy: null } },
    )
    const io = fakeIo({ photoUrl: vi.fn(async () => 'blob:report-photo') }, [fromReport])
    renderWithProviders(<JobStageChecklistStrip jobId={JOB} io={io} />)
    fireEvent.click(await screen.findByRole('button', { name: 'Rough In checklist: 1 of 2 answered, not ready' }))
    expect(await screen.findByText('Taken on a field report. On its way to the customer’s Drive folder.')).toBeTruthy()
    await waitFor(() => expect(io.photoUrl).toHaveBeenCalledWith({ storagePath: null, reportPhotoId: 'rp1', jobId: JOB }))
    expect((await screen.findByRole('img', { name: '2026-10-31 Rough In · Did the water test hold.jpg' })).getAttribute('src')).toBe('blob:report-photo')
  })

  it('saves a note when the box is left', async () => {
    const io = fakeIo()
    renderWithProviders(<JobStageChecklistStrip jobId={JOB} io={io} />)
    fireEvent.click(await screen.findByRole('button', { name: 'Rough In checklist: 0 of 2 answered, not ready' }))
    const box = await screen.findByLabelText('Note on: Are the stub-outs marked?')
    fireEvent.change(box, { target: { value: 'Marked in orange ' } })
    fireEvent.blur(box)
    await waitFor(() => expect(io.note).toHaveBeenCalledWith({ jobId: JOB, fixtureId: 'f1', questionId: 'q2' }, 'Marked in orange', expect.anything()))
  })
})
