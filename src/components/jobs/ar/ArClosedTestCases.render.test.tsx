// @vitest-environment jsdom
/**
 * The dev's list of closed test cases (punch list #443, row 5): a dev reads it, nobody else does, a case on a real
 * job is counted and never listed, and a case closed as replaced stays and says why. Every name is made up.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { renderWithProviders } from '../../../test/renderSmokeMocks'
import type { ArReturnCaseRow } from '../../../lib/jobs/arReturnCase'
import { ArClosedTestCases } from './ArClosedTestCases'

const io = vi.hoisted(() => ({ asked: [] as string[], refuse: null as null | Error }))
vi.mock('../../../lib/jobs/arCaseReopenIo', () => ({
  reopenArTestCase: async (id: string) => {
    if (io.refuse) throw io.refuse
    io.asked.push(id)
  },
}))

const job = (id: string, name: string) => ({ job_id: id, job_number: '900', job_name: name, removed_at: null, removed_by: null })
const row = (over: Partial<ArReturnCaseRow>): ArReturnCaseRow => ({
  mercury_transaction_id: 'case-1',
  counterparty_name: 'ZZ Test Payer',
  amount: 125,
  kind: 'checkDeposit',
  posted_at: null,
  failed_at: null,
  bank_reason: null,
  source: 'bank',
  opened_at: '2026-11-22T15:00:00Z',
  closed_at: '2026-11-24T18:00:00Z',
  closed_reason: 'not_coming',
  closed_note: 'ZZ TEST walk',
  closed_by: 'Priya',
  replaced_by_mercury_transaction_id: null,
  notified_at: null,
  live_payments: [],
  last_job: job('j-zz', 'ZZ TEST walk job'),
  recorded_payment: null,
  ...over,
})
const CASES: ArReturnCaseRow[] = [
  row({}),
  row({ mercury_transaction_id: 'case-2', counterparty_name: 'ZZ Test Second', closed_at: '2026-11-23T18:00:00Z', closed_reason: 'replaced', closed_note: null }),
  row({ mercury_transaction_id: 'real-1', counterparty_name: 'Larkfield Homes', last_job: job('j-real', 'Larkfield Lot 9') }),
  row({ mercury_transaction_id: 'open-1', closed_at: null, closed_reason: null }),
]

const draw = (role: string, cases = CASES) => {
  const reopened = { n: 0 }
  renderWithProviders(<ArClosedTestCases role={role} allCases={cases} onReopened={() => void (reopened.n += 1)} />)
  return reopened
}
const openList = () => fireEvent.click(within(screen.getByTestId('ar-closed-test-cases')).getByRole('button', { name: 'Show' }))

beforeEach(() => {
  io.asked = []
  io.refuse = null
})
afterEach(cleanup)

describe('ArClosedTestCases', () => {
  it('draws nothing for every role but a dev', () => {
    for (const role of ['master_technician', 'assistant', 'controller', 'estimator', 'primary', 'superintendent', 'subcontractor', 'helpers']) {
      draw(role)
      expect(screen.queryByTestId('ar-closed-test-cases')).toBeNull()
      cleanup()
    }
  })

  it('draws nothing for a dev when no closed case is on a test job', () => {
    draw('dev', [CASES[2]!, CASES[3]!])
    expect(screen.queryByTestId('ar-closed-test-cases')).toBeNull()
  })

  it('lists the closed cases on test jobs behind Show, and counts the real ones without naming them', () => {
    draw('dev')
    const box = screen.getByTestId('ar-closed-test-cases')
    expect(box.textContent).toContain('Closed test cases · 2')
    expect(screen.queryAllByTestId('ar-closed-test-case')).toHaveLength(0)
    openList()
    const lines = screen.getAllByTestId('ar-closed-test-case')
    expect(lines).toHaveLength(2)
    expect(lines[0]!.textContent).toContain('ZZ Test Payer')
    expect(lines[0]!.textContent).toContain('ZZ TEST walk job')
    expect(lines[0]!.textContent).toContain('Closed as not coming on Tue, Nov 24. ZZ TEST walk')
    expect(box.textContent).not.toContain('Larkfield')
    expect(screen.getByTestId('ar-closed-others').textContent).toBe('1 closed case is not listed. Only a case on a test job can be reopened here.')
  })

  it('reopens a test case after a confirm that names the act, then reads the page again', async () => {
    const reopened = draw('dev')
    openList()
    fireEvent.click(screen.getByRole('button', { name: 'Reopen the case of ZZ Test Payer' }))
    const yes = await screen.findByRole('button', { name: 'Reopen the case' })
    expect(screen.getByText('Reopen the case of ZZ Test Payer?')).toBeTruthy()
    expect(io.asked).toEqual([])
    fireEvent.click(yes)
    await waitFor(() => expect(io.asked).toEqual(['case-1']))
    await waitFor(() => expect(reopened.n).toBe(1))
    expect(await screen.findByText('The case is open again. It is under Came back.')).toBeTruthy()
  })

  it('reopens nothing when the confirm is cancelled', async () => {
    const reopened = draw('dev')
    openList()
    fireEvent.click(screen.getByRole('button', { name: 'Reopen the case of ZZ Test Payer' }))
    await screen.findByRole('button', { name: 'Reopen the case' })
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Reopen the case' })).toBeNull())
    expect(io.asked).toEqual([])
    expect(reopened.n).toBe(0)
  })

  it('keeps a test case closed as replaced: a dead press, and the line says why', () => {
    draw('dev')
    openList()
    const press = screen.getByRole('button', { name: 'Reopen the case of ZZ Test Second' }) as HTMLButtonElement
    expect(press.disabled).toBe(true)
    expect(screen.getByTestId('ar-closed-test-case-why').textContent).toBe('Only a case closed as settled another way or as not coming can be reopened.')
    fireEvent.click(press)
    expect(screen.queryByRole('button', { name: 'Reopen the case' })).toBeNull()
  })

  it('says the reason when the fresh read refuses, and the page is not read again', async () => {
    io.refuse = new Error('Only a case on a test job can be reopened. This one names a real job.')
    const reopened = draw('dev')
    openList()
    fireEvent.click(screen.getByRole('button', { name: 'Reopen the case of ZZ Test Payer' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Reopen the case' }))
    expect(await screen.findByText('Only a case on a test job can be reopened. This one names a real job.')).toBeTruthy()
    expect(reopened.n).toBe(0)
  })

  it('stands each press a thumb tall', () => {
    draw('dev')
    openList()
    for (const b of within(screen.getByTestId('ar-closed-test-cases')).getAllByRole('button')) expect((b as HTMLButtonElement).style.minHeight).toBe('44px')
  })
})
