// @vitest-environment jsdom
/**
 * `/messages` with the My email tab (punch list #230 PR 3) over fake reads, never the network: Follow up · My email
 * after the title while the person's switch is on, the tab in the URL, the mail drawn in place of every Follow up
 * section with Follow up's controls out of the bar, the thread window opening over the tab at a tagged line, Follow up
 * coming back as it was, the tab's own reading of ?q=, and no tabs while the switch is off. The people are the spine's
 * demo rows and the mail is made up.
 */
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ConfirmDialogProvider } from '../contexts/ConfirmDialogContext'
import { ToastProvider } from '../contexts/ToastContext'
import { installDomShims } from '../test/renderSmokeMocks'
import type { FakeMyMailIo } from '../test/myMailRows'
import Messages from './Messages'

vi.mock('../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../test/renderSmokeMocks')
  return { supabase: makeSupabaseStub() }
})
vi.mock('../hooks/useAuth', async () => {
  const { useAuthModuleMock } = await import('../test/renderSmokeMocks')
  return useAuthModuleMock({ role: 'estimator' })
})
vi.mock('../components/gc/messages/threadSlots', () => ({ useThreadSlots: () => ({}) }))
vi.mock('../lib/messages/weekStripIo', () => ({ loadWeekStrip: vi.fn(() => Promise.resolve({ lines: [], estimates: [] })) }))
vi.mock('../lib/gc/gcIo', () => ({ loadGcTeam: () => Promise.resolve([{ id: 'u-rosa', name: 'Rosa', role: 'assistant' }]) }))
vi.mock('../lib/messages/messagesIo', async () => {
  const { spineMessagesView } = await import('../lib/messages/spineRows')
  return {
    loadMessagesView: vi.fn(() => Promise.resolve(spineMessagesView())),
    loadContact: vi.fn(() => Promise.resolve(null)),
    nameContact: vi.fn(),
    tieMessage: vi.fn(() => Promise.resolve()),
    setDefaultJob: vi.fn(() => Promise.resolve()),
    addContactJob: vi.fn(() => Promise.resolve()),
    removeContactJob: vi.fn(() => Promise.resolve()),
    searchContactRecords: vi.fn(() => Promise.resolve([])),
    searchJobs: vi.fn(() => Promise.resolve([])),
  }
})

// Follow up's one row: Greg waits on a reply, so the lanes have something to draw.
vi.mock('../lib/followUp/followUpIo', async (orig) => {
  const actual = await orig<typeof import('../lib/followUp/followUpIo')>()
  const rows = {
    contacts: [
      {
        ...{ id: 'c-greg', kind: 'trade', customer_id: null, customer_contact_person_id: null, gc_company_id: 'gc-hillside', gc_company_person_id: null, person_id: null },
        ...{ name: null, goes_by: null, off_since: null, off_why: null, off_by: null, state: 'waiting', snoozed_until: null, has_user_id: null, has_since: null, has_how: null },
      },
    ],
    channels: [],
    records: { gcCompanies: [{ id: 'gc-hillside', name: 'Hillside Excavation', contact_name: 'Greg Paulk', trades: ['Sitework'] }] },
    messages: [
      {
        ...{ id: 'm1', contact_id: 'c-greg', channel_id: null, bid_id: null, project_id: null, jobs_ledger_id: null, channel: 'text', direction: 'in', who_user_id: null, who_text: '' },
        ...{ at: '2026-10-01T14:00:00.000Z', subject: null, body: 'Is the detention pond in sitework?', optout_line: null, back_on: null, back_by: null, back_words: null, back_done_at: null },
      },
    ],
    heard: [],
    owed: [],
  }
  const io = { loadQueue: vi.fn(() => Promise.resolve(rows)), loadHighlights: vi.fn(() => Promise.resolve([])), count: vi.fn(() => Promise.resolve(1)) }
  return { ...actual, supabaseFollowUpIo: () => io }
})

// The person's switch, and gmail-mine over Greg's mail: a guess, and a conversation tagged onto the Boerne bid whose
// line is one of the spine's, so the thread opens at it.
const mail = vi.hoisted(() => ({ on: true, io: null as FakeMyMailIo | null }))
vi.mock('../lib/myMail/myMailIo', async (orig) => {
  const actual = await orig<typeof import('../lib/myMail/myMailIo')>()
  const { fakeMyMailIo, mailRow, MY_MAIL_PAGE, openedMail } = await import('../test/myMailRows')
  const greg = { name: 'Greg Paulk', address: 'greg@hillside.example' }
  const boerne = { kind: 'bid' as const, id: 'bid-boerne', key: 'bid:bid-boerne', num: 'B482', name: 'Boerne Retail Shell' }
  const rows = [
    mailRow('greg-new', { who: greg, subject: 'Boerne sitework number', snippet: 'Still good for today?', guess: { ...boerne, why: 'Greg Paulk is on this job' } }),
    mailRow('greg-old', { who: greg, subject: 'Re: Boerne', snippet: 'Got it.', at: '2026-10-24T19:03:00.000Z', tagged: { ...boerne, messageId: 'm-greg-text-out' } }),
  ]
  const io = fakeMyMailIo({ list: async () => ({ ...MY_MAIL_PAGE, rows, nextPageToken: null }), open: async ({ gmailId }) => openedMail(rows.find((r) => r.gmailId === gmailId) ?? rows[0]!) })
  mail.io = io
  return {
    ...actual,
    loadMyMailSetting: vi.fn(async () => ({ on: mail.on, hiddenLabels: [], address: 'marisol@clickplumbing.example', ready: true })),
    supabaseMyMailIo: () => io,
  }
})

const GREG = 'Is the detention pond in sitework?'

function Where() {
  const location = useLocation()
  return <output data-testid="where">{`${location.pathname}${location.search}`}</output>
}

function at(url: string) {
  installDomShims()
  return render(
    <ToastProvider>
      <ConfirmDialogProvider>
        <MemoryRouter initialEntries={[url]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <Routes>
            <Route path="/messages" element={<Messages />} />
          </Routes>
          <Where />
        </MemoryRouter>
      </ConfirmDialogProvider>
    </ToastProvider>,
  )
}
const where = () => screen.getByTestId('where').textContent
const io = () => mail.io!

beforeEach(() => {
  mail.on = true
  io().list.mockClear()
})
afterEach(cleanup)

describe('/messages: Follow up · My email (punch list #230 PR 3)', () => {
  it('draws the two tabs while the switch is on, and My email draws the mail in place of every Follow up section', async () => {
    at('/messages?kind=trade')
    expect(await screen.findByText(GREG)).toBeTruthy()
    const tabs = within(await screen.findByRole('tablist', { name: 'Follow up or your own mail' }))
    expect(tabs.getByRole('tab', { name: 'Follow up' }).getAttribute('aria-selected')).toBe('true')
    expect(io().list).not.toHaveBeenCalled()
    fireEvent.click(tabs.getByRole('tab', { name: 'My email' }))
    await waitFor(() => expect(where()).toBe('/messages?kind=trade&tab=my-email'))
    expect(await screen.findByTestId('my-mail-list')).toBeTruthy()
    expect(io().list).toHaveBeenCalledWith({ view: 'toTag', pageToken: null })
    expect(document.querySelector('[data-my-mail-row="greg-new"]')).toBeTruthy()
    for (const id of ['queues', 'went-out-today', 'waiting-on-them', 'everyone', 'kind-picker', 'search-glass', 'week-fold']) expect(screen.queryByTestId(id)).toBeNull()
    expect(screen.queryByText(GREG)).toBeNull()
    expect(screen.queryByRole('radiogroup', { name: 'Show' })).toBeNull()
    expect(screen.getByRole('button', { name: 'What each lane holds' })).toBeTruthy()
  })

  it('opens the thread over the tab at the line a tagged conversation sits on', async () => {
    at('/messages?tab=my-email&view=tagged')
    const row = await waitFor(() => {
      const r = document.querySelector('[data-my-mail-row="greg-old"]') as HTMLElement | null
      if (!r) throw new Error('not yet')
      return r
    })
    fireEvent.click(within(row).getByRole('button', { name: 'open the line ›' }))
    const reader = await screen.findByRole('dialog', { name: 'Re: Boerne' })
    fireEvent.click(await within(reader).findByRole('button', { name: 'open the thread ›' }))
    await waitFor(() => expect(where()).toBe('/messages?tab=my-email&view=tagged&thread=c-greg&at=m-greg-text-out'))
    expect(document.querySelector('[data-thread-window="c-greg"]')).toBeTruthy()
    expect(screen.getByTestId('my-mail-tab')).toBeTruthy()
  })

  it('goes back to Follow up as it was, taking the tab’s view and words off the address', async () => {
    at('/messages?tab=my-email&view=all&q=Boerne')
    await screen.findByTestId('my-mail-list')
    fireEvent.click(screen.getByRole('tab', { name: 'Follow up' }))
    await waitFor(() => expect(where()).toBe('/messages'))
    expect(await screen.findByText(GREG)).toBeTruthy()
    expect(screen.queryByTestId('my-mail-tab')).toBeNull()
    expect(screen.getByTestId('kind-picker')).toBeTruthy()
  })

  it('reads ?q= as the tab’s own search, and Follow up’s search never draws there', async () => {
    at('/messages?tab=my-email&q=Boerne')
    await screen.findByTestId('my-mail-list')
    expect(io().list).toHaveBeenCalledWith({ view: 'toTag', q: 'Boerne', pageToken: null })
    expect((screen.getByRole('searchbox', { name: 'Search my mail' }) as HTMLInputElement).value).toBe('Boerne')
    expect(screen.queryByTestId('search-hits')).toBeNull()
    expect(screen.queryByTestId('search-lines')).toBeNull()
  })

  it('draws no tabs while the switch is off; a link to the tab says so with its door and reads no mail', async () => {
    mail.on = false
    at('/messages')
    expect(await screen.findByText(GREG)).toBeTruthy()
    expect(screen.queryByRole('tablist')).toBeNull()
    cleanup()
    at('/messages?tab=my-email')
    expect((await screen.findByRole('link', { name: 'Open Your account' })).getAttribute('href')).toBe('/settings?tab=settings-account#settings-my-mail')
    expect(screen.getByRole('tab', { name: 'Follow up' })).toBeTruthy()
    expect(io().list).not.toHaveBeenCalled()
  })
})
