// @vitest-environment jsdom
/**
 * Quickfill's Email station (punch list #159): the trend in its Mark history window over a fake io. Four weeks of bars
 * per counted label the viewer may see, red past the limit; two weeks day by day with the days nobody looked and what sat
 * past the limit by name; nothing at all while the station is by hand.
 */
import { cleanup, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { WatchView } from '../../lib/emailIn/countCard'
import type { StationThreadRow } from '../../lib/quickfill/emailStation'
import type { EmailTrendData, EmailTrendIo } from '../../lib/quickfill/emailTrendIo'
import { renderWithProviders, SMOKE_AUTH_USER_ID } from '../../test/renderSmokeMocks'
import { EmailStationTrend } from './EmailStationTrend'

vi.mock('../../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../../test/renderSmokeMocks')
  return { supabase: makeSupabaseStub() }
})
vi.mock('../../hooks/useAuth', async () => {
  const { useAuthModuleMock } = await import('../../test/renderSmokeMocks')
  return useAuthModuleMock()
})

// Fri Oct 23, 2026, 9:55 AM in Chicago. Made-up boxes, people and mail.
const NOW = '2026-10-23T14:55:00.000Z'
const watch = (over: Partial<WatchView> & { id: string; address: string }): WatchView => ({
  user_id: null,
  labels: ['Inbox'],
  is_on: true,
  labels_state: { Inbox: { at: NOW, total: 2 } },
  last_ok_at: '2026-10-23T14:51:00Z',
  last_error: null,
  created_at: '2026-10-20T13:00:00Z',
  added_by: null,
  ...over,
})
const thread = (over: Partial<StationThreadRow> & { gmail_thread_id: string }): StationThreadRow => ({
  watch_id: 'w-bids',
  label_name: 'Inbox',
  arrived_at: null,
  last_at: null,
  from_name: null,
  from_address: null,
  subject: '',
  first_seen_at: '2026-10-10T12:00:00Z',
  gone_at: null,
  ...over,
})
const BIDS = watch({ id: 'w-bids', address: 'bids@clickconstruction.example' })
const MINE = watch({ id: 'w-mine', user_id: SMOKE_AUTH_USER_ID, address: 'marisol@clickplumbing.example', labels: ['Follow Up', 'Waiting', 'Gone'], labels_state: { 'Follow Up': { at: NOW, total: 1 }, Waiting: { at: NOW, total: 0 }, Gone: { at: NOW, missing: true } } })
const DATA: EmailTrendData = {
  station: {
    on: true,
    limitDays: 3,
    leadId: null,
    rows: [BIDS, MINE],
    threads: [
      thread({ gmail_thread_id: 'ridgeway', arrived_at: '2026-10-17T15:10:00Z', from_name: 'Ridgeway Builders', subject: 'Lot 7 — final waivers', first_seen_at: '2026-10-17T15:15:00Z' }),
      thread({ watch_id: 'w-mine', label_name: 'Follow Up', gmail_thread_id: 'harlan', arrived_at: '2026-10-14T15:00:00Z', from_name: 'Harlan Freight', subject: 'W-9' }),
    ],
    names: { [SMOKE_AUTH_USER_ID]: 'Marisol' },
  },
  days: [
    { watch_id: 'w-bids', label_name: 'Inbox', day: '2026-10-22', count: 2, oldest_days: 5, new_count: 0, cleared_count: 1 },
    { watch_id: 'w-bids', label_name: 'Inbox', day: '2026-10-23', count: 2, oldest_days: 6, new_count: 1, cleared_count: 0 },
    { watch_id: 'w-mine', label_name: 'Follow Up', day: '2026-10-23', count: 1, oldest_days: 9, new_count: 0, cleared_count: 0 },
    { watch_id: 'w-mine', label_name: 'Waiting', day: '2026-10-23', count: 0, oldest_days: null, new_count: 0, cleared_count: 0 },
  ],
  marks: [{ marked_at: '2026-10-23T14:55:00Z', name: 'Marisol' }],
}
const fakeIo = (data: EmailTrendData): EmailTrendIo => ({ load: vi.fn(async () => data) })

afterEach(cleanup)

describe('EmailStationTrend', () => {
  it('draws four weeks of bars per counted label, leaving out a label the box does not have', async () => {
    renderWithProviders(<EmailStationTrend io={fakeIo(DATA)} nowIso={NOW} />)
    await screen.findByText('Last 4 weeks')
    const series = Array.from(document.querySelectorAll('[data-email-trend-series]')).map((el) => el.getAttribute('data-email-trend-series'))
    expect(series).toEqual(['bids@ · Inbox', 'You · Follow Up', 'You · Waiting'])
    expect(within(document.querySelector<HTMLElement>('[data-email-trend-series="You · Waiting"]')!).getByText('clean today')).toBeTruthy()
    const bids = within(document.querySelector<HTMLElement>('[data-email-trend-series="bids@ · Inbox"]')!)
    expect(bids.getByText('oldest today 6d')).toBeTruthy()
    expect(document.querySelectorAll('[data-email-trend-series="bids@ · Inbox"] i').length).toBe(28)
  })

  it('lists two weeks day by day, the days nobody looked included, and names what sat past the limit', async () => {
    renderWithProviders(<EmailStationTrend io={fakeIo(DATA)} nowIso={NOW} />)
    await screen.findByText('Day by day')
    expect(screen.getByText('Nobody looked on 13 of the last 14 days.')).toBeTruthy()
    const friday = document.querySelector<HTMLElement>('[data-email-trend-day="2026-10-23"]')!
    expect(friday.textContent).toContain('Fri Oct 23')
    expect(friday.textContent).toContain('Marisol · 9:55 AM')
    expect(friday.textContent).toContain('9d Harlan Freight, W-9')
    expect(friday.textContent).toContain('6d Ridgeway Builders, Lot 7 — final waivers')
    const thursday = document.querySelector<HTMLElement>('[data-email-trend-day="2026-10-22"]')!
    expect(thursday.textContent).toContain('nobody looked')
    expect(thursday.textContent).toContain('+0 · −1')
  })

  it('draws nothing while the station is by hand', async () => {
    const io = fakeIo({ ...DATA, station: { ...DATA.station, on: false } })
    renderWithProviders(<EmailStationTrend io={io} nowIso={NOW} />)
    await vi.waitFor(() => expect(io.load).toHaveBeenCalled())
    await new Promise((r) => setTimeout(r, 0))
    expect(document.querySelector('[data-email-trend]')).toBeNull()
  })
})
