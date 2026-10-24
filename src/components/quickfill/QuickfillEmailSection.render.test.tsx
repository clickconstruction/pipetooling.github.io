// @vitest-environment jsdom
/**
 * Quickfill's Email station (punch list #159) over a fake io, one smoke per state: a person with labels (the live
 * counts, the threads past the limit with their doors, what moved, the stance, the mark with the composed note and the
 * person's word, Read again); one with none (a viewer with no box of their own sees the shared boxes alone); a label
 * that does not exist (said in words, the others still counted); and by hand until the app counts (today's rows, the
 * reason, the refusal of an empty mark). The trend is the history window's (PR 5).
 */
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { WatchView } from '../../lib/emailIn/countCard'
import { BY_HAND_OFF, type StationThreadRow } from '../../lib/quickfill/emailStation'
import type { EmailStationData, EmailStationIo } from '../../lib/quickfill/emailStationIo'
import { renderWithProviders, SMOKE_AUTH_USER_ID } from '../../test/renderSmokeMocks'
import { QuickfillEmailSection } from './QuickfillEmailSection'

vi.mock('../../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../../test/renderSmokeMocks')
  return { supabase: makeSupabaseStub() }
})
const auth = vi.hoisted(() => ({ role: 'assistant' }))
vi.mock('../../hooks/useAuth', async () => {
  const { makeUseAuthValue, useAuthModuleMock } = await import('../../test/renderSmokeMocks')
  const value = () => makeUseAuthValue({ role: auth.role })
  return { ...useAuthModuleMock(), useAuth: value, useOptionalAuth: value }
})
vi.mock('../../hooks/useGcFollowUpNeeds', () => ({ useGcFollowUpNeeds: () => ({ count: 5, late: false, title: '5 people are waiting on us', detail: '' }) }))

// Fri Oct 23, 2026, 9:55 AM in Chicago; the last look was Thursday at 12:01 PM. Made-up boxes, people and mail.
const NOW = '2026-10-23T14:55:00.000Z'
const SINCE = '2026-10-22T17:01:00.000Z'
const ME = SMOKE_AUTH_USER_ID
const watch = (over: Partial<WatchView> & { id: string; address: string }): WatchView => ({
  user_id: null,
  labels: ['Inbox', 'Follow Up', 'Next Actions'],
  is_on: true,
  labels_state: null,
  last_ok_at: '2026-10-23T14:51:00Z',
  last_error: null,
  created_at: '2026-10-20T13:00:00Z',
  added_by: null,
  ...over,
})
const thread = (over: Partial<StationThreadRow> & { watch_id: string; gmail_thread_id: string; label_name: string }): StationThreadRow => ({
  arrived_at: null,
  last_at: null,
  from_name: null,
  from_address: null,
  subject: '',
  first_seen_at: '2026-10-20T12:00:00Z',
  gone_at: null,
  ...over,
})
const BIDS = watch({ id: 'w-bids', address: 'bids@clickconstruction.example', labels: ['Inbox', 'Follow Up'], labels_state: { Inbox: { at: NOW, total: 2 }, 'Follow Up': { at: NOW, total: 0 } } })
const WORK = watch({ id: 'w-work', address: 'work@clickplumbing.example', created_at: '2026-10-20T14:00:00Z', labels_state: { Inbox: { at: NOW, total: 1 }, 'Follow Up': { at: NOW, missing: true }, 'Next Actions': { at: NOW, total: 0 } } })
const MINE = watch({ id: 'w-mine', user_id: ME, address: 'marisol@clickplumbing.example', labels_state: { Inbox: { at: NOW, total: 0 }, 'Follow Up': { at: NOW, total: 1 }, 'Next Actions': { at: NOW, total: 0 } } })
const THREADS: StationThreadRow[] = [
  thread({ watch_id: 'w-bids', label_name: 'Inbox', gmail_thread_id: 'ridgeway', arrived_at: '2026-10-17T15:10:00Z', from_name: 'Ridgeway Builders', subject: 'Lot 7 — final waivers' }),
  thread({ watch_id: 'w-bids', label_name: 'Inbox', gmail_thread_id: 'newer', arrived_at: '2026-10-22T20:00:00Z', from_name: 'Dana', subject: 'Question', first_seen_at: '2026-10-22T20:05:00Z' }),
  thread({ watch_id: 'w-work', label_name: 'Inbox', gmail_thread_id: 'cedar', arrived_at: '2026-10-19T15:00:00Z', from_name: 'Cedar Bend Partners', subject: 'Building C — plans to bid' }),
  thread({ watch_id: 'w-mine', label_name: 'Follow Up', gmail_thread_id: 'harlan', arrived_at: '2026-10-14T15:00:00Z', from_name: 'Harlan Freight', subject: 'W-9 for the new account' }),
]
const DATA: EmailStationData = { on: true, limitDays: 3, leadId: 'u-dale', rows: [BIDS, WORK, MINE], threads: THREADS, names: { [ME]: 'Marisol', 'u-dale': 'Dale' } }

function fakeIo(data: EmailStationData): EmailStationIo {
  return { load: vi.fn(async () => data), readAgain: vi.fn(async () => undefined) }
}
const palette = { bg: '#fef3c7', border: '#f59e0b' }
const box = (title: string) => within(document.querySelector<HTMLElement>(`[data-email-box="${title}"]`)!)

afterEach(() => {
  cleanup()
  auth.role = 'assistant'
})

describe('QuickfillEmailSection: a person with labels', () => {
  it('draws each box’s labels with the live count, the oldest, the stuck threads and their doors', async () => {
    renderWithProviders(<QuickfillEmailSection metricSectionId="email-inbox" markButtonPalette={palette} onConfirmMark={vi.fn()} lastMarkedAt={SINCE} io={fakeIo(DATA)} nowIso={NOW} />)
    await screen.findByText('Your mail')
    expect(document.querySelector('[data-email-count-line]')!.textContent).toContain('4 open · 3 past 3 days · read 4 min ago')
    const bids = box('bids@')
    expect(bids.getByText('for the office')).toBeTruthy()
    const ridgeway = document.querySelector<HTMLElement>('[data-email-thread="ridgeway"]')!
    expect(ridgeway.textContent).toContain('6d')
    expect(ridgeway.textContent).toContain('Sat Oct 17')
    expect(ridgeway.textContent).toContain('Ridgeway Builders')
    expect(within(ridgeway).getByRole('link', { name: 'Open →' }).getAttribute('href')).toBe('https://mail.google.com/mail/?authuser=bids%40clickconstruction.example#all/ridgeway')
    expect(bids.getByText('+1 newer than 3 days')).toBeTruthy()
    expect(bids.getByText('clean')).toBeTruthy()
    const mine = box('Your mail')
    expect(mine.getByText('shows to you and Dale')).toBeTruthy()
    expect(mine.getByText('W-9 for the new account', { exact: false })).toBeTruthy()
    expect(document.querySelector('[data-email-since]')!.textContent).toBe('Since the last look, Thu, Oct 22 at 12:01 PM:+1 new0 cleared3 still here')
    expect(document.querySelector('[data-email-stance]')!.textContent).toContain('Counts bids@, work@ and your mail. Senders, subjects and dates only, never the words. Your rows show to you and Dale. It changes nothing in Gmail.')
    expect(screen.getByRole('link', { name: 'In Messages: 5 people are waiting on us →' }).getAttribute('href')).toBe('/messages')
  })

  it('marks with the composed note and the person’s own word, and reads every box again on a press', async () => {
    const onConfirmMark = vi.fn()
    const io = fakeIo(DATA)
    renderWithProviders(<QuickfillEmailSection metricSectionId="email-inbox" markButtonPalette={palette} onConfirmMark={onConfirmMark} lastMarkedAt={SINCE} io={io} nowIso={NOW} />)
    fireEvent.change(await screen.findByLabelText('A word about these (optional)'), { target: { value: 'Harlan W-9 asked twice.' } })
    fireEvent.click(screen.getByRole('button', { name: 'Looked · 4 open' }))
    const note = onConfirmMark.mock.calls[0]![0] as string
    expect(note.split('\n')[0]).toBe('bids@ · Inbox 2, oldest 6d (Ridgeway Builders, Lot 7 — final waivers) · Follow Up clean')
    expect(note.split('\n').slice(-2)).toEqual(['+1 new, 0 cleared, 3 still here since Oct 22', 'Harlan W-9 asked twice.'])
    fireEvent.click(screen.getByRole('button', { name: 'Read again' }))
    await waitFor(() => expect(io.readAgain).toHaveBeenCalledWith(['w-bids', 'w-work', 'w-mine']))
  })
})

describe('QuickfillEmailSection: a label that does not exist', () => {
  it('says so in words with a door to Gmail’s labels, and counts the box’s other labels', async () => {
    renderWithProviders(<QuickfillEmailSection metricSectionId="email-inbox" markButtonPalette={palette} onConfirmMark={vi.fn()} io={fakeIo(DATA)} nowIso={NOW} />)
    await screen.findByText('work@')
    const work = box('work@')
    const missing = document.querySelector<HTMLElement>('[data-email-box="work@"] [data-email-label-missing]')!
    expect(missing.textContent).toContain('No label named Follow Up in work@ yet. Make it in Gmail, or pick another label.')
    expect(within(missing).getByRole('link', { name: 'Gmail labels →' })).toBeTruthy()
    expect(work.getByText('Cedar Bend Partners')).toBeTruthy()
  })
})

describe('QuickfillEmailSection: one with none', () => {
  it('a viewer with no box of their own sees the shared boxes alone', async () => {
    const data = { ...DATA, rows: [BIDS, WORK, { ...MINE, user_id: 'u-marisol' }] }
    renderWithProviders(<QuickfillEmailSection metricSectionId="email-inbox" markButtonPalette={palette} onConfirmMark={vi.fn()} io={fakeIo(data)} nowIso={NOW} />)
    await screen.findByText('bids@')
    expect(document.querySelector('[data-email-box="Your mail"]')).toBeNull()
    expect(document.querySelectorAll('[data-email-box]').length).toBe(2)
    expect(screen.queryByText('W-9 for the new account', { exact: false })).toBeNull()
  })

  it('the owner gets the door to Settings', async () => {
    auth.role = 'master_technician'
    renderWithProviders(<QuickfillEmailSection metricSectionId="email-inbox" markButtonPalette={palette} onConfirmMark={vi.fn()} io={fakeIo(DATA)} nowIso={NOW} />)
    expect((await screen.findByRole('link', { name: 'Change in Settings' })).getAttribute('href')).toBe('/settings?tab=settings-phone-texts')
  })
})

describe('QuickfillEmailSection: by hand until the app counts', () => {
  it('keeps today’s rows with the reason, refuses an empty mark, and marks the typed rows', async () => {
    const onConfirmMark = vi.fn()
    renderWithProviders(<QuickfillEmailSection metricSectionId="email-inbox" markButtonPalette={palette} onConfirmMark={onConfirmMark} io={fakeIo({ ...DATA, on: false })} nowIso={NOW} />)
    expect(await screen.findByText(BY_HAND_OFF)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Mark Email up to date!' }))
    expect(onConfirmMark).not.toHaveBeenCalled()
    fireEvent.change(screen.getByLabelText('Inbox'), { target: { value: 'clear' } })
    fireEvent.click(screen.getByRole('button', { name: 'Mark Email up to date!' }))
    expect(onConfirmMark).toHaveBeenCalledWith('Inbox: clear')
  })
})
