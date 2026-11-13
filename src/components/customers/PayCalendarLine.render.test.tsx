// @vitest-environment jsdom
/**
 * Render-smoke tests for the Pay calendar line (punch list #323), and its job form (punch list
 * #341, PR 1): with a job the line says whose calendar the job reads and opens the window on
 * that job; without one it is the payer's line, as before. A save through any door is read
 * again. Every name is made up.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, screen, waitFor } from '@testing-library/react'
import type { PayCalendarRow } from '../../lib/jobs/payCalendar'

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
import { dispatchPayCalendarChanged } from '../../lib/jobs/payCalendarIo'
import PayCalendarLine from './PayCalendarLine'

installDomShims()

const PAYER = { id: 'payer-1', name: 'Larkfield Construction' }
const JOB = { id: 'job-2', label: '1431 · Larkfield medical office', developmentId: null, developmentName: null }
const row = (over: Partial<PayCalendarRow>): PayCalendarRow => ({ payerCustomerId: 'payer-1', jobId: null, off: false, calendar: { cutoffDay: null, payDay: 10, monthsAfter: 1, payWhenPaid: false, clause: '', words: '' }, setByName: null, setAt: null, ...over })
const PAYER_ROW = row({})
const JOB_OWN = row({ jobId: 'job-2', calendar: { cutoffDay: 25, payDay: 30, monthsAfter: 1, payWhenPaid: false, clause: '', words: '' } })
const JOB_OFF = row({ jobId: 'job-2', off: true, calendar: null })

const line = () => screen.getByTestId('pay-calendar-line')
const press = () => screen.getByTestId('pay-calendar-line-press')

beforeEach(() => {
  auth.role = 'assistant'
  io.loadPayerPayCalendars.mockReset().mockResolvedValue([])
  opener.openPayCalendar.mockReset()
})

describe('PayCalendarLine on a job (punch list #341)', () => {
  it('says the job follows its payer, and opens the window on the job', async () => {
    io.loadPayerPayCalendars.mockResolvedValue([PAYER_ROW])
    renderWithProviders(<PayCalendarLine payerId={PAYER.id} payerName={PAYER.name} job={JOB} variant="row" />)
    await waitFor(() => expect(line().textContent).toBe('Follows Larkfield Construction · In by month end, paid the 10th'))
    fireEvent.click(press())
    expect(opener.openPayCalendar).toHaveBeenCalledWith(PAYER, { onSaved: expect.any(Function), job: JOB })
  })

  it('says the job is on its own calendar', async () => {
    io.loadPayerPayCalendars.mockResolvedValue([PAYER_ROW, JOB_OWN])
    renderWithProviders(<PayCalendarLine payerId={PAYER.id} payerName={PAYER.name} job={JOB} />)
    await waitFor(() => expect(line().textContent).toBe('This job’s own · In by the 25th, paid the 30th'))
  })

  it('says a job switched off has none, names the payer’s, and is still a press', async () => {
    io.loadPayerPayCalendars.mockResolvedValue([PAYER_ROW, JOB_OFF])
    renderWithProviders(<PayCalendarLine payerId={PAYER.id} payerName={PAYER.name} job={JOB} />)
    await waitFor(() => expect(line().textContent).toBe('No pay calendar on this job · Larkfield Construction has one'))
    fireEvent.click(press())
    expect(opener.openPayCalendar).toHaveBeenCalledWith(PAYER, expect.objectContaining({ job: JOB }))
  })

  it('offers the office the press that sets one when nothing is set', async () => {
    renderWithProviders(<PayCalendarLine payerId={PAYER.id} payerName={PAYER.name} job={JOB} />)
    await waitFor(() => expect(line().textContent).toBe('Set a pay calendar…'))
    fireEvent.click(press())
    expect(opener.openPayCalendar).toHaveBeenCalledWith(PAYER, expect.objectContaining({ job: JOB }))
  })

  it('draws nothing for a reader who may not set one when nothing is set', async () => {
    auth.role = 'subcontractor'
    renderWithProviders(<PayCalendarLine payerId={PAYER.id} payerName={PAYER.name} job={JOB} />)
    await waitFor(() => expect(io.loadPayerPayCalendars).toHaveBeenCalled())
    expect(screen.queryByTestId('pay-calendar-line')).toBeNull()
  })

  it('reads again when a calendar is saved through another door', async () => {
    io.loadPayerPayCalendars.mockResolvedValue([PAYER_ROW])
    renderWithProviders(<PayCalendarLine payerId={PAYER.id} payerName={PAYER.name} job={JOB} />)
    await waitFor(() => expect(line().textContent).toContain('Follows Larkfield Construction'))
    io.loadPayerPayCalendars.mockResolvedValue([PAYER_ROW, JOB_OWN])
    act(() => dispatchPayCalendarChanged())
    await waitFor(() => expect(line().textContent).toBe('This job’s own · In by the 25th, paid the 30th'))
  })
})

describe('PayCalendarLine on a payer', () => {
  it('names the payer’s calendar and opens the payer’s window, with no job', async () => {
    io.loadPayerPayCalendars.mockResolvedValue([PAYER_ROW, JOB_OWN])
    renderWithProviders(<PayCalendarLine payerId={PAYER.id} payerName={PAYER.name} />)
    await waitFor(() => expect(line().textContent).toBe('In by month end, paid the 10th'))
    fireEvent.click(line())
    expect(opener.openPayCalendar).toHaveBeenCalledWith(PAYER, { onSaved: expect.any(Function) })
  })

  it('offers the office Set a pay calendar… and shows a reader nothing', async () => {
    const { unmount } = renderWithProviders(<PayCalendarLine payerId={PAYER.id} payerName={PAYER.name} />)
    await waitFor(() => expect(line().textContent).toBe('Set a pay calendar…'))
    unmount()
    auth.role = 'subcontractor'
    io.loadPayerPayCalendars.mockClear()
    renderWithProviders(<PayCalendarLine payerId={PAYER.id} payerName={PAYER.name} />)
    await waitFor(() => expect(io.loadPayerPayCalendars).toHaveBeenCalled())
    expect(screen.queryByTestId('pay-calendar-line')).toBeNull()
  })
})
