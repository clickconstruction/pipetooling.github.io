// @vitest-environment jsdom
/**
 * Render smoke for People → Who's where (to-dos/whos-where, PR 1): the tab mounts,
 * loads a week through the stub, draws the day controls and the scrubber, and
 * reads "nobody on a job" when the week is empty; with rows it draws an island
 * with a solid head and a hollow head and the lanes underneath.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, screen, waitFor } from '@testing-library/react'
import { renderWithProviders, settle } from '../../test/renderSmokeMocks'

type Row = Record<string, unknown>
const H = vi.hoisted(() => ({ sessions: [] as Row[], blocks: [] as Row[], users: [] as Row[] }))

vi.mock('../../lib/supabase', () => {
  function builder(table: string) {
    const rows = () => (table === 'clock_sessions' ? H.sessions : table === 'job_schedule_blocks' ? H.blocks : table === 'users' ? H.users : [])
    const b: Record<string, unknown> = {}
    for (const m of ['select', 'eq', 'neq', 'gte', 'lte', 'is', 'in', 'not', 'order', 'range', 'limit']) b[m] = () => b
    b.maybeSingle = () => Promise.resolve({ data: null, error: null })
    b.single = () => Promise.resolve({ data: null, error: null })
    b.then = (onFulfilled?: (v: unknown) => unknown, onRejected?: (e: unknown) => unknown) => Promise.resolve({ data: rows(), error: null, count: rows().length }).then(onFulfilled, onRejected)
    return b
  }
  return { supabase: { from: (table: string) => builder(table) } }
})

import PeopleWhosWhereTab from './PeopleWhosWhereTab'
import { startOfYmdInAppTzMs, todayYmdInAppTz } from '../../utils/dateUtils'

const TODAY = todayYmdInAppTz()
/** Midnight at the start of today on the company clock — a session from here spans any "now". */
const TODAY_START_ISO = new Date(startOfYmdInAppTzMs(TODAY)).toISOString()

describe('PeopleWhosWhereTab', () => {
  beforeEach(() => {
    H.sessions = []
    H.blocks = []
    H.users = []
  })
  afterEach(() => cleanup())

  it('mounts on this week with the week controls and an empty week', async () => {
    renderWithProviders(<PeopleWhosWhereTab authRole="dev" />)
    await settle()
    expect(screen.getByRole('group', { name: 'Week' })).toBeTruthy()
    expect(screen.queryByRole('slider', { name: 'Time of day' })).toBeNull()
    await waitFor(() => expect(screen.getByText(/No sessions or schedule blocks this week/)).toBeTruthy())
  })

  it('draws a crew card around the listed master with the clocked helper, then opens the day from the strip', async () => {
    H.users = [
      { id: 'u-mike', name: 'Mike Ramos', role: 'master_technician' },
      { id: 'u-bryan', name: 'Bryan Ortiz', role: 'helpers' },
    ]
    const job = { hcp_number: '258', click_number: null, job_name: 'Oak St', job_address: '1408 Oak St', customer_name: 'Ramirez', service_type_id: null }
    H.sessions = [{ id: 's1', user_id: 'u-bryan', work_date: TODAY, clocked_in_at: TODAY_START_ISO, clocked_out_at: null, job_ledger_id: 'job-oak', bid_id: null, jobs_ledger: job, bids: null }]
    H.blocks = [{ id: 'b1', assignee_user_id: 'u-mike', work_date: TODAY, time_start: '00:00:00', time_end: '24:00:00', job_id: 'job-oak', bid_id: null, shared_block_group_id: 'g1', jobs_ledger: job, bids: null }]
    renderWithProviders(<PeopleWhosWhereTab authRole="dev" />)
    const card = await screen.findByRole('region', { name: "Mike's crew" })
    expect(card.textContent).toContain('listed 1')
    expect(card.textContent).toContain('1 day')
    expect(card.textContent).toContain('258 · Oak St ×1')
    expect(screen.getByText(/1 crew · 0 alone · 0 office · 0 not in/)).toBeTruthy()
    // The strip opens the day.
    const today = new Date(TODAY + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short' })
    const dayButtons = screen.getAllByTitle(/open the day/)
    const todayButton = dayButtons.find((b) => b.textContent?.startsWith(today))!
    todayButton.click()
    await waitFor(() => expect(screen.getByRole('slider', { name: 'Time of day' })).toBeTruthy())
    expect(screen.getByRole('region', { name: /258 · Oak St/ })).toBeTruthy()
  })

  it('draws an island with a solid head for a session and a hollow head for an unclocked block, and the lanes', async () => {
    H.users = [
      { id: 'u-mike', name: 'Mike Ramos', role: 'master_technician' },
      { id: 'u-bryan', name: 'Bryan Ortiz', role: 'helpers' },
    ]
    const job = { hcp_number: '258', click_number: null, job_name: 'Oak St', job_address: '1408 Oak St', customer_name: 'Ramirez', service_type_id: null }
    // Bryan's open session starts at midnight and Mike's block runs the whole day, so the
    // moment the tab lands on ("now") always falls inside both, whatever the clock says.
    H.sessions = [{ id: 's1', user_id: 'u-bryan', work_date: TODAY, clocked_in_at: TODAY_START_ISO, clocked_out_at: null, job_ledger_id: 'job-oak', bid_id: null, jobs_ledger: job, bids: null }]
    H.blocks = [{ id: 'b1', assignee_user_id: 'u-mike', work_date: TODAY, time_start: '00:00:00', time_end: '24:00:00', job_id: 'job-oak', bid_id: null, shared_block_group_id: 'g1', jobs_ledger: job, bids: null }]
    renderWithProviders(<PeopleWhosWhereTab authRole="master_technician" />)
    await screen.findByRole('region', { name: "Mike's crew" })
    const today = new Date(TODAY + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short' })
    screen.getAllByTitle(/open the day/).find((b) => b.textContent?.startsWith(today))!.click()
    await waitFor(() => expect(screen.getByRole('region', { name: /258 · Oak St/ })).toBeTruthy())
    // The island has both first names; the lanes repeat them with the notes.
    expect(screen.getAllByText('Bryan').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Mike').length).toBeGreaterThan(0)
    expect(screen.getByText(/never clocked/)).toBeTruthy()
    expect(screen.getByText(/2 on the clock or listed at/)).toBeTruthy()
  })

  it('an assistant gets the week controls with the earlier arrow live inside the window', async () => {
    renderWithProviders(<PeopleWhosWhereTab authRole="assistant" />)
    await waitFor(() => expect(screen.getByText(/No sessions or schedule blocks this week/)).toBeTruthy())
    const earlier = screen.getByRole('button', { name: 'Earlier week' })
    expect(earlier.getAttribute('disabled')).toBeNull()
  })
})
