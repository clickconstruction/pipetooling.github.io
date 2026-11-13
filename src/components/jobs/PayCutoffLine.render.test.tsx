// @vitest-environment jsdom
/**
 * Render-smoke tests for the cutoff on a bill not yet sent (punch list #323, PR 3): the row's line
 * says both days and turns amber in the cutoff's last week, its first sentence opens the payer's
 * calendar when there is an opener, and Bill Customer's line reads the payer's calendar by itself and
 * draws nothing for a payer with none or on a read that fails. Every name is made up.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, waitFor } from '@testing-library/react'
import { PAY_CALENDAR_DEFAULT, payCutoffLine, type PayCalendarRow } from '../../lib/jobs/payCalendar'

const { io } = vi.hoisted(() => ({ io: { loadPayerPayCalendars: vi.fn() } }))

vi.mock('../../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../../test/renderSmokeMocks')
  return { supabase: makeSupabaseStub() }
})
vi.mock('../../lib/jobs/payCalendarIo', () => io)
vi.mock('../../utils/dateUtils', async (importOriginal) => ({ ...(await importOriginal<typeof import('../../utils/dateUtils')>()), todayYmdInAppTz: () => '2026-11-12' }))

import { installDomShims, renderWithProviders } from '../../test/renderSmokeMocks'
import PayCutoffLine from './PayCutoffLine'
import { BillCustomerPayCutoffLine } from './BillCustomerPayCutoffLine'

installDomShims()

const payerRow = (over: Partial<PayCalendarRow> = {}): PayCalendarRow => ({ payerCustomerId: 'payer-1', jobId: null, off: false, calendar: PAY_CALENDAR_DEFAULT, setByName: null, setAt: null, ...over })

beforeEach(() => {
  io.loadPayerPayCalendars.mockReset().mockResolvedValue([payerRow()])
})

describe('PayCutoffLine', () => {
  it('says the last day to send and what one day late costs, blue while the cutoff is far', () => {
    renderWithProviders(<PayCutoffLine line={payCutoffLine('2026-11-12', PAY_CALENDAR_DEFAULT)!} payerName="Larkfield Construction" />)
    const line = screen.getByTestId('pay-cutoff-line')
    expect(line.textContent).toBe('Send by Nov 30 to be due Dec 10. After that, Jan 10.')
    expect(line.getAttribute('data-soon')).toBe('false')
    expect(line.getAttribute('title')).toBe('Larkfield Construction: A bill in by the last day of the month is paid the 10th of the next month. The cutoff is in 18 days.')
    expect(screen.queryByRole('button')).toBeNull()
  })

  it('asks in amber in the last week, and its first sentence opens the calendar', () => {
    const onOpen = vi.fn()
    renderWithProviders(<PayCutoffLine line={payCutoffLine('2026-11-25', PAY_CALENDAR_DEFAULT)!} payerName="Larkfield Construction" onOpen={onOpen} />)
    expect(screen.getByTestId('pay-cutoff-line').getAttribute('data-soon')).toBe('true')
    fireEvent.click(screen.getByRole('button', { name: 'Send by Nov 30 to be due Dec 10. Open the pay calendar for Larkfield Construction' }))
    expect(onOpen).toHaveBeenCalledTimes(1)
  })
})

describe('BillCustomerPayCutoffLine', () => {
  it("reads the payer's calendar and says what sending today makes the bill", async () => {
    renderWithProviders(<BillCustomerPayCutoffLine payerCustomerId="payer-1" jobId="job-1" />)
    await waitFor(() => expect(screen.getByTestId('bill-customer-pay-cutoff').textContent).toBe('Sent today, this bill is due Dec 10. Their cutoff is Nov 30. After that, Jan 10.'))
    expect(io.loadPayerPayCalendars).toHaveBeenCalledWith(expect.anything(), 'payer-1')
  })

  it("follows the job's own row over the payer's, and draws nothing where the job switches it off", async () => {
    io.loadPayerPayCalendars.mockResolvedValue([payerRow(), payerRow({ jobId: 'job-1', calendar: { ...PAY_CALENDAR_DEFAULT, cutoffDay: 25, payDay: 30 } }), payerRow({ jobId: 'job-2', off: true, calendar: null })])
    const { unmount } = renderWithProviders(<BillCustomerPayCutoffLine payerCustomerId="payer-1" jobId="job-1" />)
    await waitFor(() => expect(screen.getByTestId('bill-customer-pay-cutoff').textContent).toContain('this bill is due Dec 30.'))
    unmount()
    renderWithProviders(<BillCustomerPayCutoffLine payerCustomerId="payer-1" jobId="job-2" />)
    await waitFor(() => expect(io.loadPayerPayCalendars).toHaveBeenCalledTimes(2))
    expect(screen.queryByTestId('bill-customer-pay-cutoff')).toBeNull()
  })

  it('draws nothing for a payer with no calendar, with no payer, and on a read that fails', async () => {
    io.loadPayerPayCalendars.mockResolvedValue([])
    const first = renderWithProviders(<BillCustomerPayCutoffLine payerCustomerId="payer-1" jobId="job-1" />)
    await waitFor(() => expect(io.loadPayerPayCalendars).toHaveBeenCalledTimes(1))
    expect(screen.queryByTestId('bill-customer-pay-cutoff')).toBeNull()
    first.unmount()
    const second = renderWithProviders(<BillCustomerPayCutoffLine payerCustomerId={null} jobId="job-1" />)
    expect(screen.queryByTestId('bill-customer-pay-cutoff')).toBeNull()
    second.unmount()
    io.loadPayerPayCalendars.mockRejectedValue(new Error('offline'))
    renderWithProviders(<BillCustomerPayCutoffLine payerCustomerId="payer-1" jobId="job-1" />)
    await waitFor(() => expect(io.loadPayerPayCalendars).toHaveBeenCalledTimes(2))
    expect(screen.queryByTestId('bill-customer-pay-cutoff')).toBeNull()
  })
})
