// @vitest-environment jsdom
/**
 * The office's list of closed cases (punch list #443, row 5): a dev, a master, an assistant and a controller read
 * it, nobody else does, a case on any job is listed, a case closed as replaced is counted and never listed, and
 * the cases closed more than 90 days ago stay folded until one press. Every name is made up.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { renderWithProviders } from '../../../test/renderSmokeMocks'
import type { ArReturnCaseRow } from '../../../lib/jobs/arReturnCase'
import { ArClosedCases } from './ArClosedCases'

const io = vi.hoisted(() => ({ asked: [] as string[], refuse: null as null | Error }))
vi.mock('../../../lib/jobs/arCaseReopenIo', () => ({
  reopenArCase: async (id: string) => {
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
const TODAY = '2026-11-25'
const CASES: ArReturnCaseRow[] = [
  row({}),
  row({ mercury_transaction_id: 'case-2', counterparty_name: 'ZZ Test Second', closed_at: '2026-11-23T18:00:00Z', closed_reason: 'replaced', closed_note: null }),
  row({ mercury_transaction_id: 'real-1', counterparty_name: 'Larkfield Homes', closed_at: '2026-11-20T18:00:00Z', closed_reason: 'settled_other_way', closed_note: null, last_job: job('j-real', 'Larkfield Lot 9') }),
  row({ mercury_transaction_id: 'open-1', closed_at: null, closed_reason: null }),
  row({ mercury_transaction_id: 'old-1', counterparty_name: 'ZZ Test Old', closed_at: '2026-06-02T18:00:00Z', closed_note: null }),
]

const draw = (role: string, cases = CASES) => {
  const reopened = { n: 0 }
  renderWithProviders(<ArClosedCases role={role} allCases={cases} todayYmd={TODAY} onReopened={() => void (reopened.n += 1)} />)
  return reopened
}
const openList = () => fireEvent.click(within(screen.getByTestId('ar-closed-cases')).getByRole('button', { name: 'Show' }))

beforeEach(() => {
  io.asked = []
  io.refuse = null
})
afterEach(cleanup)

describe('ArClosedCases', () => {
  it('each row says what kind of case it is, on a line of its own (punch list #443, finding 255)', () => {
    draw('assistant', [
      row({ mercury_transaction_id: 'c-card', counterparty_name: 'ZZ Test Card', source: 'stripe_dispute', closed_at: '2026-11-24T18:00:00Z' }),
      row({ mercury_transaction_id: 'c-unbanked', counterparty_name: 'ZZ Test Unbanked', source: 'unbanked', closed_at: '2026-11-23T18:00:00Z' }),
      row({ mercury_transaction_id: 'c-check', counterparty_name: 'ZZ Test Check', closed_at: '2026-11-22T18:00:00Z' }),
    ])
    openList()
    expect(screen.getAllByTestId('ar-closed-kind').map((el) => el.textContent)).toEqual(['Card disputed', 'Check never deposited', 'Check came back'])
    // The kind sits in its own row's words, under who paid.
    const rows = screen.getAllByTestId('ar-closed-case')
    expect(rows[0]!.textContent).toContain('ZZ Test Card')
    expect(within(rows[0]!).getByTestId('ar-closed-kind').textContent).toBe('Card disputed')
  })

  it('draws the line for the four office roles', () => {
    for (const role of ['dev', 'master_technician', 'assistant', 'controller']) {
      draw(role)
      expect(screen.getByTestId('ar-closed-cases').textContent).toContain('Closed cases · 3')
      cleanup()
    }
  })

  it('draws nothing for every other role', () => {
    for (const role of ['estimator', 'primary', 'superintendent', 'subcontractor', 'helpers']) {
      draw(role)
      expect(screen.queryByTestId('ar-closed-cases')).toBeNull()
      cleanup()
    }
  })

  it('draws nothing when no closed case can be reopened', () => {
    draw('assistant', [CASES[1]!, CASES[3]!])
    expect(screen.queryByTestId('ar-closed-cases')).toBeNull()
  })

  it('as an assistant, lists the cases closed by hand on any job behind Show, newest first, and counts the rest', () => {
    draw('assistant')
    expect(screen.queryAllByTestId('ar-closed-case')).toHaveLength(0)
    openList()
    const lines = screen.getAllByTestId('ar-closed-case')
    expect(lines).toHaveLength(2)
    expect(lines[0]!.textContent).toContain('ZZ Test Payer')
    expect(lines[0]!.textContent).toContain('ZZ TEST walk job')
    expect(lines[0]!.textContent).toContain('Closed as not coming on Tue, Nov 24. ZZ TEST walk')
    expect(lines[1]!.textContent).toContain('Larkfield Homes')
    expect(lines[1]!.textContent).toContain('Closed as settled another way on Fri, Nov 20.')
    const box = screen.getByTestId('ar-closed-cases')
    expect(box.textContent).not.toContain('ZZ Test Second')
    expect(box.textContent).not.toContain('Only a developer')
    expect(screen.getByTestId('ar-closed-others').textContent).toBe('1 closed case is not listed. A case closed by a new payment or by Stripe’s answer stays closed.')
  })

  it('folds the cases closed more than 90 days ago behind one press that says how many', () => {
    draw('controller')
    openList()
    expect(screen.getByTestId('ar-closed-cases').textContent).not.toContain('ZZ Test Old')
    const older = screen.getByTestId('ar-closed-older')
    expect(older.textContent).toBe('Show 1 older case')
    fireEvent.click(older)
    const lines = screen.getAllByTestId('ar-closed-case')
    expect(lines).toHaveLength(3)
    expect(lines[2]!.textContent).toContain('ZZ Test Old')
    expect(screen.queryByTestId('ar-closed-older')).toBeNull()
  })

  it('draws the older cases at once when every case is an older one', () => {
    draw('master_technician', [CASES[4]!])
    openList()
    expect(screen.getAllByTestId('ar-closed-case')).toHaveLength(1)
    expect(screen.queryByTestId('ar-closed-older')).toBeNull()
  })

  it('reopens a case on a real job after a confirm that names the act and says it stands open, then reads the page again', async () => {
    const reopened = draw('assistant')
    openList()
    fireEvent.click(screen.getByRole('button', { name: 'Reopen the case of Larkfield Homes' }))
    const yes = await screen.findByRole('button', { name: 'Reopen the case' })
    expect(screen.getByText('Reopen the case of Larkfield Homes?')).toBeTruthy()
    expect(screen.getByText(/It stands open there until someone closes it again\./)).toBeTruthy()
    expect(io.asked).toEqual([])
    fireEvent.click(yes)
    await waitFor(() => expect(io.asked).toEqual(['real-1']))
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

  it('says the reason when the fresh read refuses, and the page is not read again', async () => {
    io.refuse = new Error('This case is open already.')
    const reopened = draw('assistant')
    openList()
    fireEvent.click(screen.getByRole('button', { name: 'Reopen the case of ZZ Test Payer' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Reopen the case' }))
    expect(await screen.findByText('This case is open already.')).toBeTruthy()
    expect(reopened.n).toBe(0)
  })

  it('stands each press a thumb tall', () => {
    draw('assistant')
    openList()
    for (const b of within(screen.getByTestId('ar-closed-cases')).getAllByRole('button')) expect((b as HTMLButtonElement).style.minHeight).toBe('44px')
  })
})
