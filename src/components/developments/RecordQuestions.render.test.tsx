// @vitest-environment jsdom
/**
 * Questions on a record (punch list #208 PR 4b): the section a job's or a bid's window draws with its
 * own log and the two Ask presses. Harlow Ranch's made-up rows; nothing is real.
 */
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import type { MemberRequest } from '../../lib/developments/overview'
import { installDomShims, renderWithProviders } from '../../test/renderSmokeMocks'
import { RecordQuestions, type RecordQuestionsIo } from './RecordQuestions'

vi.mock('../../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../../test/renderSmokeMocks')
  return { supabase: makeSupabaseStub() }
})

vi.mock('../../hooks/useAuth', async () => {
  const { useAuthModuleMock } = await import('../../test/renderSmokeMocks')
  return useAuthModuleMock()
})

beforeAll(installDomShims)
afterEach(cleanup)

function req(p: Partial<MemberRequest> & { id: string; created_at: string }): MemberRequest {
  return { lane: 'estimators', title: 'q', status: 'open', priority: null, closed_at: null, closed_note: null, from_user_id: 'u-robert', bid_id: null, job_ledger_id: null, development_id: null, reference_summary: null, notes: [], ...p }
}

const JOB = { id: 'j1', hcp_number: '1085', click_number: null, job_name: 'Lot 14 rough-in', service_type_id: null, linkedBid: { id: 'b1', bid_number: '418', project_name: 'Lodge', service_type_id: null } }
const BID = { id: 'b1', bid_number: '418', project_name: 'Lodge', service_type_id: null }
const NAMES = new Map([
  ['u-robert', 'Robert'],
  ['u-wendi', 'Wendi'],
])
const ROWS: MemberRequest[] = [
  req({ id: 'answered', lane: 'estimators', created_at: '2026-10-20T15:00:00Z', job_ledger_id: 'j1', title: 'Did the Oct 20 set change the gas count?', status: 'closed', closed_at: '2026-10-21T15:00:00Z', closed_note: 'No, same count.', notes: [{ id: 'n1', author_user_id: 'u-wendi', body: 'Checked sheet P-3: same count.', created_at: '2026-10-21T14:00:00Z' }] }),
  req({ id: 'waiting', lane: 'dispatch', created_at: '2026-10-26T15:00:00Z', job_ledger_id: 'j1', title: 'Is a crew booked for the tie-in?' }),
  req({ id: 'from-bid', lane: 'estimators', created_at: '2026-10-18T15:00:00Z', bid_id: 'b1', title: 'Which set did we price from?', status: 'closed', closed_at: '2026-10-19T15:00:00Z', closed_note: 'The Sep 3 set.' }),
]

function makeIo(rows: MemberRequest[]): RecordQuestionsIo & { read: ReturnType<typeof vi.fn>; send: ReturnType<typeof vi.fn> } {
  return {
    read: vi.fn(async () => ({ requests: rows, names: NAMES })),
    send: vi.fn(async () => ({ id: 'new', pushed: true, pushError: null })),
  }
}

describe('RecordQuestions on a job', () => {
  it('draws the title, the counts, the log open first, and the bid question marked', async () => {
    const io = makeIo(ROWS)
    renderWithProviders(<RecordQuestions record={{ kind: 'job', job: JOB }} role="dev" io={io} />)
    expect(await screen.findByText('Questions on this job')).toBeTruthy()
    expect(io.read).toHaveBeenCalledWith({ kind: 'job', id: 'j1' }, 'b1')
    await waitFor(() => expect(screen.getByTestId('record-questions-meta').textContent).toBe('1 waiting · 2 answered'))
    const rows = screen.getAllByTestId(/^question-row-/)
    expect(rows.map((r) => r.getAttribute('data-testid'))).toEqual(['question-row-waiting', 'question-row-answered', 'question-row-from-bid'])
    expect(rows[0]!.getAttribute('data-open')).toBe('1')
    expect(screen.getByText('Is a crew booked for the tie-in?')).toBeTruthy()
    expect(screen.getByText('Checked sheet P-3: same count.')).toBeTruthy()
    expect(screen.getByText('Closed · No, same count.')).toBeTruthy()
    expect(screen.getByTestId('question-asked-on').textContent).toBe('asked on B418 Lodge')
    expect(within(rows[0]!).getByText('Robert → Dispatch')).toBeTruthy()
  })

  it('Ask Dispatch opens the sheet on this job with the lane chosen, and the send names the job', async () => {
    const io = makeIo(ROWS)
    renderWithProviders(<RecordQuestions record={{ kind: 'job', job: JOB }} role="dev" io={io} />)
    await screen.findByText('Questions on this job')
    fireEvent.click(screen.getByRole('button', { name: 'Ask Dispatch' }))
    const sheet = await screen.findByRole('dialog', { name: 'Ask a question' })
    expect(within(sheet).getByText('Ask a question about J1085 Lot 14 rough-in')).toBeTruthy()
    expect(within(sheet).getByTestId('ask-lane-dispatch').getAttribute('aria-checked')).toBe('true')
    const about = within(sheet).getByTestId('ask-about') as HTMLSelectElement
    expect(Array.from(about.options).map((o) => o.textContent)).toEqual(['J1085 Lot 14 rough-in'])
    expect(within(sheet).getByText(/with this job named on it/)).toBeTruthy()
    fireEvent.change(within(sheet).getByTestId('ask-title'), { target: { value: 'Crew Thursday?' } })
    fireEvent.click(within(sheet).getByRole('button', { name: 'Ask Dispatch' }))
    await waitFor(() => expect(io.send).toHaveBeenCalledTimes(1))
    expect(io.send).toHaveBeenCalledWith('dispatch', { from_user_id: 'smoke-auth-user-1', title: 'Crew Thursday?', links: [], development_id: null, job_ledger_id: 'j1', bid_id: null, reference_summary: 'J1085 Lot 14 rough-in' })
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Ask a question' })).toBeNull())
    expect(io.read).toHaveBeenCalledTimes(2)
  })

  it('Escape closes the sheet, taken before the window under it sees it', async () => {
    const io = makeIo(ROWS)
    const under = vi.fn()
    window.addEventListener('keydown', under)
    try {
      renderWithProviders(<RecordQuestions record={{ kind: 'job', job: JOB }} role="dev" io={io} />)
      await screen.findByText('Questions on this job')
      fireEvent.click(screen.getByRole('button', { name: 'Ask the estimators' }))
      const sheet = await screen.findByRole('dialog', { name: 'Ask a question' })
      fireEvent.keyDown(within(sheet).getByTestId('ask-title'), { key: 'Escape' })
      await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Ask a question' })).toBeNull())
      expect(under).not.toHaveBeenCalled()
    } finally {
      window.removeEventListener('keydown', under)
    }
  })
})

describe('RecordQuestions on a bid', () => {
  it('draws the bid title, no mark, and the empty state with its press', async () => {
    const io = makeIo([])
    renderWithProviders(<RecordQuestions record={{ kind: 'bid', bid: BID }} role="estimator" io={io} />)
    expect(await screen.findByText('Questions on this bid')).toBeTruthy()
    expect(io.read).toHaveBeenCalledWith({ kind: 'bid', id: 'b1' }, null)
    await waitFor(() => expect(screen.getByTestId('record-questions-meta').textContent).toBe('none yet'))
    expect(screen.getByText(/Nothing asked about this bid yet\./)).toBeTruthy()
    expect(screen.queryByTestId('question-asked-on')).toBeNull()
    fireEvent.click(screen.getAllByRole('button', { name: 'Ask the estimators' })[0]!)
    const sheet = await screen.findByRole('dialog', { name: 'Ask a question' })
    expect(within(sheet).getByTestId('ask-lane-estimators').getAttribute('aria-checked')).toBe('true')
    expect(within(sheet).getByText(/with this bid named on it/)).toBeTruthy()
  })

  it('a failed read says why and offers nothing else; the field never sees the section', async () => {
    const io = { read: vi.fn(async () => { throw new Error('Network request failed') }), send: vi.fn() }
    renderWithProviders(<RecordQuestions record={{ kind: 'bid', bid: BID }} role="dev" io={io} />)
    expect(await screen.findByText(/Network request failed|could not reach|offline|connection/i)).toBeTruthy()
    cleanup()
    const io2 = makeIo(ROWS)
    renderWithProviders(<RecordQuestions record={{ kind: 'bid', bid: BID }} role="primary" io={io2} />)
    expect(screen.queryByText('Questions on this bid')).toBeNull()
    expect(io2.read).not.toHaveBeenCalled()
  })
})
