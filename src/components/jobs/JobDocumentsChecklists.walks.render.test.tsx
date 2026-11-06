// @vitest-environment jsdom
/**
 * What the walks added to the Documents read-out, over a fake io (punch list #237, PR 1b): the named groups, Skip on this
 * job with its reason and Put it back, the two-press Add to the company's list with the answer following the check, ▲ and
 * ▼ on the job's own checks, the plan-sheet chip and the why, the add box staying open, and a primary who only reads.
 * Made-up names and questions on a made-up job.
 */
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { JobStageRef, StageChecklistQuestion } from '../../lib/jobs/stageChecklist'
import type { AnswerKey, JobAnswer, StageChecklistSheetIo } from '../../lib/jobs/stageChecklistSheetIo'
import { renderWithProviders } from '../../test/renderSmokeMocks'
import { JobStageChecklistStrip } from '../stageChecklists/JobStageChecklistStrip'
import { JobDocumentsChecklists } from './JobDocumentsChecklists'

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

const PLANS = 'https://drive.example.com/plans'
const JOB = { id: 'job-zz-1', job_plans_link: PLANS }
const WHO = { userId: 'u-jo', name: 'Jo Sample' }
const STAGES: JobStageRef[] = [{ fixtureId: 'f3', name: 'Trim Set', sequenceOrder: 3 }]
const T1: StageChecklistQuestion = { id: 't1', kind: 'trim_set', order: 1, words: 'Did the final water test hold?', asksPhoto: false }
const T2: StageChecklistQuestion = { id: 't2', kind: 'trim_set', order: 2, words: 'Are the cleanouts capped?', asksPhoto: false }
const item = (id: string, order: number, over: Partial<StageChecklistQuestion> = {}): StageChecklistQuestion => ({ id, kind: 'trim_set', order, words: `Is ${id} set?`, asksPhoto: false, fixtureId: 'f3', addedById: 'u-pat', addedBy: 'Pat Sample', addedAt: '2026-11-02T15:00:00.000Z', ...over })
const answer = (key: Pick<AnswerKey, 'fixtureId' | 'questionId'>, over: Partial<JobAnswer> = {}): JobAnswer => ({ id: `a-${key.questionId}`, fixtureId: key.fixtureId, questionId: key.questionId, pick: 'yes', note: '', photo: null, answeredBy: 'Luis Ortega', answeredAt: '2026-11-02T15:14:00.000Z', storagePath: null, reportPhotoId: null, ...over })

function fakeIo(over: Partial<StageChecklistSheetIo> = {}, questions: StageChecklistQuestion[] = [T1, T2, item('j1', 1), item('j2', 2)], answers: JobAnswer[] = []): StageChecklistSheetIo {
  const live = [...questions]
  let seq = 0
  return {
    stages: vi.fn(async () => STAGES),
    questions: vi.fn(async () => [...live]),
    answers: vi.fn(async () => [...answers]),
    pick: vi.fn(async () => { throw new Error('not here') }),
    note: vi.fn(async () => { throw new Error('not here') }),
    photo: vi.fn(async () => { throw new Error('not here') }),
    photoUrl: vi.fn(async () => null),
    sign: vi.fn(async () => { throw new Error('not here') }),
    takeBack: vi.fn(async () => { throw new Error('not here') }),
    inkUrl: vi.fn(async () => null),
    records: vi.fn(async () => []),
    amend: vi.fn(async () => { throw new Error('not here') }),
    addItem: vi.fn(async (input, who) => {
      const q: StageChecklistQuestion = { id: `j-new-${++seq}`, kind: input.kind, order: input.order ?? 0, words: input.words, asksPhoto: input.asksPhoto, fixtureId: input.fixtureId, addedById: who.userId, addedBy: who.name, addedAt: '2026-11-02T16:00:00.000Z', sheet: input.sheet || null, why: input.why || null }
      live.push(q)
      return q
    }),
    retireItem: vi.fn(async () => undefined),
    mayAuthor: vi.fn(async () => false),
    skip: vi.fn(async (input, who) => ({ id: `s-${input.questionId}`, fixtureId: input.fixtureId, questionId: input.questionId, why: input.why.trim(), by: who.name, byId: who.userId, at: '2026-11-02T15:14:00.000Z' })),
    putBack: vi.fn(async () => undefined),
    reorder: vi.fn(async () => undefined),
    promote: vi.fn(async (id) => ({ id: `company-${id}`, kind: 'trim_set' as const, order: 3, words: `Is ${id} set?`, asksPhoto: false, fixtureId: null, addedById: 'u-jo', addedBy: '', addedAt: '2026-11-02T16:30:00.000Z', sheet: null, why: null })),
    ...over,
  }
}

afterEach(() => {
  cleanup()
  authRole = 'assistant'
  vi.restoreAllMocks()
})

const section = () => screen.getByTestId('job-documents-checklists')
const rows = () => within(section()).getAllByTestId('job-documents-checklist-row')
const summary = () => screen.getByTestId('job-documents-checklists-summary').textContent
const ready = () => screen.findByTestId('job-documents-checklists-summary')

describe('the named groups', () => {
  it('draws the company’s questions and the job’s checks apart, numbered through, each group with its count', async () => {
    renderWithProviders(<JobDocumentsChecklists job={JOB} io={fakeIo({}, [T1, T2, item('j1', 1)], [answer({ fixtureId: 'f3', questionId: 't1' })])} />)
    await ready()
    const text = section().textContent ?? ''
    expect(text.indexOf("The company's questions1 of 2")).toBeGreaterThan(-1)
    expect(text.indexOf('Added for this job0 of 1')).toBeGreaterThan(text.indexOf('2. Are the cleanouts capped?'))
    expect(text.indexOf('3. Is j1 set?')).toBeGreaterThan(text.indexOf('Added for this job'))
    expect(screen.queryByText('this job')).toBeNull()
  })

  it('names an empty job group and draws the first check’s door only on a stage with no list at all', async () => {
    renderWithProviders(<JobDocumentsChecklists job={JOB} io={fakeIo({}, [T1])} />)
    await ready()
    expect(screen.getByText("Nothing added for this job's Trim Set.")).toBeTruthy()
    expect(screen.getByRole('button', { name: '+ Add a check for Trim Set' })).toBeTruthy()
  })
})

describe('Skip on this job', () => {
  it('asks for its reason, moves the question to the skipped line, and Put it back returns it; every count follows', async () => {
    const io = fakeIo()
    renderWithProviders(
      <>
        <JobStageChecklistStrip jobId={JOB.id} io={io} />
        <JobDocumentsChecklists job={JOB} io={io} />
      </>,
    )
    await ready()
    expect(summary()).toBe('0 of 1 stage ready · 2 items added on this job')
    fireEvent.click(screen.getByRole('button', { name: 'Skip on this job: Did the final water test hold?' }))
    const asking = await screen.findByTestId('job-documents-checklist-skip')
    fireEvent.click(within(asking).getByRole('button', { name: 'Skip on this job' }))
    expect(await within(asking).findByText('Say why this question is not on this job.')).toBeTruthy()
    expect(io.skip).not.toHaveBeenCalled()
    fireEvent.change(within(asking).getByLabelText('Why this question is not on this job'), { target: { value: 'The owner took these out' } })
    fireEvent.click(within(asking).getByRole('button', { name: 'Skip on this job' }))
    await waitFor(() => expect(io.skip).toHaveBeenCalledWith({ jobId: JOB.id, fixtureId: 'f3', questionId: 't1', why: 'The owner took these out' }, WHO))

    expect(await screen.findByText('Skipped on this job. Trim Set is now 0 of 3.')).toBeTruthy()
    const line = screen.getByTestId('job-documents-checklist-skipped')
    expect(line.textContent).toContain('Skipped on this job')
    expect(line.textContent).toContain('Did the final water test hold?')
    expect(line.textContent).toContain('Jo Sample · Nov 2 · 9:14 am · The owner took these out')
    expect(rows()).toHaveLength(3)
    expect(summary()).toBe('0 of 1 stage ready · 2 items added on this job · 1 skipped')
    expect(screen.getByText('Not ready · 0 of 3')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Trim Set checklist: 0 of 3 answered, not ready' })).toBeTruthy()

    fireEvent.click(within(line).getByRole('button', { name: 'Put it back: Did the final water test hold?' }))
    await waitFor(() => expect(io.putBack).toHaveBeenCalledWith('s-t1', WHO))
    expect(await screen.findByText('Put back. Trim Set is now 0 of 4.')).toBeTruthy()
    expect(screen.queryByTestId('job-documents-checklist-skipped')).toBeNull()
    expect(rows()).toHaveLength(4)
  })

  it('draws the skip on the company’s questions alone, and reads a stage with every question skipped', async () => {
    const skipped = [T1, T2].map((q) => ({ ...q, skips: [{ id: `s-${q.id}`, fixtureId: 'f3', why: 'Slab on grade', by: 'Pat Sample', byId: 'u-pat', at: '2026-11-02T15:14:00.000Z' }] }))
    renderWithProviders(<JobDocumentsChecklists job={JOB} io={fakeIo({}, skipped)} />)
    expect(await screen.findByText('Nothing to answer · 2 skipped')).toBeTruthy()
    expect(screen.queryByText(/No questions yet/)).toBeNull()
    expect(screen.getByRole('button', { name: '+ Add a check for Trim Set' })).toBeTruthy()
    cleanup()
    renderWithProviders(<JobDocumentsChecklists job={JOB} io={fakeIo()} />)
    await ready()
    expect(screen.queryByRole('button', { name: 'Skip on this job: Is j1 set?' })).toBeNull()
    expect(screen.getByRole('button', { name: 'Skip on this job: Are the cleanouts capped?' })).toBeTruthy()
  })
})

describe("Add to the company's list", () => {
  it('asks first, says it reaches every Trim Set, and Keep it writes nothing', async () => {
    const io = fakeIo()
    renderWithProviders(<JobDocumentsChecklists job={JOB} io={io} />)
    await ready()
    fireEvent.click(screen.getByRole('button', { name: "Add to the company's list: Is j1 set?" }))
    const asking = await screen.findByTestId('job-documents-checklist-promote')
    expect(asking.textContent).toContain('Every Trim Set in the company asks this from now on. This job keeps its answer.')
    fireEvent.click(within(asking).getByRole('button', { name: 'Keep it on this job' }))
    expect(screen.queryByTestId('job-documents-checklist-promote')).toBeNull()
    expect(io.promote).not.toHaveBeenCalled()
  })

  it('moves the check to the company’s group with its answer, so the stage’s count stands', async () => {
    const answered = answer({ fixtureId: 'f3', questionId: 'j1' })
    const io = fakeIo({}, [T1, item('j1', 1, { sheet: 'P-201', why: 'The slab pours Thursday' })], [answered])
    renderWithProviders(
      <>
        <JobStageChecklistStrip jobId={JOB.id} io={io} />
        <JobDocumentsChecklists job={JOB} io={io} />
      </>,
    )
    await ready()
    expect(screen.getByText('Not ready · 1 of 2')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: "Add to the company's list: Is j1 set?" }))
    const asking = await screen.findByTestId('job-documents-checklist-promote')
    expect(asking.textContent).toContain('Its plan sheet and its why are left off, since they were written for this job.')
    fireEvent.click(within(asking).getByRole('button', { name: 'Add to every Trim Set' }))
    await waitFor(() => expect(io.promote).toHaveBeenCalledWith('j1'))
    expect(await screen.findByText("Added to the company's list. Every Trim Set asks it from now on.")).toBeTruthy()

    // The same words, one group up, with the answer it had: the stage has not lost a thing.
    expect(screen.getByText('Not ready · 1 of 2')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Trim Set checklist: 1 of 2 answered, not ready' })).toBeTruthy()
    expect(summary()).toBe('0 of 1 stage ready · nothing added on this job')
    const moved = rows().find((r) => r.textContent?.includes('Is j1 set?'))!
    expect(moved.getAttribute('data-pick')).toBe('yes')
    expect(moved.textContent).toContain('Yes · Luis Ortega · Nov 2 · 9:14 am')
    expect(within(moved).queryByRole('button', { name: /Add to the company/ })).toBeNull()
    expect(within(moved).getByRole('button', { name: 'Skip on this job: Is j1 set?' })).toBeTruthy()
    expect(screen.queryByRole('link')).toBeNull()
    expect(screen.getByText("Nothing added for this job's Trim Set.")).toBeTruthy()
  })

  it('reads the database’s reason, and the check stays on the job', async () => {
    const io = fakeIo({ promote: vi.fn(async () => { throw { message: "The company's list already asks that.", code: 'P0001' } }) })
    renderWithProviders(<JobDocumentsChecklists job={JOB} io={io} />)
    await ready()
    fireEvent.click(screen.getByRole('button', { name: "Add to the company's list: Is j1 set?" }))
    fireEvent.click(within(await screen.findByTestId('job-documents-checklist-promote')).getByRole('button', { name: 'Add to every Trim Set' }))
    expect(await screen.findByText(/The company's list already asks that\./)).toBeTruthy()
    expect(summary()).toBe('0 of 1 stage ready · 2 items added on this job')
  })
})

describe('▲ and ▼', () => {
  it('moves the job’s own checks, stops at either end, and draws nothing on the company’s', async () => {
    const io = fakeIo({}, [T1, item('j1', 1), item('j2', 2), item('j3', 3)])
    renderWithProviders(<JobDocumentsChecklists job={JOB} io={io} />)
    await ready()
    expect(screen.queryByRole('button', { name: /^Move up: Did/ })).toBeNull()
    expect((screen.getByRole('button', { name: 'Move up: Is j1 set?' }) as HTMLButtonElement).disabled).toBe(true)
    expect((screen.getByRole('button', { name: 'Move down: Is j3 set?' }) as HTMLButtonElement).disabled).toBe(true)
    fireEvent.click(screen.getByRole('button', { name: 'Move up: Is j3 set?' }))
    await waitFor(() => expect(io.reorder).toHaveBeenCalledWith('f3', ['j1', 'j3', 'j2']))
    await waitFor(() => expect(rows().map((r) => r.textContent?.match(/\d\. [^?]+\?/)?.[0])).toEqual(['1. Did the final water test hold?', '2. Is j1 set?', '3. Is j3 set?', '4. Is j2 set?']))
  })

  it('reads a refused move with its reason, and the rows stay', async () => {
    const io = fakeIo({ reorder: vi.fn(async () => { throw new TypeError('Failed to fetch') }) })
    renderWithProviders(<JobDocumentsChecklists job={JOB} io={io} />)
    await ready()
    fireEvent.click(screen.getByRole('button', { name: 'Move down: Is j1 set?' }))
    expect(await screen.findByText(/The check did not move\./)).toBeTruthy()
    expect(rows()[2]!.textContent).toContain('3. Is j1 set?')
  })
})

describe('the chip, the why and the add box', () => {
  it('draws the plan sheet as a door to the job’s Plans folder, and the why beside who added it', async () => {
    const opened = vi.spyOn(window, 'open').mockImplementation(() => null)
    renderWithProviders(<JobDocumentsChecklists job={JOB} io={fakeIo({}, [item('j1', 1, { sheet: 'P-201 detail 4', why: 'The slab pours Thursday' })])} />)
    await ready()
    expect(rows()[0]!.textContent).toContain('Added by Pat Sample · Nov 2 · The slab pours Thursday')
    fireEvent.click(screen.getByRole('link', { name: "Open the job's Plans folder for P-201 detail 4" }))
    expect(opened).toHaveBeenCalledWith(PLANS, '_blank', 'noopener,noreferrer')
  })

  it('keeps the add box open for the next check, each after the last', async () => {
    const io = fakeIo()
    renderWithProviders(<JobDocumentsChecklists job={JOB} io={io} />)
    await ready()
    fireEvent.click(screen.getByRole('button', { name: '+ Add a check for Trim Set' }))
    const words = await screen.findByLabelText('Add a check for Trim Set on this job') as HTMLInputElement
    fireEvent.change(words, { target: { value: 'Is the riser where P-201 shows it?' } })
    fireEvent.change(screen.getByLabelText('The plan sheet it comes from, if any'), { target: { value: 'P-201' } })
    fireEvent.click(screen.getByRole('button', { name: 'Add the check' }))
    await waitFor(() => expect(io.addItem).toHaveBeenCalledWith({ jobId: JOB.id, fixtureId: 'f3', kind: 'trim_set', order: 3, words: 'Is the riser where P-201 shows it?', asksPhoto: false, needsSignature: false, sheet: 'P-201', why: '' }, WHO))
    expect(await screen.findByText('Added. Trim Set is now 0 of 5.')).toBeTruthy()
    await waitFor(() => expect(words.value).toBe(''))
    fireEvent.change(words, { target: { value: 'Is the vent through the roof?' } })
    fireEvent.click(screen.getByRole('button', { name: 'Add the check' }))
    await waitFor(() => expect(io.addItem).toHaveBeenCalledWith(expect.objectContaining({ order: 4, words: 'Is the vent through the roof?' }), WHO))
    expect(await screen.findByText('2 added')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Done adding' }))
    expect(await screen.findByRole('button', { name: '+ Add a check for Trim Set' })).toBeTruthy()
    expect(summary()).toBe('0 of 1 stage ready · 4 items added on this job')
  })
})

describe('a primary', () => {
  it('reads the groups, the skips and the chip, and has no press', async () => {
    authRole = 'primary'
    const skipped = { ...T1, skips: [{ id: 's1', fixtureId: 'f3', why: 'Slab on grade', by: 'Pat Sample', byId: 'u-pat', at: '2026-11-02T15:14:00.000Z' }] }
    renderWithProviders(<JobDocumentsChecklists job={JOB} io={fakeIo({}, [skipped, T2, item('j1', 1, { sheet: 'P-201' }), item('j2', 2)])} />)
    await ready()
    const line = screen.getByTestId('job-documents-checklist-skipped')
    expect(within(line).queryByRole('button')).toBeNull()
    for (const name of [/^Skip on this job/, /^Move /, /^Add to the company/, /^Take off/, /^\+ Add a check/]) expect(screen.queryByRole('button', { name })).toBeNull()
    expect(screen.getByRole('link', { name: "Open the job's Plans folder for P-201" })).toBeTruthy()
  })
})
