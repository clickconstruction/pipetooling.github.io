// @vitest-environment jsdom
/**
 * Render-smoke tests for the job window's Pay calendar row (punch list #341, PR 1): the office
 * sees whose calendar the job reads and the press that opens the window on the job, under the
 * party the job's bills go to; nobody else sees a row, and a job that names nobody to bill has
 * none. Every name is made up.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, waitFor } from '@testing-library/react'
import type { JobWithDetails } from '../../types/jobWithDetails'

const { io, auth, opener } = vi.hoisted(() => ({
  io: { loadPayerPayCalendars: vi.fn() },
  auth: { role: 'assistant' as string },
  opener: { openPayCalendar: vi.fn(), closePayCalendar: vi.fn() },
}))

vi.mock('../../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../../test/renderSmokeMocks')
  return { supabase: makeSupabaseStub() }
})
vi.mock('../../hooks/useAuth', async () => {
  const { makeUseAuthValue } = await import('../../test/renderSmokeMocks')
  const value = () => makeUseAuthValue({ role: auth.role })
  return { useAuth: value, useOptionalAuth: value }
})
vi.mock('../../lib/jobs/payCalendarIo', async (importOriginal) => ({ ...(await importOriginal<typeof import('../../lib/jobs/payCalendarIo')>()), loadPayerPayCalendars: io.loadPayerPayCalendars }))
vi.mock('../../contexts/PayCalendarModalContext', () => ({ usePayCalendarModal: () => opener }))

import { installDomShims, renderWithProviders } from '../../test/renderSmokeMocks'
import JobPayCalendarRow from './JobPayCalendarRow'

installDomShims()

const job = (over: Partial<JobWithDetails> = {}): JobWithDetails =>
  ({
    id: 'job-2',
    hcp_number: '1431',
    click_number: null,
    job_name: 'Larkfield medical office',
    customer_id: 'cust-1',
    customer_name: 'Dana Whitfield',
    gc_customer_id: 'gc-1',
    gcCustomer: { id: 'gc-1', name: 'Larkfield Construction' },
    bill_to_party: 'gc',
    development_id: 'dev-1',
    development: { id: 'dev-1', name: 'Larkfield Commons' },
    ...over,
  }) as unknown as JobWithDetails

beforeEach(() => {
  auth.role = 'assistant'
  io.loadPayerPayCalendars.mockReset().mockResolvedValue([])
  opener.openPayCalendar.mockReset()
})

describe('JobPayCalendarRow', () => {
  it('reads the calendar of whoever the bills go to, and opens the window on this job with its development', async () => {
    renderWithProviders(<JobPayCalendarRow job={job()} />)
    await waitFor(() => expect(screen.getByTestId('pay-calendar-line').textContent).toBe('Set a pay calendar…'))
    expect(screen.getByText('Pay calendar')).toBeTruthy()
    expect(io.loadPayerPayCalendars).toHaveBeenCalledWith(expect.anything(), 'gc-1')
    fireEvent.click(screen.getByTestId('pay-calendar-line-press'))
    expect(opener.openPayCalendar).toHaveBeenCalledWith(
      { id: 'gc-1', name: 'Larkfield Construction' },
      { onSaved: expect.any(Function), job: { id: 'job-2', label: '1431 · Larkfield medical office', developmentId: 'dev-1', developmentName: 'Larkfield Commons' } },
    )
  })

  it('reads the customer’s when the customer pays', async () => {
    renderWithProviders(<JobPayCalendarRow job={job({ bill_to_party: 'customer' })} />)
    await waitFor(() => expect(io.loadPayerPayCalendars).toHaveBeenCalledWith(expect.anything(), 'cust-1'))
  })

  it('draws no row for a reader who may not set a calendar, or on a job that names nobody to bill', () => {
    auth.role = 'subcontractor'
    const { unmount } = renderWithProviders(<JobPayCalendarRow job={job()} />)
    expect(screen.queryByText('Pay calendar')).toBeNull()
    unmount()
    auth.role = 'assistant'
    renderWithProviders(<JobPayCalendarRow job={job({ customer_id: null, gc_customer_id: null, gcCustomer: null })} />)
    expect(screen.queryByText('Pay calendar')).toBeNull()
    expect(io.loadPayerPayCalendars).not.toHaveBeenCalled()
  })
})
