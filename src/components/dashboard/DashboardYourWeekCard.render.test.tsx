// @vitest-environment jsdom
/**
 * Your week (punch list #255, v2.6589): nothing without a signal; a tech's rolling count with the week's pill and the
 * customer's words; an apprentice's hours with the bar; a lead's crew against the target with the dashed line's words.
 */
import { cleanup, render, screen } from '@testing-library/react'
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import type { YourWeekIo } from '../../lib/techWeek/yourWeekIo'
import { DashboardYourWeekCard } from './DashboardYourWeekCard'

// The card reads the Sun–Sat pay week containing today (v2.6684): the fixtures below finished 2026-11-02 to 11-04, so
// the clock is pinned inside that week (Date only; no fake timers, so findByText still waits). Unpinned, the lead's
// no-target job left the week on Sunday 2026-11-08 and the smoke failed on every PR in the queue.
beforeAll(() => vi.setSystemTime(new Date('2026-11-05T15:00:00.000Z')))
afterAll(() => vi.useRealTimers())

const io = (week: unknown, words: unknown = []): YourWeekIo => ({ myWeek: async () => week, myWords: async () => words })

const jobs = [
  { job_id: 'a', job_number: '1184', job_name: 'Water heater', finished_ymd: '2026-11-03', expected_hours: null, budget_hours: 40, crew_hours: 36, my_first_ymd: '2026-11-02' },
  { job_id: 'b', job_number: '1185', job_name: 'Repipe', finished_ymd: '2026-10-28', expected_hours: 84, budget_hours: 90, crew_hours: 76, my_first_ymd: '2026-10-20' },
]

afterEach(cleanup)

describe('DashboardYourWeekCard', () => {
  it('renders nothing until the office picks a signal, and nothing on a failed read', async () => {
    const { container } = render(<DashboardYourWeekCard userId="u" io={io({ signal: null, name: 'Marcus', role: 'primary', hours: [], licenses: [], jobs: [], callbacks: [] })} />)
    await new Promise((r) => setTimeout(r, 0))
    expect(container.querySelector('[data-testid="your-week-card"]')).toBeNull()
    cleanup()
    const failed = render(<DashboardYourWeekCard userId="u" io={{ myWeek: async () => { throw new Error('down') }, myWords: async () => [] }} />)
    await new Promise((r) => setTimeout(r, 0))
    expect(failed.container.querySelector('[data-testid="your-week-card"]')).toBeNull()
  })

  it('a tech reads the rolling count, the week’s pill and the customer’s words by first name', async () => {
    const words = [{ id: 'r', customer_name: 'Dana Whitfield', score: 5, words: 'Marcus explained everything.', answered_at: new Date().toISOString(), job_id: 'a', job_number: '1184', job_name: 'Water heater', job_address: '', seen_at: null }]
    render(<DashboardYourWeekCard userId="u" io={io({ signal: 'jobs_without_callback', name: 'Marcus', role: 'primary', hours: [], licenses: [], jobs, callbacks: [] }, words)} />)
    expect(await screen.findByText('Jobs without a callback')).toBeTruthy()
    expect(screen.getByText('2 of your last 2 jobs')).toBeTruthy()
    expect(screen.getByRole('img', { name: 'The last eight weeks' })).toBeTruthy()
    expect(await screen.findByText('“Marcus explained everything.”')).toBeTruthy()
    expect(screen.getByText(/Dana W\. · water heater · today/)).toBeTruthy()
    expect(screen.queryByText(/Whitfield/)).toBeNull()
  })

  it('an apprentice reads the hours with the bar and the next mark, and no dots', async () => {
    const week = { signal: 'license_hours', name: 'Jordan', role: 'helpers', hours: [{ session_id: 's', work_date: '2026-10-01', clocked_in_at: '', clocked_out_at: '', hours: 3412, approved: true, job_ledger_id: 'j', job_number: '1', job_name: 'x', job_address: '', service_type_name: 'Plumbing', bid_id: null }], licenses: [{ license_type: 'Plumber Apprentice #1', date_of_expiry: null }], jobs: [], callbacks: [] }
    render(<DashboardYourWeekCard userId="u" io={io(week)} />)
    expect(await screen.findByText('Hours toward journeyman plumber')).toBeTruthy()
    expect(screen.getByText('3,412 of 8,000')).toBeTruthy()
    expect(screen.getByText('Next mark 3,500 h. You are 88 hours away.')).toBeTruthy()
    expect(screen.queryByRole('img', { name: 'The last eight weeks' })).toBeNull()
  })

  it('a lead reads the crew against the target, the no-target note and the dashed line’s words', async () => {
    const withNone = [...jobs, { job_id: 'c', job_number: '1186', job_name: 'Drain', finished_ymd: '2026-11-04', expected_hours: null, budget_hours: null, crew_hours: 9, my_first_ymd: '2026-11-04' }]
    render(<DashboardYourWeekCard userId="u" io={io({ signal: 'crew_vs_target', name: 'Luis', role: 'superintendent', hours: [], licenses: [], jobs: withNone, callbacks: [] })} />)
    expect(await screen.findByText('Your crew against the target')).toBeTruthy()
    expect(screen.getByText('One more job finished with no target, so it is not counted.')).toBeTruthy()
    expect(screen.getByText('Dashed line is the target')).toBeTruthy()
  })
})
