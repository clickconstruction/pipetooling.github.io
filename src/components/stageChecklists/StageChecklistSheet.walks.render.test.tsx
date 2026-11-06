// @vitest-environment jsdom
/**
 * What the walks added to the phone sheet, over a fake io (punch list #237, PR 1b): the add box staying open with its
 * plan sheet and its why, who sees the author's presses (the database's answer, for a superintendent or an estimator),
 * Skip on this job with its reason and Put it back, ▲ and ▼ on the job's own checks, and the plan-sheet chip, whose press
 * opens the folder and never the row beneath it. Made-up questions and a made-up job.
 */
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { JobStageRef, StageChecklistQuestion } from '../../lib/jobs/stageChecklist'
import type { JobAnswer, StageChecklistSheetIo } from '../../lib/jobs/stageChecklistSheetIo'
import { renderWithProviders } from '../../test/renderSmokeMocks'
import { JobStageChecklistStrip } from './JobStageChecklistStrip'

vi.mock('../../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../../test/renderSmokeMocks')
  return { supabase: makeSupabaseStub() }
})
let authRole = 'superintendent'
vi.mock('../../hooks/useAuth', async () => {
  const { makeUseAuthValue, useAuthModuleMock } = await import('../../test/renderSmokeMocks')
  const value = () => makeUseAuthValue({ role: authRole, profileName: 'Pat Sample', user: { id: 'u-pat', email: 'smoke@example.com' } })
  return { ...useAuthModuleMock(), useAuth: value, useOptionalAuth: value }
})

const JOB = 'job-zz-1'
const WHO = { userId: 'u-pat', name: 'Pat Sample' }
const STAGES: JobStageRef[] = [{ fixtureId: 'f3', name: 'Trim Set', sequenceOrder: 3 }]
const Q: StageChecklistQuestion[] = [
  { id: 't1', kind: 'trim_set', order: 1, words: 'Did the final water test hold?', asksPhoto: false },
  { id: 't2', kind: 'trim_set', order: 2, words: 'Are the cleanouts capped?', asksPhoto: false },
]
const item = (id: string, order: number, over: Partial<StageChecklistQuestion> = {}): StageChecklistQuestion => ({ id, kind: 'trim_set', order, words: `Is ${id} set?`, asksPhoto: false, fixtureId: 'f3', addedById: 'u-jo', addedBy: 'Jo Sample', addedAt: '2026-11-02T15:00:00.000Z', ...over })
const PLANS = 'https://drive.example.com/plans'

function fakeIo(over: Partial<StageChecklistSheetIo> = {}, questions: StageChecklistQuestion[] = Q, answers: JobAnswer[] = []): StageChecklistSheetIo {
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
    mayAuthor: vi.fn(async () => true),
    skip: vi.fn(async (input, who) => ({ id: `s-${input.questionId}`, fixtureId: input.fixtureId, questionId: input.questionId, why: input.why.trim(), by: who.name, byId: who.userId, at: '2026-11-02T15:14:00.000Z' })),
    putBack: vi.fn(async () => undefined),
    reorder: vi.fn(async () => undefined),
    promote: vi.fn(async () => { throw new Error('not here') }),
    ...over,
  }
}

afterEach(() => {
  cleanup()
  authRole = 'superintendent'
  vi.restoreAllMocks()
})

const openRow = () => document.querySelector('[data-checklist-row="open"]') as HTMLElement
const addBox = () => document.querySelector('[data-checklist-add]') as HTMLElement
const openSheet = async (name = 'Trim Set checklist: 0 of 2 answered, not ready') => fireEvent.click(await screen.findByRole('button', { name }))

describe('the add box', () => {
  it('stays open for the next check, empties, and takes the plan sheet and the why beside the words', async () => {
    const io = fakeIo()
    renderWithProviders(<JobStageChecklistStrip jobId={JOB} io={io} plansUrl={PLANS} />)
    await openSheet()
    fireEvent.click(await screen.findByRole('button', { name: '+ Add a check for Trim Set' }))
    const words = await screen.findByLabelText('Add a check for Trim Set on this job') as HTMLInputElement
    const sheet = screen.getByLabelText('The plan sheet it comes from, if any') as HTMLInputElement
    const why = screen.getByLabelText('Why this check, if you want to say') as HTMLInputElement

    fireEvent.change(words, { target: { value: 'Is the pan drain run to the hub?' } })
    fireEvent.change(sheet, { target: { value: 'P-201 detail 4' } })
    fireEvent.change(why, { target: { value: 'The slab pours Thursday' } })
    fireEvent.click(screen.getByLabelText('Asks for a photo'))
    fireEvent.click(screen.getByRole('button', { name: 'Add the check' }))
    await waitFor(() => expect(io.addItem).toHaveBeenCalledWith({ jobId: JOB, fixtureId: 'f3', kind: 'trim_set', order: 1, words: 'Is the pan drain run to the hub?', asksPhoto: true, needsSignature: false, sheet: 'P-201 detail 4', why: 'The slab pours Thursday' }, WHO))

    // The box is still there with its boxes empty and its tally up; the check is on the list and counted.
    expect(await screen.findByText('Added. Trim Set is now 0 of 3.')).toBeTruthy()
    await waitFor(() => expect(words.value).toBe(''))
    expect(sheet.value).toBe('')
    expect(why.value).toBe('')
    expect((screen.getByLabelText('Asks for a photo') as HTMLInputElement).checked).toBe(false)
    expect(within(addBox()).getByText('1 added')).toBeTruthy()
    expect(screen.getByText('0 of 3 answered · 3 left')).toBeTruthy()
    const row = screen.getByRole('button', { name: 'Is the pan drain run to the hub?: not answered yet. Open to answer.' })
    expect(row.textContent).toContain('asks for a photo · You added this · Nov 2 · The slab pours Thursday')
    expect(screen.getByRole('link', { name: "Open the job's Plans folder for P-201 detail 4" })).toBeTruthy()

    // The second goes in after the first, without reopening anything.
    fireEvent.change(words, { target: { value: 'Is the vent through the roof?' } })
    fireEvent.keyDown(words, { key: 'Enter' })
    await waitFor(() => expect(io.addItem).toHaveBeenCalledWith({ jobId: JOB, fixtureId: 'f3', kind: 'trim_set', order: 2, words: 'Is the vent through the roof?', asksPhoto: false, needsSignature: false, sheet: '', why: '' }, WHO))
    expect(await within(addBox()).findByText('2 added')).toBeTruthy()

    fireEvent.click(within(addBox()).getByRole('button', { name: 'Done adding' }))
    await waitFor(() => expect(addBox()).toBeNull())
    expect(screen.getByRole('button', { name: '+ Add a check for Trim Set' })).toBeTruthy()
  })

  it('keeps what was typed when the database refuses, and says why', async () => {
    const io = fakeIo({ addItem: vi.fn(async () => { throw { message: 'new row violates row-level security policy', code: '42501' } }) })
    renderWithProviders(<JobStageChecklistStrip jobId={JOB} io={io} />)
    await openSheet()
    fireEvent.click(await screen.findByRole('button', { name: '+ Add a check for Trim Set' }))
    const words = await screen.findByLabelText('Add a check for Trim Set on this job') as HTMLInputElement
    fireEvent.change(words, { target: { value: 'Is the pan drain run?' } })
    fireEvent.click(screen.getByRole('button', { name: 'Add the check' }))
    expect(await screen.findByText(/The check was not added\./)).toBeTruthy()
    expect(words.value).toBe('Is the pan drain run?')
    expect(within(addBox()).queryByText('1 added')).toBeNull()
  })
})

describe('who sees the author’s presses', () => {
  it('draws none for a superintendent on a job the database says is not theirs, and lists no empty stage', async () => {
    const io = fakeIo({ mayAuthor: vi.fn(async () => false) }, [...Q, item('j1', 1), item('j2', 2)])
    renderWithProviders(<JobStageChecklistStrip jobId={JOB} io={io} />)
    await openSheet('Trim Set checklist: 0 of 4 answered, not ready')
    await waitFor(() => expect(io.mayAuthor).toHaveBeenCalledWith(JOB))
    expect(await screen.findByText('Added for this job')).toBeTruthy()
    expect(screen.queryByRole('button', { name: '+ Add a check for Trim Set' })).toBeNull()
    expect(screen.queryByRole('button', { name: /^Skip on this job/ })).toBeNull()
    cleanup()
    const empty = fakeIo({ mayAuthor: vi.fn(async () => false) }, [])
    renderWithProviders(<JobStageChecklistStrip jobId={JOB} io={empty} />)
    await waitFor(() => expect(empty.mayAuthor).toHaveBeenCalled())
    await waitFor(() => expect(empty.answers).toHaveBeenCalled())
    expect(document.querySelector('[data-job-stage-checklists]')).toBeNull()
  })

  it('opens authoring to an estimator on a job he priced: the empty stage is listed, and the first check has a door', async () => {
    authRole = 'estimator'
    const io = fakeIo({}, [])
    renderWithProviders(<JobStageChecklistStrip jobId={JOB} io={io} />)
    fireEvent.click(await screen.findByRole('button', { name: 'Trim Set checklist: No questions yet. Add a check for this job.' }))
    fireEvent.click(await screen.findByRole('button', { name: '+ Add a check for Trim Set' }))
    fireEvent.change(await screen.findByLabelText('Add a check for Trim Set on this job'), { target: { value: 'Is the riser where P-201 shows it?' } })
    fireEvent.click(screen.getByRole('button', { name: 'Add the check' }))
    await waitFor(() => expect(io.addItem).toHaveBeenCalled())
    expect(await screen.findByText('Added. Trim Set is now 0 of 1.')).toBeTruthy()
  })

  it('leaves an estimator who did not price the job as a reader', async () => {
    authRole = 'estimator'
    const io = fakeIo({ mayAuthor: vi.fn(async () => false) })
    renderWithProviders(<JobStageChecklistStrip jobId={JOB} io={io} />)
    await openSheet()
    await waitFor(() => expect(io.mayAuthor).toHaveBeenCalled())
    expect(await screen.findByText("Nothing added for this job's Trim Set. The superintendent or the office adds one.")).toBeTruthy()
    expect(screen.queryByRole('button', { name: '+ Add a check for Trim Set' })).toBeNull()
  })

  it('never asks for the crew or the office, and the crew reads a skip with no press', async () => {
    authRole = 'helpers'
    const skipped = [{ ...Q[0]!, skips: [{ id: 's1', fixtureId: 'f3', why: 'The owner took these out', by: 'Jo Sample', byId: 'u-jo', at: '2026-11-02T15:14:00.000Z' }] }, Q[1]!]
    const io = fakeIo({}, skipped)
    renderWithProviders(<JobStageChecklistStrip jobId={JOB} io={io} />)
    await openSheet('Trim Set checklist: 0 of 1 answered, not ready')
    const line = document.querySelector('[data-checklist-skipped]') as HTMLElement
    expect(await within(line).findByText('Skipped on this job')).toBeTruthy()
    expect(line.textContent).toContain('Did the final water test hold?')
    expect(line.textContent).toContain('Jo Sample · Nov 2 · 9:14 am · The owner took these out')
    expect(within(line).queryByRole('button')).toBeNull()
    expect(screen.queryByRole('button', { name: /^Skip on this job/ })).toBeNull()
    expect(io.mayAuthor).not.toHaveBeenCalled()
    cleanup()
    authRole = 'assistant'
    const office = fakeIo()
    renderWithProviders(<JobStageChecklistStrip jobId={JOB} io={office} />)
    await openSheet()
    expect(office.mayAuthor).not.toHaveBeenCalled()
    expect(await screen.findByRole('button', { name: '+ Add a check for Trim Set' })).toBeTruthy()
  })
})

describe('Skip on this job', () => {
  it('needs its reason, takes the question off the list and the count, and Put it back returns it', async () => {
    const io = fakeIo()
    renderWithProviders(<JobStageChecklistStrip jobId={JOB} io={io} />)
    await openSheet()
    await waitFor(() => expect(io.mayAuthor).toHaveBeenCalled())
    fireEvent.click(await within(openRow()).findByRole('button', { name: 'Skip on this job: Did the final water test hold?' }))
    expect(within(openRow()).getByText("The company's Trim Set list stays whole. Say why this question is not on this job.")).toBeTruthy()
    // The presses give way to the reason, and no reason is no skip.
    expect(within(openRow()).queryByRole('button', { name: 'Yes' })).toBeNull()
    fireEvent.click(within(openRow()).getByRole('button', { name: 'Skip on this job' }))
    expect(await within(openRow()).findByText('Say why this question is not on this job.')).toBeTruthy()
    expect(io.skip).not.toHaveBeenCalled()

    fireEvent.change(within(openRow()).getByLabelText('Why this question is not on this job'), { target: { value: 'Slab on grade, no water test here' } })
    fireEvent.click(within(openRow()).getByRole('button', { name: 'Skip on this job' }))
    await waitFor(() => expect(io.skip).toHaveBeenCalledWith({ jobId: JOB, fixtureId: 'f3', questionId: 't1', why: 'Slab on grade, no water test here' }, WHO))
    expect(await screen.findByText('Skipped on this job. Trim Set is now 0 of 1.')).toBeTruthy()

    // The next question opens, the skipped one reads in its line, and the strip's count moved with the sheet.
    expect(within(openRow()).getByText('1. Are the cleanouts capped?')).toBeTruthy()
    const line = document.querySelector('[data-checklist-skipped]') as HTMLElement
    expect(line.textContent).toContain('Did the final water test hold?')
    expect(line.textContent).toContain('Pat Sample · Nov 2 · 9:14 am · Slab on grade, no water test here')
    expect(screen.getByRole('button', { name: 'Trim Set checklist: 0 of 1 answered, not ready' })).toBeTruthy()

    fireEvent.click(within(line).getByRole('button', { name: 'Put it back: Did the final water test hold?' }))
    await waitFor(() => expect(io.putBack).toHaveBeenCalledWith('s-t1', WHO))
    expect(await screen.findByText('Put back. Trim Set is now 0 of 2.')).toBeTruthy()
    expect(document.querySelector('[data-checklist-skipped]')).toBeNull()
    expect(screen.getByRole('button', { name: 'Trim Set checklist: 0 of 2 answered, not ready' })).toBeTruthy()
  })

  it('offers no skip on a check added for the job, and Keep it leaves the question alone', async () => {
    const io = fakeIo({}, [Q[0]!, item('j1', 1)])
    renderWithProviders(<JobStageChecklistStrip jobId={JOB} io={io} />)
    await openSheet()
    await waitFor(() => expect(io.mayAuthor).toHaveBeenCalled())
    fireEvent.click(await within(openRow()).findByRole('button', { name: 'Skip on this job: Did the final water test hold?' }))
    fireEvent.click(within(openRow()).getByRole('button', { name: 'Keep it' }))
    expect(within(openRow()).getByRole('button', { name: 'Yes' })).toBeTruthy()
    expect(io.skip).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Is j1 set?: not answered yet. Open to answer.' }))
    await waitFor(() => expect(within(openRow()).getByText('2. Is j1 set?')).toBeTruthy())
    expect(within(openRow()).queryByRole('button', { name: /Skip on this job/ })).toBeNull()
  })

  it('reads a refusal with its reason, and the question stays', async () => {
    const io = fakeIo({ skip: vi.fn(async () => { throw { message: 'new row violates row-level security policy', code: '42501' } }) })
    renderWithProviders(<JobStageChecklistStrip jobId={JOB} io={io} />)
    await openSheet()
    fireEvent.click(await within(openRow()).findByRole('button', { name: 'Skip on this job: Did the final water test hold?' }))
    fireEvent.change(within(openRow()).getByLabelText('Why this question is not on this job'), { target: { value: 'Slab on grade' } })
    fireEvent.click(within(openRow()).getByRole('button', { name: 'Skip on this job' }))
    expect(await screen.findByText(/The question was not skipped\./)).toBeTruthy()
    expect(document.querySelector('[data-checklist-skipped]')).toBeNull()
    expect(screen.getByRole('button', { name: 'Trim Set checklist: 0 of 2 answered, not ready' })).toBeTruthy()
  })

  it('says so on a stage whose every question is skipped, and still offers the add', async () => {
    const skipped = Q.map((q) => ({ ...q, skips: [{ id: `s-${q.id}`, fixtureId: 'f3', why: 'The owner took these out', by: 'Jo Sample', byId: 'u-jo', at: '2026-11-02T15:14:00.000Z' }] }))
    renderWithProviders(<JobStageChecklistStrip jobId={JOB} io={fakeIo({}, skipped)} />)
    const row = await screen.findByRole('button', { name: 'Trim Set checklist: Every question is skipped on this job. Add a check if this job needs one.' })
    fireEvent.click(row)
    expect(await screen.findByRole('button', { name: '+ Add a check for Trim Set' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Put it back: Did the final water test hold?' })).toBeTruthy()
    expect(screen.queryByText(/No questions for Trim Set yet/)).toBeNull()
    cleanup()
    // The crew has nothing to answer on it, so the strip does not list it.
    authRole = 'helpers'
    const io = fakeIo({}, skipped)
    renderWithProviders(<JobStageChecklistStrip jobId={JOB} io={io} />)
    await waitFor(() => expect(io.answers).toHaveBeenCalled())
    await waitFor(() => expect(document.querySelector('[data-job-stage-checklists]')).toBeNull())
  })
})

describe('▲ and ▼', () => {
  const items = [item('j1', 1), item('j2', 2), item('j3', 3)]

  it('moves the job’s own check, keeps its row open, and stops at either end', async () => {
    const io = fakeIo({}, items)
    renderWithProviders(<JobStageChecklistStrip jobId={JOB} io={io} />)
    await openSheet('Trim Set checklist: 0 of 3 answered, not ready')
    await waitFor(() => expect(io.mayAuthor).toHaveBeenCalled())
    const up = await within(openRow()).findByRole('button', { name: 'Move up: Is j1 set?' }) as HTMLButtonElement
    expect(up.disabled).toBe(true)
    fireEvent.click(within(openRow()).getByRole('button', { name: 'Move down: Is j1 set?' }))
    await waitFor(() => expect(io.reorder).toHaveBeenCalledWith('f3', ['j2', 'j1', 'j3']))
    // The moved row stays the open one, though the list's next question changed under it.
    await waitFor(() => expect(within(openRow()).getByText('2. Is j1 set?')).toBeTruthy())
    expect(within(openRow()).getByText('Open')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Is j2 set?: not answered yet. Open to answer.' }).textContent).toContain('1. Is j2 set?')
    fireEvent.click(within(openRow()).getByRole('button', { name: 'Move down: Is j1 set?' }))
    await waitFor(() => expect(io.reorder).toHaveBeenCalledWith('f3', ['j2', 'j3', 'j1']))
    await waitFor(() => expect(within(openRow()).getByText('3. Is j1 set?')).toBeTruthy())
    expect((within(openRow()).getByRole('button', { name: 'Move down: Is j1 set?' }) as HTMLButtonElement).disabled).toBe(true)
  })

  it('draws no arrows on a company question, on a lone check, or for someone who does not author here', async () => {
    const lone = fakeIo({}, [Q[0]!, item('j1', 1)])
    renderWithProviders(<JobStageChecklistStrip jobId={JOB} io={lone} />)
    await openSheet()
    await waitFor(() => expect(lone.mayAuthor).toHaveBeenCalled())
    expect(within(openRow()).queryByRole('button', { name: /^Move/ })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Is j1 set?: not answered yet. Open to answer.' }))
    await waitFor(() => expect(within(openRow()).getByText('2. Is j1 set?')).toBeTruthy())
    expect(within(openRow()).queryByRole('button', { name: /^Move/ })).toBeNull()
    cleanup()
    authRole = 'helpers'
    renderWithProviders(<JobStageChecklistStrip jobId={JOB} io={fakeIo({}, items)} />)
    await openSheet('Trim Set checklist: 0 of 3 answered, not ready')
    await waitFor(() => expect(within(openRow()).getByText('1. Is j1 set?')).toBeTruthy())
    expect(within(openRow()).queryByRole('button', { name: /^Move/ })).toBeNull()
  })

  it('reads a refused move with its reason and leaves the order alone', async () => {
    const io = fakeIo({ reorder: vi.fn(async () => { throw { message: 'Only the office moves a check.', code: '42501' } }) }, items)
    renderWithProviders(<JobStageChecklistStrip jobId={JOB} io={io} />)
    await openSheet('Trim Set checklist: 0 of 3 answered, not ready')
    await waitFor(() => expect(io.mayAuthor).toHaveBeenCalled())
    fireEvent.click(await within(openRow()).findByRole('button', { name: 'Move down: Is j1 set?' }))
    expect(await screen.findByText(/The check did not move\./)).toBeTruthy()
    expect(within(openRow()).getByText('1. Is j1 set?')).toBeTruthy()
  })
})

describe('the plan-sheet chip', () => {
  const withSheet = [item('j1', 1), item('j2', 2, { sheet: 'P-201 detail 4' })]

  it('opens the job’s Plans folder from a statement row, and the press never reaches the row beneath it', async () => {
    const opened = vi.spyOn(window, 'open').mockImplementation(() => null)
    renderWithProviders(<JobStageChecklistStrip jobId={JOB} io={fakeIo({}, withSheet)} plansUrl={PLANS} />)
    await openSheet()
    await waitFor(() => expect(within(openRow()).getByText('1. Is j1 set?')).toBeTruthy())
    const chip = screen.getByRole('link', { name: "Open the job's Plans folder for P-201 detail 4" })
    expect(chip.getAttribute('href')).toBe(PLANS)
    expect(chip.closest('button')).toBeNull()
    fireEvent.click(chip)
    expect(opened).toHaveBeenCalledWith(PLANS, '_blank', 'noopener,noreferrer')
    // The row with the chip stays a statement; the open row is where it was.
    expect(within(openRow()).getByText('1. Is j1 set?')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Is j2 set?: not answered yet. Open to answer.' })).toBeTruthy()
  })

  it('draws the words alone on a job with no Plans link, or one that is not a web address', async () => {
    renderWithProviders(<JobStageChecklistStrip jobId={JOB} io={fakeIo({}, withSheet)} />)
    await openSheet()
    expect(await screen.findByText('📐 P-201 detail 4')).toBeTruthy()
    expect(screen.queryByRole('link')).toBeNull()
    cleanup()
    renderWithProviders(<JobStageChecklistStrip jobId={JOB} io={fakeIo({}, withSheet)} plansUrl="javascript:alert(1)" />)
    await openSheet()
    expect(await screen.findByText('📐 P-201 detail 4')).toBeTruthy()
    expect(screen.queryByRole('link')).toBeNull()
  })

  it('names who added an answered check on its own line', async () => {
    const answered: JobAnswer = { id: 'a1', fixtureId: 'f3', questionId: 'j1', pick: 'yes', note: '', photo: null, answeredBy: 'Luis Ortega', answeredAt: '2026-11-02T15:14:00.000Z', storagePath: null, reportPhotoId: null }
    renderWithProviders(<JobStageChecklistStrip jobId={JOB} io={fakeIo({}, [item('j1', 1, { why: 'The slab pours Thursday' }), item('j2', 2)], [answered])} />)
    await openSheet('Trim Set checklist: 1 of 2 answered, not ready')
    const row = await screen.findByRole('button', { name: 'Is j1 set?: Yes. Open to change.' })
    expect(row.textContent).toContain('Luis Ortega · Nov 2 · 9:14 am')
    expect(row.textContent).toContain('Added by Jo Sample · Nov 2 · The slab pours Thursday')
  })
})
