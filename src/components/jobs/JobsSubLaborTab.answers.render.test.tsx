// @vitest-environment jsdom
/**
 * What a sub said back, on the Pay view (punch list #371, step 3): a quiet chip on a payment they marked received,
 * a flag on a sheet they sent a note about, and the press that marks the note answered. A payment nobody marked
 * says nothing: a sub who never taps Got it has done nothing wrong.
 */
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { installDomShims, makeLaborJob, renderWithProviders, settle } from '../../test/renderSmokeMocks'
import { NO_SUB_PAPER_ANSWERS, subPaperAnswers, type SubPaperAckRow, type SubPaperAnswers } from '../../lib/subWorkOrders/subPaperAnswers'
import JobsSubLaborTab from './JobsSubLaborTab'

const said: { answers: SubPaperAnswers; canAnswer: boolean; markAnswered: ReturnType<typeof vi.fn> } = { answers: NO_SUB_PAPER_ANSWERS, canAnswer: true, markAnswered: vi.fn(async () => ({ ok: true })) }

vi.mock('../../hooks/useIsNarrowScreen', () => ({ useIsNarrowScreen: () => false }))
vi.mock('../../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../../test/renderSmokeMocks')
  return { supabase: makeSupabaseStub() }
})
vi.mock('../../hooks/useAuth', async () => {
  const { useAuthModuleMock } = await import('../../test/renderSmokeMocks')
  return useAuthModuleMock({ role: 'assistant' })
})
vi.mock('../dispatchMode/DispatchModeFooter', () => ({ DISPATCH_MODE_FOOTER_HEIGHT_PX: 56 }))
vi.mock('../../hooks/useRosterSubKinds', () => ({ useRosterSubKinds: () => ({ loaded: true, roster: [{ id: 'sam', name: 'Sam Sub', kind: 'sub', accountRole: 'subcontractor' }] }) }))
vi.mock('./SubPapersWindowConnected', () => ({ SubPapersWindow: () => null }))
vi.mock('../../hooks/useSubPaperAnswers', () => ({ useSubPaperAnswers: () => said }))

beforeAll(installDomShims)
afterEach(cleanup)
beforeEach(() => {
  said.answers = NO_SUB_PAPER_ANSWERS
  said.canAnswer = true
  said.markAnswered = vi.fn(async () => ({ ok: true }))
})

// Made-up rows: one sheet of Sam's with two payments, one on a sending.
const sheet = makeLaborJob({
  id: 'sheet-1',
  assigned_to_name: 'Sam Sub',
  job_number: 'S-212',
  payments: [
    { id: 'pay-a', amount: 20, memo: null, created_at: '2026-11-02T10:00:00Z', method: 'check', sending_id: 'snd-7', sending_no: 7 },
    { id: 'pay-b', amount: 10, memo: null, created_at: '2026-10-02T10:00:00Z' },
  ],
})
const ack = (over: Partial<SubPaperAckRow>): SubPaperAckRow => ({ id: 'a', kind: 'received', person_id: 'sam', labor_job_id: null, sending_id: null, payment_id: null, note: null, said_by_name: 'Sam Sub', created_at: '2026-11-03T18:00:00Z', ...over })
const answersOf = (rows: SubPaperAckRow[]) => subPaperAnswers(rows, (iso) => iso.slice(0, 10))

function mount() {
  const p = {
    error: null,
    subLaborSearch: '',
    onSubLaborSearchChange: () => {},
    laborJobs: [sheet],
    laborJobsLoading: false,
    laborJobNamesByJobId: {},
    jobs: [],
    authUserId: 'u-1',
    laborJobAssigneesByJobId: new Map([['sheet-1', [{ personId: 'sam', personName: 'Sam Sub' }]]]),
    subLaborDueTotal: 0,
    onNewLaborJob: () => {},
    onEditLaborJob: vi.fn(),
    onPrintJobSubSheet: vi.fn(),
    onUpdateLaborJobDate: () => {},
    onSetLaborJobStage: () => {},
    onOpenMakePayment: vi.fn(),
    onOpenBackcharge: vi.fn(),
    hideToolbar: true,
  } as unknown as Parameters<typeof JobsSubLaborTab>[0]
  renderWithProviders(<JobsSubLaborTab {...p} />)
}
const openSheet = () => fireEvent.click([...document.querySelectorAll('tr')].find((tr) => tr.firstElementChild?.textContent === '▶') as HTMLElement)

describe('JobsSubLaborTab: what the sub said back', () => {
  it('a payment the sub marked received wears a quiet chip, and one nobody marked says nothing', async () => {
    said.answers = answersOf([ack({ id: 'r1', sending_id: 'snd-7' })])
    mount()
    await settle()
    openSheet()
    const chips = [...document.querySelectorAll('[data-sub-payment-received]')]
    expect(chips.map((c) => c.textContent)).toEqual([expect.stringMatching(/^Received Nov 3(, 2026)? · from their page$/)])
    expect(screen.queryByText(/Not marked received/)).toBeNull()
    expect(screen.queryByText(/⚑/)).toBeNull()
  })

  it('a note flags the sub’s group and the sheet, and the opened sheet reads it with Mark answered', async () => {
    said.answers = answersOf([ack({ id: 'n1', kind: 'something_wrong', labor_job_id: 'sheet-1', note: 'The back-charge was never talked about with me.' })])
    mount()
    await settle()
    expect(screen.getByTestId('sublabor-notes-waiting-sam').textContent).toBe('⚑ 1 note from their page')
    expect(screen.getByText('⚑ Something is wrong')).toBeTruthy()
    openSheet()
    const notes = screen.getByTestId('sublabor-notes-sheet-1')
    expect(notes.textContent).toMatch(/From the sub's page⚑ Sam Sub says something is wrong, Nov 3(, 2026)?: “The back-charge was never talked about with me\.”/)
    fireEvent.click(within(notes).getByRole('button', { name: 'Mark answered' }))
    await waitFor(() => expect(said.markAnswered).toHaveBeenCalledWith('n1'))
  })

  it('a note about a payment shows on the sheet it paid on', async () => {
    said.answers = answersOf([ack({ id: 'n2', kind: 'something_wrong', sending_id: 'snd-7', note: 'The check was short.' })])
    mount()
    await settle()
    openSheet()
    expect(screen.getByTestId('sublabor-notes-sheet-1').textContent).toContain('says something is wrong on a payment')
  })

  it('an answered note stops flagging and stays on the sheet with who answered it', async () => {
    said.answers = answersOf([ack({ id: 'n1', kind: 'something_wrong', labor_job_id: 'sheet-1', note: 'Wrong address.', answered_at: '2026-11-04T16:00:00Z', answered_by_name: 'Rosa Office' })])
    mount()
    await settle()
    expect(screen.queryByTestId('sublabor-notes-waiting-sam')).toBeNull()
    expect(screen.queryByText('⚑ Something is wrong')).toBeNull()
    openSheet()
    const notes = screen.getByTestId('sublabor-notes-sheet-1')
    expect(notes.textContent).toMatch(/Answered Nov 4(, 2026)? by Rosa Office/)
    expect(within(notes).queryByRole('button', { name: 'Mark answered' })).toBeNull()
  })

  it('a refusal says why, and a database without the answered columns offers no press', async () => {
    said.answers = answersOf([ack({ id: 'n1', kind: 'something_wrong', labor_job_id: 'sheet-1', note: 'Wrong address.' })])
    said.markAnswered = vi.fn(async () => ({ ok: false, message: 'A training account cannot mark a sub’s note answered.' }))
    mount()
    await settle()
    openSheet()
    fireEvent.click(screen.getByRole('button', { name: 'Mark answered' }))
    expect((await screen.findByRole('alert')).textContent).toBe('Not marked answered: A training account cannot mark a sub’s note answered.')
    cleanup()
    said.canAnswer = false
    mount()
    await settle()
    openSheet()
    expect(screen.getByTestId('sublabor-notes-sheet-1')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Mark answered' })).toBeNull()
  })
})
