// @vitest-environment jsdom
/**
 * Authoring the company's list on the Documents tab, over a fake io (punch list #237, PR 4): the add box's scope pick
 * writing a question for every stage of the kind, a company question taken off the company's list with a reason, ▲ ▼ on
 * the company's order, *Use as the company's list* running past a check the company already asks and naming it, and a
 * superintendent who authors on the job but meets no company press. Made-up names and questions on a made-up job.
 */
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { JobStageRef, StageChecklistQuestion } from '../../lib/jobs/stageChecklist'
import type { StageChecklistCompanyIo } from '../../lib/jobs/stageChecklistIo'
import type { StageChecklistSheetIo } from '../../lib/jobs/stageChecklistSheetIo'
import { renderWithProviders } from '../../test/renderSmokeMocks'
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

const JOB = { id: 'job-zz-1' }
const STAGES: JobStageRef[] = [{ fixtureId: 'f3', name: 'Trim Set', sequenceOrder: 3 }]
const T1: StageChecklistQuestion = { id: 't1', kind: 'trim_set', order: 1, words: 'Did the final water test hold?', asksPhoto: false }
const T2: StageChecklistQuestion = { id: 't2', kind: 'trim_set', order: 2, words: 'Are the cleanouts capped?', asksPhoto: false }
const item = (id: string, order: number, over: Partial<StageChecklistQuestion> = {}): StageChecklistQuestion => ({ id, kind: 'trim_set', order, words: `Is ${id} set?`, asksPhoto: false, fixtureId: 'f3', addedById: 'u-pat', addedBy: 'Pat Sample', addedAt: '2026-11-02T15:00:00.000Z', ...over })

function fakeCompany(over: Partial<StageChecklistCompanyIo> = {}): StageChecklistCompanyIo {
  let seq = 0
  return {
    add: vi.fn(async (input, who) => ({ id: `c-new-${++seq}`, kind: input.kind, order: input.order ?? 0, words: input.words, asksPhoto: input.asksPhoto, needsSignature: input.needsSignature === true, fixtureId: null, addedById: who.userId, addedBy: who.name, addedAt: '2026-11-06T16:00:00.000Z', sheet: null, why: null })),
    retire: vi.fn(async () => undefined),
    reorder: vi.fn(async () => undefined),
    ...over,
  }
}

function fakeIo(over: Partial<StageChecklistSheetIo> = {}, questions: StageChecklistQuestion[] = [T1, T2, item('j1', 1), item('j2', 2)]): StageChecklistSheetIo {
  return {
    stages: vi.fn(async () => STAGES),
    questions: vi.fn(async () => [...questions]),
    answers: vi.fn(async () => []),
    pick: vi.fn(async () => { throw new Error('not here') }),
    note: vi.fn(async () => { throw new Error('not here') }),
    photo: vi.fn(async () => { throw new Error('not here') }),
    photoUrl: vi.fn(async () => null),
    sign: vi.fn(async () => { throw new Error('not here') }),
    takeBack: vi.fn(async () => { throw new Error('not here') }),
    inkUrl: vi.fn(async () => null),
    records: vi.fn(async () => []),
    amend: vi.fn(async () => { throw new Error('not here') }),
    addItem: vi.fn(async (input, who) => ({ id: 'j-new', kind: input.kind, order: input.order ?? 0, words: input.words, asksPhoto: input.asksPhoto, fixtureId: input.fixtureId, addedById: who.userId, addedBy: who.name, addedAt: '2026-11-06T16:00:00.000Z', sheet: input.sheet || null, why: input.why || null })),
    retireItem: vi.fn(async () => undefined),
    mayAuthor: vi.fn(async () => true),
    skip: vi.fn(async () => { throw new Error('not here') }),
    putBack: vi.fn(async () => undefined),
    reorder: vi.fn(async () => undefined),
    promote: vi.fn(async (id) => ({ id: `company-${id}`, kind: 'trim_set' as const, order: 3, words: `Is ${id} set?`, asksPhoto: false, fixtureId: null, addedById: 'u-jo', addedBy: '', addedAt: '2026-11-06T16:30:00.000Z', sheet: null, why: null })),
    company: fakeCompany(),
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
const addBox = () => document.querySelector<HTMLElement>('[data-checklist-add]')!

describe('the add box’s scope (#237 PR 4)', () => {
  it('writes a question for every Trim Set when the company is picked, with no plan sheet or why, and the job stays the default', async () => {
    const io = fakeIo()
    renderWithProviders(<JobDocumentsChecklists job={JOB} io={io} />)
    await ready()
    fireEvent.click(screen.getByRole('button', { name: '+ Add a check for Trim Set' }))
    expect(addBox().getAttribute('data-checklist-add-scope')).toBe('job')
    expect(screen.getByLabelText('The plan sheet it comes from, if any')).toBeTruthy()
    fireEvent.click(within(addBox()).getByRole('radio', { name: 'Every Trim Set in the company' }))
    expect(addBox().getAttribute('data-checklist-add-scope')).toBe('company')
    expect(screen.queryByLabelText('The plan sheet it comes from, if any')).toBeNull()
    expect(addBox().textContent).toContain('Every Trim Set in the company asks it from now on.')
    fireEvent.change(screen.getByLabelText('Add a check for Trim Set on this job'), { target: { value: 'Is the water heater strapped?' } })
    fireEvent.click(within(addBox()).getByRole('checkbox', { name: /Needs a signature/ }))
    fireEvent.click(within(addBox()).getByRole('button', { name: 'Add to every Trim Set' }))
    await waitFor(() => expect(io.company!.add).toHaveBeenCalledWith({ kind: 'trim_set', order: 3, words: 'Is the water heater strapped?', asksPhoto: false, needsSignature: true }, { userId: 'u-jo', name: 'Jo Sample' }))
    expect(io.addItem).not.toHaveBeenCalled()
    expect(await screen.findByText("Added to the company's list. Every Trim Set asks it from now on.")).toBeTruthy()
    // The new question sits in the company's group, numbered third, and the count follows.
    const added = rows().find((r) => r.textContent?.includes('Is the water heater strapped?'))!
    expect(added.textContent).toContain('3. Is the water heater strapped?')
    expect(added.textContent).toContain('needs a signature')
    expect(summary()).toBe('0 of 1 stage ready · 2 items added on this job')
    expect(screen.getByText('Not ready · 0 of 5')).toBeTruthy()
  })

  it('offers no scope pick without a company io, and none to a superintendent who authors on the job', async () => {
    renderWithProviders(<JobDocumentsChecklists job={JOB} io={fakeIo({ company: undefined })} />)
    await ready()
    fireEvent.click(screen.getByRole('button', { name: '+ Add a check for Trim Set' }))
    expect(screen.queryByRole('radiogroup')).toBeNull()
    cleanup()
    authRole = 'superintendent'
    renderWithProviders(<JobDocumentsChecklists job={JOB} io={fakeIo()} />)
    await ready()
    await waitFor(() => expect(screen.getByRole('button', { name: '+ Add a check for Trim Set' })).toBeTruthy())
    fireEvent.click(screen.getByRole('button', { name: '+ Add a check for Trim Set' }))
    expect(screen.queryByRole('radiogroup')).toBeNull()
    expect(screen.queryByRole('button', { name: /Take off the company's list/ })).toBeNull()
    expect(screen.queryByRole('button', { name: /Use as the company's/ })).toBeNull()
  })
})

describe("Take off the company's list", () => {
  it('asks for its reason, stops without one, and takes the question off every Trim Set with the count following', async () => {
    const io = fakeIo()
    renderWithProviders(<JobDocumentsChecklists job={JOB} io={io} />)
    await ready()
    fireEvent.click(screen.getByRole('button', { name: "Take off the company's list: Are the cleanouts capped?" }))
    const asking = await screen.findByTestId('job-documents-checklist-company-take-off')
    expect(asking.textContent).toContain('Every Trim Set in the company stops asking it.')
    fireEvent.click(within(asking).getByRole('button', { name: 'Take it off every Trim Set' }))
    expect(asking.textContent).toContain('Say why this question comes off the company’s list.')
    expect(io.company!.retire).not.toHaveBeenCalled()
    fireEvent.change(within(asking).getByLabelText('Why this question comes off the company’s list'), { target: { value: 'the inspector no longer asks' } })
    fireEvent.click(within(asking).getByRole('button', { name: 'Take it off every Trim Set' }))
    await waitFor(() => expect(io.company!.retire).toHaveBeenCalledWith('t2', 'the inspector no longer asks', { userId: 'u-jo', name: 'Jo Sample' }))
    expect(await screen.findByText("Taken off the company's list. Trim Set is now 0 of 3.")).toBeTruthy()
    expect(rows().some((r) => r.textContent?.includes('Are the cleanouts capped?'))).toBe(false)
    expect(screen.getByText('Not ready · 0 of 3')).toBeTruthy()
  })

  it('reads a refusal with its reason, and the question stays', async () => {
    const io = fakeIo({ company: fakeCompany({ retire: vi.fn(async () => { throw new Error('Only the office takes a question off the company’s list.') }) }) })
    renderWithProviders(<JobDocumentsChecklists job={JOB} io={io} />)
    await ready()
    fireEvent.click(screen.getByRole('button', { name: "Take off the company's list: Are the cleanouts capped?" }))
    const asking = await screen.findByTestId('job-documents-checklist-company-take-off')
    fireEvent.change(within(asking).getByLabelText('Why this question comes off the company’s list'), { target: { value: 'the inspector no longer asks' } })
    fireEvent.click(within(asking).getByRole('button', { name: 'Take it off every Trim Set' }))
    expect(await screen.findByText(/Only the office takes a question off/)).toBeTruthy()
    expect(rows().some((r) => r.textContent?.includes('Are the cleanouts capped?'))).toBe(true)
  })
})

describe('▲ ▼ on the company’s order', () => {
  it('moves a company question through the company io and stops at either end', async () => {
    const io = fakeIo()
    renderWithProviders(<JobDocumentsChecklists job={JOB} io={io} />)
    await ready()
    expect((screen.getByRole('button', { name: 'Move up: Did the final water test hold?' }) as HTMLButtonElement).disabled).toBe(true)
    fireEvent.click(screen.getByRole('button', { name: 'Move down: Did the final water test hold?' }))
    await waitFor(() => expect(io.company!.reorder).toHaveBeenCalledWith('trim_set', ['t2', 't1']))
    expect(io.reorder).not.toHaveBeenCalled()
    await waitFor(() => expect(rows()[0]!.textContent).toContain('1. Are the cleanouts capped?'))
    expect(rows()[1]!.textContent).toContain('2. Did the final water test hold?')
  })
})

describe("Use as the company's list", () => {
  it('asks with the counted confirm, runs past a check the company already asks, lands the rest and names what stayed', async () => {
    const io = fakeIo({
      promote: vi.fn(async (id: string) => {
        if (id === 'j2') throw { message: "The company's list already asks that.", code: 'P0001' }
        return { id: `company-${id}`, kind: 'trim_set' as const, order: 3, words: `Is ${id} set?`, asksPhoto: false, fixtureId: null, addedById: 'u-jo', addedBy: '', addedAt: '2026-11-06T16:30:00.000Z', sheet: null, why: null }
      }),
    })
    renderWithProviders(<JobDocumentsChecklists job={JOB} io={io} />)
    await ready()
    fireEvent.click(screen.getByRole('button', { name: "Use as the company's Trim Set list" }))
    const asking = await screen.findByTestId('job-documents-checklist-use-as-company')
    expect(asking.textContent).toContain('Every Trim Set in the company asks these 2 checks from now on')
    fireEvent.click(within(asking).getByRole('button', { name: 'Add 2 checks to every Trim Set' }))
    await waitFor(() => expect(io.promote).toHaveBeenCalledTimes(2))
    expect(await screen.findByText('Added 1 check. 1 did not add.')).toBeTruthy()
    const held = await screen.findByTestId('job-documents-checklist-held')
    expect(held.textContent).toContain('1 check did not add. It stays here with the reason.')
    expect(held.textContent).toContain("Is j2 set? · The company's list already asks that.")
    // j1 moved up to the company's group; j2 stays the job's one check, so the whole-list press is gone.
    expect(summary()).toBe('0 of 1 stage ready · 1 item added on this job')
    expect(screen.queryByRole('button', { name: /Use as the company's/ })).toBeNull()
    expect(screen.getByRole('button', { name: "Add to the company's list: Is j2 set?" })).toBeTruthy()
  })

  it('Keep them on this job writes nothing, and one check alone has no whole-list press', async () => {
    const io = fakeIo()
    renderWithProviders(<JobDocumentsChecklists job={JOB} io={io} />)
    await ready()
    fireEvent.click(screen.getByRole('button', { name: "Use as the company's Trim Set list" }))
    fireEvent.click(within(await screen.findByTestId('job-documents-checklist-use-as-company')).getByRole('button', { name: 'Keep them on this job' }))
    expect(screen.queryByTestId('job-documents-checklist-use-as-company')).toBeNull()
    expect(io.promote).not.toHaveBeenCalled()
    cleanup()
    renderWithProviders(<JobDocumentsChecklists job={JOB} io={fakeIo({}, [T1, item('j1', 1)])} />)
    await ready()
    expect(screen.queryByRole('button', { name: /Use as the company's/ })).toBeNull()
  })
})
