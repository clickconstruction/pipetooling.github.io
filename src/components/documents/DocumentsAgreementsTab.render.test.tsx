// @vitest-environment jsdom
/**
 * Documents → Agreements (punch list #376): every agreement on file, newest first under a band per month, with a kind
 * and a state to pick and a box to type in; a line says its kind, its name, who it is with, the job, where it stands
 * and its day, and a press opens the window that kind already has; the list says so when nothing matches or nothing is
 * on file; a read that fails says so with Retry; under the Search tab it asks only for the words it is handed.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, screen, waitFor } from '@testing-library/react'
import { renderWithProviders } from '../../test/renderSmokeMocks'
import type { AgreementRow, AgreementsQuery } from '../../lib/documents/agreementsLedger'
import { DocumentsAgreementsTab } from './DocumentsAgreementsTab'

const io = vi.hoisted(() => ({
  rows: [] as unknown[],
  more: false,
  waiting: 0 as number | null,
  asks: [] as Array<{ kind: string; state: string; typed: string; limit: number }>,
  counts: [] as string[],
  fail: null as null | Error,
  jobs: [] as string[],
  windows: [] as string[],
}))
vi.mock('../../hooks/useAuth', () => {
  const auth = () => ({ role: 'assistant', user: { id: 'u1' } })
  return { useAuth: auth, useOptionalAuth: auth }
})
vi.mock('../../lib/documents/agreementsLedgerIo', () => ({
  readAgreements: async (q: AgreementsQuery) => {
    io.asks.push({ kind: q.kind, state: q.state, typed: q.typed, limit: q.limit })
    if (io.fail) throw io.fail
    return { rows: io.rows, more: io.more }
  },
  countAgreementsWaiting: async (kind: string) => {
    io.counts.push(kind)
    return io.waiting
  },
}))
vi.mock('../../lib/fetchJobWithDetailsById', () => ({
  fetchJobWithDetailsById: async (id: string) => {
    io.jobs.push(id)
    return { id, hcp_number: '2418', click_number: '', job_name: 'Pierce kitchen repipe', job_address: '410 Maple St', customer_name: 'Harlan Pierce' }
  },
}))
vi.mock('../../lib/jobs/jobLienPaperIo', () => ({ loadJobContractRows: async () => [] }))
// The windows themselves are their own files' to test: here each says it opened, and on what.
vi.mock('../jobs/JobContractModal', () => ({
  default: (p: { open: boolean; job: { id: string } | null; initialRecordId?: string | null }) => (p.open ? <div data-testid="contract-window">{`${p.job?.id}|${p.initialRecordId}`}</div> : null),
}))
vi.mock('../jobs/JobContractRecordModal', () => ({ buildJobContractRecordHtml: () => '<html></html>' }))
vi.mock('../contracts/PersonContractSignedRecordModal', () => ({
  PersonContractSignedRecordModal: (p: { open: boolean; documentId: string | null }) => (p.open ? <div data-testid="signed-record-window">{p.documentId}</div> : null),
}))
vi.mock('../jobs/WorkOrderAssemblerModal', () => ({
  WorkOrderAssemblerModal: (p: { open: boolean; jobs: Array<{ id: string }>; initial: { commitmentId?: string | null } | null }) =>
    p.open ? <div data-testid="work-order-window">{`${p.jobs[0]?.id}|${p.initial?.commitmentId}`}</div> : null,
}))

/** Every name, job and date here is made up. */
const row = (over: Partial<AgreementRow>): AgreementRow => ({
  id: 'job_contract:c1',
  kind: 'job_contract',
  source_id: 'c1',
  state: 'signed',
  paper_name: 'Residential plumbing contract',
  with_name: 'Harlan Pierce',
  job_id: 'j1',
  job_hcp_number: '2418',
  job_click_number: '',
  job_name: 'Pierce kitchen repipe',
  job_address: '410 Maple St',
  more_jobs: 0,
  person_id: null,
  person_kind: null,
  at: '2026-11-14T18:00:00Z',
  at_day: '2026-11-14',
  facts: { status: 'signed', signer_mode: 'type', signed_at: '2026-11-14T18:00:00Z' },
  ...over,
})
const lastAsk = () => io.asks[io.asks.length - 1]
const lines = () => screen.findAllByTestId('documents-agreements-row')

beforeEach(() => {
  io.rows = []
  io.more = false
  io.waiting = 0
  io.asks = []
  io.counts = []
  io.fail = null
  io.jobs = []
})
afterEach(() => {
  cleanup()
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('DocumentsAgreementsTab', () => {
  it('lists each agreement as a line under its month: kind, name, who and which job, where it stands, its day', async () => {
    io.waiting = 1
    io.rows = [
      row({ id: 'job_contract:c2', source_id: 'c2', state: 'waiting', at_day: '2026-11-16', facts: { status: 'sent', send_count: 2, view_count: 3, sent_channel: 'link' } }),
      row({ id: 'person_agreement:d1', kind: 'person_agreement', source_id: 'd1', paper_name: 'Employee handbook', with_name: 'Priya Nair', job_id: null, job_hcp_number: null, job_click_number: null, job_name: null, job_address: null, person_kind: 'helper', at_day: '2026-10-20', facts: { status: 'signed' } }),
      row({ id: 'job_contract:c5', source_id: 'c5', paper_name: '', with_name: 'Dalton Property Group', job_id: 'j3', job_hcp_number: '2377', job_name: 'Dalton duplex A', more_jobs: 2, at_day: '2026-10-30', facts: { status: 'signed', signer_mode: 'paper', has_upload: true, signed_at: '2026-10-30T12:00:00Z' } }),
    ]
    renderWithProviders(<DocumentsAgreementsTab />)
    const rows = await lines()
    expect(rows.map((r) => r.textContent)).toEqual([
      expect.stringMatching(/^ContractResidential plumbing contractWith Harlan Pierce · J2418 · Pierce kitchen repipe · 410 Maple Stsent ×2 · opened 3×Sent Nov 16$/),
      expect.stringMatching(/^StaffEmployee handbookWith Priya Nairsigned ✓Signed Oct 20$/),
      expect.stringMatching(/^ContractSigned paper · scanWith Dalton Property Group · J2377 · Dalton duplex A · and 2 more jobson file · paperSigned Oct 30$/),
    ])
    expect(screen.getAllByTestId('documents-agreements-month').map((h) => h.textContent)).toEqual(['November 20261 agreement', 'October 20262 agreements'])
    expect(screen.getByTestId('documents-agreements-count').textContent).toBe('3 agreements')
    // The job on a line opens the job; the chip that waits carries its count.
    expect(screen.getByRole('link', { name: 'J2377 · Dalton duplex A' }).getAttribute('href')).toBe('/jobs?edit=j3')
    await waitFor(() => expect(screen.getByRole('button', { name: 'Waiting on a signature · 1' })).toBeTruthy())
    expect(io.asks[0]).toEqual({ kind: 'all', state: 'live', typed: '', limit: 100 })
    expect(screen.getByTestId('documents-agreements-doors').textContent).toBe('A job with no contract is in the Contract sweep, under Tools on the Pipeline. An accepted estimate is on the Estimates tab.')
  })

  it('asks again for a chip at once, and for typed words once the typing rests', async () => {
    renderWithProviders(<DocumentsAgreementsTab />)
    await screen.findByTestId('documents-agreements-empty')
    fireEvent.click(screen.getByRole('button', { name: 'Work orders' }))
    await waitFor(() => expect(lastAsk()).toEqual({ kind: 'orders', state: 'live', typed: '', limit: 100 }))
    await waitFor(() => expect(io.counts[io.counts.length - 1]).toBe('orders'))
    fireEvent.click(screen.getByRole('button', { name: 'Voided or ended' }))
    await waitFor(() => expect(lastAsk()).toEqual({ kind: 'orders', state: 'ended', typed: '', limit: 100 }))
    expect(screen.getByRole('button', { name: 'Voided or ended' }).getAttribute('aria-pressed')).toBe('true')
    vi.useFakeTimers()
    const before = io.asks.length
    fireEvent.change(screen.getByLabelText('Find an agreement'), { target: { value: 'cedar' } })
    expect(io.asks.length).toBe(before)
    await act(async () => {
      await vi.advanceTimersByTimeAsync(350)
    })
    expect(lastAsk()).toEqual({ kind: 'orders', state: 'ended', typed: 'cedar', limit: 100 })
  })

  it('with nothing on file names the page that fills it, and with nothing matching offers to clear', async () => {
    renderWithProviders(<DocumentsAgreementsTab />)
    const empty = await screen.findByTestId('documents-agreements-empty')
    expect(empty.textContent).toBe('No agreements yet. Pipeline is where a contract is sent to sign.')
    expect(screen.getAllByRole('link', { name: 'Pipeline' })[0]?.getAttribute('href')).toBe('/jobs?tab=stages')
    fireEvent.click(screen.getByRole('button', { name: 'Partners' }))
    await waitFor(() => expect(screen.getByTestId('documents-agreements-empty').textContent).toBe('No agreements match the filters. Clear the filters'))
    fireEvent.click(screen.getByRole('button', { name: 'Clear the filters' }))
    await waitFor(() => expect(lastAsk()).toEqual({ kind: 'all', state: 'live', typed: '', limit: 100 }))
    expect(screen.getByRole('button', { name: 'All' }).getAttribute('aria-pressed')).toBe('true')
  })

  it('reads the next page on Show more, and says the list is the newest while more waits', async () => {
    io.rows = [row({})]
    io.more = true
    renderWithProviders(<DocumentsAgreementsTab />)
    await lines()
    expect(screen.getByTestId('documents-agreements-count').textContent).toBe('The newest 1 agreement')
    fireEvent.click(screen.getByRole('button', { name: 'Show more' }))
    await waitFor(() => expect(lastAsk()?.limit).toBe(200))
  })

  it('says so when the read fails, and reads again on Retry', async () => {
    io.fail = new Error('Failed to fetch')
    renderWithProviders(<DocumentsAgreementsTab />)
    const retry = await screen.findByRole('button', { name: /retry/i })
    expect(screen.queryByTestId('documents-agreements-empty')).toBeNull()
    io.fail = null
    io.rows = [row({})]
    fireEvent.click(retry)
    expect((await lines()).length).toBe(1)
  })

  it('a signed contract opens the Contract window on its record', async () => {
    io.rows = [row({})]
    renderWithProviders(<DocumentsAgreementsTab />)
    await lines()
    fireEvent.click(screen.getByRole('button', { name: 'Residential plumbing contract' }))
    expect((await screen.findByTestId('contract-window')).textContent).toBe('j1|c1')
    expect(io.jobs).toEqual(['j1'])
  })

  it('an unsigned contract opens its preview in a window, inside the press', async () => {
    io.rows = [row({ state: 'waiting', facts: { status: 'sent', send_count: 1 } })]
    const opened = vi.spyOn(window, 'open').mockReturnValue(null)
    renderWithProviders(<DocumentsAgreementsTab />)
    await lines()
    fireEvent.click(screen.getByRole('button', { name: 'Residential plumbing contract' }))
    expect(opened).toHaveBeenCalledWith('', '_blank')
    // A blocked popup says so in words, and no Contract window opens in its place.
    expect(await screen.findByText('The contract did not open. Allow popups for this page, then press it again.')).toBeTruthy()
    expect(screen.queryByTestId('contract-window')).toBeNull()
  })

  it('a person’s signed agreement opens its record, and one still waiting is a link to People → Contracts', async () => {
    io.rows = [
      row({ id: 'person_agreement:d1', kind: 'person_agreement', source_id: 'd1', paper_name: 'Employee handbook', with_name: 'Priya Nair', job_id: null, job_name: null, job_hcp_number: null, facts: { status: 'signed' } }),
      row({ id: 'partner_agreement:d2', kind: 'partner_agreement', source_id: 'd2', state: 'waiting', paper_name: 'Referral partner agreement', with_name: 'Bryce Tolland', job_id: null, job_name: null, job_hcp_number: null, facts: { status: 'sent' } }),
    ]
    renderWithProviders(<DocumentsAgreementsTab />)
    await lines()
    expect(screen.getByRole('link', { name: 'Referral partner agreement' }).getAttribute('href')).toBe('/people?tab=contracts&doc=d2')
    fireEvent.click(screen.getByRole('button', { name: 'Employee handbook' }))
    expect((await screen.findByTestId('signed-record-window')).textContent).toBe('d1')
  })

  it('a work order opens its window on the job, and one with no job is not a press', async () => {
    io.rows = [
      row({ id: 'work_order:w1', kind: 'work_order', source_id: 'w1', paper_name: 'WO-2418-01', with_name: 'Tall Pine Excavating', state: 'waiting', facts: { status: 'offered', offered_at: '2026-11-05T15:00:00Z' } }),
      row({ id: 'work_order:w2', kind: 'work_order', source_id: 'w2', paper_name: 'WO-2360-02', with_name: 'Granite Core Drilling', state: 'ended', job_id: null, job_name: null, job_hcp_number: null, facts: { status: 'declined' } }),
    ]
    renderWithProviders(<DocumentsAgreementsTab />)
    await lines()
    expect(screen.queryByRole('button', { name: 'WO-2360-02' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'WO-2418-01' }))
    expect((await screen.findByTestId('work-order-window')).textContent).toBe('j1|w1')
  })

  it('under the Search tab draws no box, stays quiet until two letters, then asks for the words it is handed', async () => {
    const view = renderWithProviders(<DocumentsAgreementsTab embedSearch="" />)
    expect(screen.getByTestId('documents-agreements-embed-hint').textContent).toBe('Results appear when you type a search above.')
    expect(screen.queryByLabelText('Find an agreement')).toBeNull()
    expect(io.asks).toEqual([])
    io.rows = [row({})]
    view.rerender(<DocumentsAgreementsTab embedSearch="pierce" />)
    await lines()
    expect(lastAsk()).toEqual({ kind: 'all', state: 'live', typed: 'pierce', limit: 100 })
    expect(screen.queryByTestId('documents-agreements-doors')).toBeNull()
  })
})
