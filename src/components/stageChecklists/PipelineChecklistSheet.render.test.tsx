// @vitest-environment jsdom
/**
 * The Pipeline row's checklists sheet over a fake io (punch list #246, PR 1): the title with the job's label, the
 * summary line, each stage with its chip, a ready stage folded to its chip and opened by a press on its name, the
 * open stage's rows with Yes · No · Not here answering in place and the chip moving with the press, the office's
 * + Add a check, Open on the job and Close, a read that fails with its reason and Retry, and a job with no stage that
 * takes a checklist. Made-up names and questions on a made-up job.
 */
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { JobStageRef, StageChecklistQuestion } from '../../lib/jobs/stageChecklist'
import type { AnswerKey, JobAnswer, StageChecklistSheetIo } from '../../lib/jobs/stageChecklistSheetIo'
import { renderWithProviders } from '../../test/renderSmokeMocks'
import { PipelineChecklistSheet } from './PipelineChecklistSheet'

vi.mock('../../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../../test/renderSmokeMocks')
  return { supabase: makeSupabaseStub() }
})
let authRole = 'assistant'
vi.mock('../../hooks/useAuth', async () => {
  const { makeUseAuthValue, useAuthModuleMock } = await import('../../test/renderSmokeMocks')
  const value = () => makeUseAuthValue({ role: authRole, profileName: 'Jo Sample', user: { id: 'u-jo', email: 'smoke@example.com' } })
  return { ...useAuthModuleMock(), useAuth: value, useOptionalAuth: value }
})

const JOB = { id: 'job-zz-1', label: 'JP1088 · ZZ TEST Riders Walk' }
const STAGES: JobStageRef[] = [
  { fixtureId: 'f1', name: 'Rough In', sequenceOrder: 1 },
  { fixtureId: 'f3', name: 'Trim Set', sequenceOrder: 3 },
  { fixtureId: 'f9', name: 'Permit', sequenceOrder: 0 },
]
const Q: StageChecklistQuestion[] = [
  { id: 'q1', kind: 'rough_in', order: 1, words: 'Is the water test on?', asksPhoto: false },
  { id: 't1', kind: 'trim_set', order: 1, words: 'Did the final water test hold?', asksPhoto: false },
  { id: 't2', kind: 'trim_set', order: 2, words: 'Are the cleanouts capped and marked?', asksPhoto: false },
]
const answer = (key: AnswerKey, over: Partial<JobAnswer> = {}): JobAnswer => ({ id: `a-${key.questionId}`, fixtureId: key.fixtureId, questionId: key.questionId, pick: null, note: '', photo: null, answeredBy: '', answeredAt: null, storagePath: null, reportPhotoId: null, ...over })
const ANSWERS: JobAnswer[] = [
  answer({ jobId: JOB.id, fixtureId: 'f1', questionId: 'q1' }, { pick: 'yes', answeredBy: 'Luis Ortega', answeredAt: '2026-10-14T20:30:00.000Z' }),
  answer({ jobId: JOB.id, fixtureId: 'f3', questionId: 't1' }, { pick: 'yes', answeredBy: 'Luis Ortega', answeredAt: '2026-11-01T15:14:00.000Z' }),
]

function fakeIo(over: Partial<StageChecklistSheetIo> = {}, stages: JobStageRef[] = STAGES, questions: StageChecklistQuestion[] = Q, answers: JobAnswer[] = ANSWERS): StageChecklistSheetIo {
  return {
    stages: vi.fn(async () => stages),
    questions: vi.fn(async () => [...questions]),
    answers: vi.fn(async () => [...answers]),
    pick: vi.fn(async (key, pick, who) => answer(key, { pick, answeredBy: who.name, answeredAt: '2026-11-02T16:00:00.000Z' })),
    note: vi.fn(async () => { throw new Error('not here') }),
    photo: vi.fn(async () => { throw new Error('not here') }),
    photoUrl: vi.fn(async () => null),
    sign: vi.fn(async () => { throw new Error('not here') }),
    takeBack: vi.fn(async () => { throw new Error('not here') }),
    inkUrl: vi.fn(async () => null),
    records: vi.fn(async () => []),
    amend: vi.fn(async () => { throw new Error('not here') }),
    addItem: vi.fn(async () => { throw new Error('not here') }),
    retireItem: vi.fn(async () => undefined),
    mayAuthor: vi.fn(async () => false),
    skip: vi.fn(async () => { throw new Error('not here') }),
    putBack: vi.fn(async () => undefined),
    reorder: vi.fn(async () => undefined),
    promote: vi.fn(async () => { throw new Error('not here') }),
    ...over,
  }
}

afterEach(() => {
  cleanup()
  authRole = 'assistant'
})

const stageSection = (fixtureId: string) => document.querySelector(`[data-pipeline-checklist-stage="${fixtureId}"]`) as HTMLElement

describe('PipelineChecklistSheet', () => {
  it('titles the sheet with the job, sums the stages, folds the ready one and opens the stage with a question left', async () => {
    renderWithProviders(<PipelineChecklistSheet job={JOB} io={fakeIo()} onClose={vi.fn()} onOpenDocuments={vi.fn()} />)
    expect(screen.getByText('Checklists on JP1088 · ZZ TEST Riders Walk')).toBeTruthy()
    await screen.findByText('1 of 2 stages ready · nothing added on this job')
    // Rough In is filled: its chip stands and its rows are folded away, with the hint.
    const rough = stageSection('f1')
    expect(rough.getAttribute('data-standing')).toBe('ready')
    expect(within(rough).getByText('Ready · 1 of 1')).toBeTruthy()
    // The fold lands a render after the rows.
    expect(await within(rough).findByText('Press the name to open the rows.')).toBeTruthy()
    expect(rough.querySelector('[data-stage-checklist-inline]')).toBeNull()
    // Trim Set has a question left: its rows stand open, the next one with its three presses.
    const trim = stageSection('f3')
    expect(trim.getAttribute('data-standing')).toBe('not_ready')
    expect(within(trim).getByText('Not ready · 1 of 2')).toBeTruthy()
    const open = trim.querySelector('[data-checklist-row="open"]') as HTMLElement
    expect(open.textContent).toContain('Are the cleanouts capped and marked?')
    expect(within(open).getByRole('button', { name: 'Yes' })).toBeTruthy()
    expect(within(open).getByRole('button', { name: 'Not here' })).toBeTruthy()
    // Permit takes no checklist and is not listed.
    expect(document.querySelector('[data-pipeline-checklist-stage="f9"]')).toBeNull()
    // The office adds from here too.
    expect(within(trim).getByRole('button', { name: '+ Add a check for Trim Set' })).toBeTruthy()
  })

  it('a press on a folded stage’s name opens its rows', async () => {
    renderWithProviders(<PipelineChecklistSheet job={JOB} io={fakeIo()} onClose={vi.fn()} onOpenDocuments={vi.fn()} />)
    await screen.findByText('Ready · 1 of 1')
    fireEvent.click(within(stageSection('f1')).getByRole('button', { name: 'Rough In' }))
    await waitFor(() => expect(stageSection('f1').querySelector('[data-stage-checklist-inline]')).toBeTruthy())
    expect(stageSection('f1').textContent).toContain('Is the water test on?')
  })

  it('answers in place under the viewer’s name, and the stage’s chip moves with the press', async () => {
    const io = fakeIo()
    renderWithProviders(<PipelineChecklistSheet job={JOB} io={io} onClose={vi.fn()} onOpenDocuments={vi.fn()} />)
    await screen.findByText('Not ready · 1 of 2')
    const open = stageSection('f3').querySelector('[data-checklist-row="open"]') as HTMLElement
    fireEvent.click(within(open).getByRole('button', { name: 'Yes' }))
    await waitFor(() => expect(io.pick).toHaveBeenCalledTimes(1))
    expect(io.pick).toHaveBeenCalledWith({ jobId: JOB.id, fixtureId: 'f3', questionId: 't2' }, 'yes', { userId: 'u-jo', name: 'Jo Sample' })
    await screen.findByText('Ready · 2 of 2')
    expect(screen.getByText('2 of 2 stages ready · nothing added on this job')).toBeTruthy()
    expect(stageSection('f3').getAttribute('data-standing')).toBe('ready')
  })

  it('Open on the job and Close fire their presses', async () => {
    const onClose = vi.fn()
    const onOpenDocuments = vi.fn()
    renderWithProviders(<PipelineChecklistSheet job={JOB} io={fakeIo()} onClose={onClose} onOpenDocuments={onOpenDocuments} />)
    await screen.findByText('Ready · 1 of 1')
    fireEvent.click(screen.getByRole('button', { name: 'Open on the job ›' }))
    expect(onOpenDocuments).toHaveBeenCalledTimes(1)
    // The foot's Close; the shell's ✕ is named Close too.
    fireEvent.click(screen.getByText('Close', { selector: 'button' }))
    expect(onClose).toHaveBeenCalledTimes(1)
    expect(screen.getByText('Each press saves by itself, under your name.')).toBeTruthy()
  })

  it('a read that fails says why and offers Retry', async () => {
    // A refusal reads its reason with no Retry; a lost signal offers Retry.
    const refused = fakeIo({ stages: vi.fn(async () => { throw new Error('permission denied for table stage_checklist_answers') }) })
    const first = renderWithProviders(<PipelineChecklistSheet job={JOB} io={refused} onClose={vi.fn()} onOpenDocuments={vi.fn()} />)
    expect(await screen.findByText(/permission denied for table stage_checklist_answers/)).toBeTruthy()
    expect(screen.queryByRole('button', { name: /Retry/ })).toBeNull()
    first.unmount()
    const lost = fakeIo({ stages: vi.fn(async () => { throw new TypeError('Failed to fetch') }) })
    renderWithProviders(<PipelineChecklistSheet job={JOB} io={lost} onClose={vi.fn()} onOpenDocuments={vi.fn()} />)
    expect(await screen.findByRole('button', { name: /Retry/ })).toBeTruthy()
  })

  it('a job with no stage that takes a checklist names the next press', async () => {
    const onOpenDocuments = vi.fn()
    renderWithProviders(<PipelineChecklistSheet job={JOB} io={fakeIo({}, [{ fixtureId: 'f9', name: 'Permit', sequenceOrder: 0 }], [], [])} onClose={vi.fn()} onOpenDocuments={onOpenDocuments} />)
    await screen.findByText('No stages take a checklist on this job.')
    fireEvent.click(screen.getByRole('button', { name: 'Open on the job' }))
    expect(onOpenDocuments).toHaveBeenCalledTimes(1)
  })

  it('the crew sees the rows and the presses, and no add box', async () => {
    authRole = 'technician'
    renderWithProviders(<PipelineChecklistSheet job={JOB} io={fakeIo()} onClose={vi.fn()} onOpenDocuments={vi.fn()} />)
    await screen.findByText('Not ready · 1 of 2')
    expect(within(stageSection('f3')).getByRole('button', { name: 'Yes' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: '+ Add a check for Trim Set' })).toBeNull()
  })
})
