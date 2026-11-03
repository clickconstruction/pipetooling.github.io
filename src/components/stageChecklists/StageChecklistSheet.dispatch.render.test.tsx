// @vitest-environment jsdom
/**
 * Send a stage check to Dispatch from the phone sheet, over a fake io (punch list #245, PR 1): the quiet press on the
 * open row, the sheet on top with the context card, the chip required and the words required only under Something else,
 * the row the send writes, the *With Dispatch* chip on the row after, a check already with Dispatch wearing the chip and
 * no press, the database's refusal read as already sent, and the strip opening a stage's sheet on a check when the inbox
 * asks. Made-up questions and a made-up job.
 */
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { JobStageRef, StageChecklistQuestion } from '../../lib/jobs/stageChecklist'
import type { OpenStageCheck } from '../../lib/jobs/stageCheckDispatch'
import type { StageCheckDispatchIo } from '../../lib/jobs/stageCheckDispatchIo'
import type { JobAnswer, StageChecklistSheetIo } from '../../lib/jobs/stageChecklistSheetIo'
import { renderWithProviders } from '../../test/renderSmokeMocks'
import { JobStageChecklistStrip } from './JobStageChecklistStrip'

vi.mock('../../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../../test/renderSmokeMocks')
  return { supabase: makeSupabaseStub() }
})
vi.mock('../../hooks/useAuth', async () => {
  const { makeUseAuthValue, useAuthModuleMock } = await import('../../test/renderSmokeMocks')
  const value = () => makeUseAuthValue({ role: 'helpers', profileName: 'Luis Ortega', user: { id: 'u-luis', email: 'smoke@example.com' } })
  return { ...useAuthModuleMock(), useAuth: value, useOptionalAuth: value }
})

const JOB = 'job-zz-1'
const STAGES: JobStageRef[] = [{ fixtureId: 'f3', name: 'Trim Set', sequenceOrder: 3 }]
const Q: StageChecklistQuestion[] = [
  { id: 't1', kind: 'trim_set', order: 1, words: 'Did the final water test hold?', asksPhoto: false },
  { id: 't2', kind: 'trim_set', order: 2, words: 'Are the cleanouts capped?', asksPhoto: true },
  { id: 't3', kind: 'trim_set', order: 3, words: 'Is the pan drain run to the hub?', asksPhoto: false },
]
const SENT_T3: OpenStageCheck = { id: 'r-old', fixtureId: 'f3', questionId: 't3', title: 'Trim Set · “Is the pan drain run to the hub?” · need a part: caps · JP1088 ZZ TEST', createdAt: new Date(Date.now() - 12 * 60_000).toISOString(), priority: 'normal' }

function fakeDispatch(over: Partial<StageCheckDispatchIo> = {}, open: OpenStageCheck[] = []): StageCheckDispatchIo {
  return {
    job: vi.fn(async () => ({ id: JOB, hcpNumber: '1088', name: 'ZZ TEST Riders Walk', address: '12925 FM 20, Kingsbury' })),
    open: vi.fn(async () => [...open]),
    send: vi.fn(async () => ({ id: 'r-new', pushed: true, pushError: null })),
    ...over,
  }
}

function fakeIo(dispatch: StageCheckDispatchIo | undefined, answers: JobAnswer[] = []): StageChecklistSheetIo {
  return {
    stages: vi.fn(async () => STAGES),
    questions: vi.fn(async () => [...Q]),
    answers: vi.fn(async () => [...answers]),
    pick: vi.fn(async () => { throw new Error('not here') }),
    note: vi.fn(async () => { throw new Error('not here') }),
    photo: vi.fn(async () => { throw new Error('not here') }),
    photoUrl: vi.fn(async () => null),
    addItem: vi.fn(async () => { throw new Error('not here') }),
    retireItem: vi.fn(async () => undefined),
    mayAuthor: vi.fn(async () => false),
    skip: vi.fn(async () => { throw new Error('not here') }),
    putBack: vi.fn(async () => undefined),
    reorder: vi.fn(async () => undefined),
    promote: vi.fn(async () => { throw new Error('not here') }),
    dispatch,
  }
}

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

const openRow = () => document.querySelector('[data-checklist-row="open"]') as HTMLElement
const sendSheet = () => document.querySelector('[data-stage-check-dispatch-sheet]') as HTMLElement
const openSheet = async () => fireEvent.click(await screen.findByRole('button', { name: 'Trim Set checklist: 0 of 3 answered, not ready' }))

describe('Send to Dispatch on the open row', () => {
  it('opens the sheet on top with the context, wants a reason, and writes the row with the stage and the check on it', async () => {
    const dispatch = fakeDispatch()
    renderWithProviders(<JobStageChecklistStrip jobId={JOB} io={fakeIo(dispatch)} />)
    await openSheet()
    fireEvent.click(await within(openRow()).findByRole('button', { name: 'Send to Dispatch: Did the final water test hold?' }))

    // The context card never asks the crew to retype what the row knows.
    const sheet = await waitFor(() => {
      const el = sendSheet()
      expect(el).toBeTruthy()
      return el
    })
    expect(await within(sheet).findByText('JP1088 ZZ TEST Riders Walk')).toBeTruthy()
    expect(within(sheet).getByText('12925 FM 20, Kingsbury · Trim Set · 0 of 3 answered · 3 left')).toBeTruthy()
    expect(within(sheet).getByText('Did the final water test hold?')).toBeTruthy()
    expect(within(sheet).getByText("the company's question · not answered yet")).toBeTruthy()

    // No chip, no send.
    const confirm = () => screen.getByRole('button', { name: 'Send to Dispatch' })
    fireEvent.click(confirm())
    expect(await screen.findByText('Pick why you are sending it.')).toBeTruthy()
    expect(dispatch.send).not.toHaveBeenCalled()

    // Something else wants the words.
    fireEvent.click(within(sheet).getByRole('button', { name: 'Something else' }))
    fireEvent.click(confirm())
    expect(await screen.findByText('Say what Dispatch should know.')).toBeTruthy()

    // Can't do it says it leads the inbox; Need a part sends with the words.
    fireEvent.click(within(sheet).getByRole('button', { name: "Can't do it" }))
    expect(within(sheet).getByText(/marks a stopped crew, so it leads the inbox/)).toBeTruthy()
    fireEvent.click(within(sheet).getByRole('button', { name: 'Need a part' }))
    fireEvent.change(within(sheet).getByLabelText('What should Dispatch know?'), { target: { value: 'The caps are not on the truck.' } })
    fireEvent.click(confirm())
    await waitFor(() => expect(dispatch.send).toHaveBeenCalledTimes(1))
    expect(dispatch.send).toHaveBeenCalledWith({
      from_user_id: 'u-luis',
      title: 'Trim Set · “Did the final water test hold?” · need a part: The caps are not on the truck. · JP1088 ZZ TEST Riders Walk',
      links: [],
      job_ledger_id: JOB,
      bid_id: null,
      development_id: null,
      reference_summary: 'JP1088 · ZZ TEST Riders Walk · 12925 FM 20, Kingsbury',
      pending_action: 'stage_check',
      pending_payload: { stage_check: { fixture_id: 'f3', question_id: 't1', reason: 'need_part', stage_name: 'Trim Set' } },
      priority: 'normal',
      fixture_id: 'f3',
      checklist_question_id: 't1',
    })
    expect(await screen.findByText('Sent to Dispatch. The answer comes back on this row.')).toBeTruthy()

    // The sheet closes, the row wears the chip, and the press is gone from it.
    await waitFor(() => expect(sendSheet()).toBeNull())
    const chip = within(openRow()).getByText('With Dispatch · now · need a part')
    expect(chip.getAttribute('data-checklist-with-dispatch')).toBe('t1')
    expect(within(openRow()).queryByRole('button', { name: /^Send to Dispatch/ })).toBeNull()
  })

  it('wears the chip on a statement row already with Dispatch, and on its open row in place of the press', async () => {
    renderWithProviders(<JobStageChecklistStrip jobId={JOB} io={fakeIo(fakeDispatch({}, [SENT_T3]))} />)
    await openSheet()
    const statement = await screen.findByRole('button', { name: 'Is the pan drain run to the hub?: not answered yet. Open to answer.' })
    expect(within(statement).getByText('With Dispatch · 12 min · need a part')).toBeTruthy()
    fireEvent.click(statement)
    expect(within(openRow()).getByText('With Dispatch · 12 min · need a part')).toBeTruthy()
    expect(within(openRow()).queryByRole('button', { name: /^Send to Dispatch/ })).toBeNull()
  })

  it('reads the database’s dedupe as already with Dispatch and keeps the sheet open', async () => {
    const dispatch = fakeDispatch({ send: vi.fn(async () => { throw { code: '23505', message: 'duplicate key value violates unique constraint' } }) })
    renderWithProviders(<JobStageChecklistStrip jobId={JOB} io={fakeIo(dispatch)} />)
    await openSheet()
    fireEvent.click(await within(openRow()).findByRole('button', { name: 'Send to Dispatch: Did the final water test hold?' }))
    const sheet = await waitFor(() => {
      const el = sendSheet()
      expect(el).toBeTruthy()
      return el
    })
    fireEvent.click(within(sheet).getByRole('button', { name: 'Need a decision' }))
    fireEvent.click(screen.getByRole('button', { name: 'Send to Dispatch' }))
    expect(await screen.findByText('The check was not sent. Already with Dispatch. Dispatch has it.')).toBeTruthy()
    expect(sendSheet()).toBeTruthy()
  })

  it('draws no press when the io has no dispatch side', async () => {
    renderWithProviders(<JobStageChecklistStrip jobId={JOB} io={fakeIo(undefined)} />)
    await openSheet()
    await within(openRow()).findByRole('button', { name: 'Add a note' })
    expect(within(openRow()).queryByRole('button', { name: /^Send to Dispatch/ })).toBeNull()
  })
})

describe('Open the check from the inbox', () => {
  it('opens the stage’s sheet with that row open once the read lands', async () => {
    renderWithProviders(<JobStageChecklistStrip jobId={JOB} io={fakeIo(fakeDispatch())} openStage={{ fixtureId: 'f3', questionId: 't2' }} />)
    const row = await waitFor(() => {
      const el = openRow()
      expect(el).toBeTruthy()
      return el
    })
    expect(within(row).getByText('2. Are the cleanouts capped?')).toBeTruthy()
    expect(within(row).getByText('Open')).toBeTruthy()
  })
})
