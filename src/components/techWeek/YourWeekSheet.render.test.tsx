// @vitest-environment jsdom
/**
 * The sheet after the week's last clock-out (punch list #255, v2.6606): the week said once with the clock-out line,
 * the signal, the move and the customer's words; one press closes it; no signal closes it by itself; the week is
 * remembered on this device; and the week read on the company calendar at the Saturday-evening edge.
 */
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { YourWeekIo } from '../../lib/techWeek/yourWeekIo'
import { weekSheetSeenKey } from '../../lib/techWeek/weekSheet'
import { todayYmdInAppTz } from '../../utils/dateUtils'
import { YourWeekSheet, weekSheetAlreadyDealt } from './YourWeekSheet'

// The rows are dated in the app's timezone, as the sheet reads the week: a UTC date is a day ahead every evening, and on a
// Saturday evening that is the next pay week (it failed CI at 6:30 PM Central on 2026-11-07).
const io = (week: unknown, words: unknown = []): YourWeekIo => ({ myWeek: async () => week, myWords: async () => words })

const week = (signal: string | null) => ({
  signal,
  name: 'Marcus',
  role: 'primary',
  hours: [{ session_id: 's', work_date: todayYmdInAppTz(), clocked_in_at: '', clocked_out_at: '', hours: 8.5, approved: false, job_ledger_id: 'a', job_number: '1184', job_name: 'Water heater', job_address: '', service_type_name: 'Plumbing', bid_id: null }],
  licenses: [],
  jobs: [{ job_id: 'a', job_number: '1184', job_name: 'Water heater', finished_ymd: todayYmdInAppTz(), expected_hours: null, budget_hours: 40, crew_hours: 36, my_first_ymd: '2026-11-02' }],
  callbacks: [],
})

beforeEach(() => localStorage.clear())
afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

describe('YourWeekSheet', () => {
  it('says the week once, with the words, and the press closes it', async () => {
    const onClose = vi.fn()
    const words = [{ id: 'r', customer_name: 'Dana Whitfield', score: 5, words: 'Marcus explained everything.', answered_at: new Date().toISOString(), job_id: 'a', job_number: '1184', job_name: 'Water heater', job_address: '', seen_at: null }]
    render(<YourWeekSheet open userId="u-marcus" clockedOutIso="2026-11-06T23:31:00Z" onClose={onClose} io={io(week('jobs_without_callback'), words)} />)
    expect(await screen.findByRole('dialog', { name: 'Your week' })).toBeTruthy()
    expect(screen.getByText('Clocked out at 5:31 PM. 8.5 hours this week.')).toBeTruthy()
    expect(screen.getByText('Jobs without a callback')).toBeTruthy()
    expect(screen.getByText('“Marcus explained everything.”')).toBeTruthy()
    expect(screen.getByText(/Dana W\. · water heater · today/)).toBeTruthy()
    const press = screen.getByRole('button', { name: /Have a good/ })
    fireEvent.click(press)
    expect(onClose).toHaveBeenCalled()
    expect(weekSheetAlreadyDealt('u-marcus', Object.keys(localStorage).find((k) => k.startsWith('your_week_sheet_seen_u-marcus_'))!.replace('your_week_sheet_seen_u-marcus_', ''))).toBe(true)
  })

  it('reads the week on the company calendar on a Saturday evening, when the UTC day is already Sunday', async () => {
    // 6:30 PM Saturday Nov 7 in Chicago is 00:30 Sunday Nov 8 in UTC: the next pay week by the UTC day.
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-11-08T00:30:00Z'))
    expect(todayYmdInAppTz()).toBe('2026-11-07')
    render(<YourWeekSheet open userId="u-marcus" clockedOutIso="2026-11-07T23:31:00Z" onClose={vi.fn()} io={io(week('jobs_without_callback'))} />)
    expect(await screen.findByRole('dialog', { name: 'Your week' })).toBeTruthy()
    expect(screen.getByText('Clocked out at 5:31 PM. 8.5 hours this week.')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Have a good weekend' })).toBeTruthy()
  })

  it('closes itself when the office has picked no signal, and remembers nothing', async () => {
    const onClose = vi.fn()
    const { container } = render(<YourWeekSheet open userId="u-marcus" clockedOutIso="2026-11-06T23:31:00Z" onClose={onClose} io={io(week(null))} />)
    await waitFor(() => expect(onClose).toHaveBeenCalled())
    expect(container.querySelector('[data-testid="your-week-sheet"]')).toBeNull()
    expect(localStorage.getItem(weekSheetSeenKey('u-marcus', '2026-11-01'))).toBeNull()
  })

  it('draws nothing while closed', () => {
    const { container } = render(<YourWeekSheet open={false} userId="u" clockedOutIso="" onClose={() => undefined} io={io(week('jobs_without_callback'))} />)
    expect(container.innerHTML).toBe('')
  })
})
