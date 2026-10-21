// @vitest-environment jsdom
/**
 * Messages in the header (residential R2, PR 1): `/messages` over fake reads. The pills over Follow up, each keeping
 * its own people and living in the URL; a link that lands on a pill; the last pill showing the supply houses and
 * candidates from the people list, since Follow up never holds them; a row opening the person's thread over the page
 * with the pill kept; and the field sent to the Dashboard. The people are the spine's demo rows; nothing is a real row.
 */
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ConfirmDialogProvider } from '../contexts/ConfirmDialogContext'
import { ToastProvider } from '../contexts/ToastContext'
import { loadMessagesView } from '../lib/messages/messagesIo'
import { installDomShims } from '../test/renderSmokeMocks'
import Messages from './Messages'

vi.mock('../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../test/renderSmokeMocks')
  return { supabase: makeSupabaseStub() }
})

/**
 * The signed-in role: someone in the office unless a test says otherwise. `loading` and a null role stand for a hard
 * load, before auth settles and before the users row lands.
 */
const auth = vi.hoisted(() => ({ role: 'assistant' as string | null, loading: false }))
vi.mock('../hooks/useAuth', async () => {
  const { makeUseAuthValue, useAuthModuleMock } = await import('../test/renderSmokeMocks')
  const byState = new Map<string, ReturnType<typeof makeUseAuthValue>>()
  const value = () => {
    const key = `${auth.role}|${auth.loading}`
    if (!byState.has(key)) byState.set(key, makeUseAuthValue({ role: auth.role, loading: auth.loading }))
    return byState.get(key)!
  }
  return { ...useAuthModuleMock(), useAuth: value, useOptionalAuth: value }
})

// The thread window's later cuts read their own tables; here the window draws with none of them.
vi.mock('../components/gc/messages/threadSlots', () => ({ useThreadSlots: () => ({}) }))

vi.mock('../lib/gc/gcIo', () => ({
  loadGcTeam: () =>
    Promise.resolve([
      { id: 'u-rosa', name: 'Rosa', role: 'assistant' },
      { id: 'u-sam', name: 'Sam', role: 'superintendent' },
    ]),
}))

// The people list and the thread: the spine's demo view, with Dee as a supply house's counter and Jonah as a candidate.
vi.mock('../lib/messages/messagesIo', async () => {
  const { spineMessagesView } = await import('../lib/messages/spineRows')
  const view = () => {
    const v = spineMessagesView()
    const kinds: Record<string, string> = { 'c-dee': 'supply_house', 'c-jonah': 'candidate' }
    return { ...v, contacts: v.contacts.map((c) => (kinds[c.id] ? { ...c, kind: kinds[c.id] } : c)) }
  }
  return {
    loadMessagesView: vi.fn(() => Promise.resolve(view())),
    nameContact: vi.fn(),
    tieMessage: vi.fn(() => Promise.resolve()),
    setDefaultJob: vi.fn(() => Promise.resolve()),
    addContactJob: vi.fn(() => Promise.resolve()),
    removeContactJob: vi.fn(() => Promise.resolve()),
    searchContactRecords: vi.fn(() => Promise.resolve([])),
    searchJobs: vi.fn(() => Promise.resolve([])),
  }
})

// Follow up's rows: a trade partner, a customer and a number nobody named wait on a reply; so does a supply house,
// whom the kernel never lets on.
vi.mock('../lib/followUp/followUpIo', async (orig) => {
  const actual = await orig<typeof import('../lib/followUp/followUpIo')>()
  const contact = (id: string, kind: string, patch: Record<string, unknown> = {}) => ({
    ...{ id, kind, customer_id: null, customer_contact_person_id: null, gc_company_id: null, gc_company_person_id: null, person_id: null },
    ...{ name: null, goes_by: null, off_since: null, off_why: null, off_by: null },
    ...{ state: 'waiting', snoozed_until: null, has_user_id: null, has_since: null, has_how: null },
    ...patch,
  })
  const text = (id: string, contactId: string, at: string, body: string) => ({
    ...{ id, contact_id: contactId, channel_id: null, bid_id: null, project_id: null, jobs_ledger_id: null, channel: 'text', direction: 'in' },
    ...{ who_user_id: null, who_text: '', at, subject: null, body, optout_line: null, back_on: null, back_by: null, back_words: null, back_done_at: null },
  })
  const rows = {
    contacts: [
      contact('c-greg', 'trade', { gc_company_id: 'gc-hillside' }),
      contact('c-elena', 'customer', { name: 'Elena Ortiz' }),
      contact('c-unk', 'unknown'),
      contact('c-dee', 'supply_house', { name: 'Dee' }),
    ],
    channels: [],
    records: { gcCompanies: [{ id: 'gc-hillside', name: 'Hillside Excavation', contact_name: 'Greg Paulk', trades: ['Sitework'] }] },
    messages: [
      text('m1', 'c-greg', '2026-10-01T14:00:00.000Z', 'Is the detention pond in sitework?'),
      text('m2', 'c-elena', '2026-10-01T16:00:00.000Z', 'Is the certificate in yet? The bank is asking.'),
      text('m3', 'c-unk', '2026-10-02T15:00:00.000Z', 'Is this the plumbing office?'),
      text('m4', 'c-dee', '2026-10-02T15:30:00.000Z', 'Your fittings are in at the counter.'),
    ],
    heard: [],
    owed: [],
  }
  const io = { loadQueue: vi.fn(() => Promise.resolve(rows)), loadHighlights: vi.fn(() => Promise.resolve([])), count: vi.fn(() => Promise.resolve(3)) }
  return { ...actual, supabaseFollowUpIo: () => io }
})

const GREG = 'Is the detention pond in sitework?'
const ELENA = 'Is the certificate in yet? The bank is asking.'
const UNKNOWN = 'Is this the plumbing office?'
const DEE = 'Your fittings are in at the counter.'

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
            <Route path="/dashboard" element={<div>The Dashboard</div>} />
          </Routes>
          <Where />
        </MemoryRouter>
      </ConfirmDialogProvider>
    </ToastProvider>,
  )
}

const pill = (name: string) => within(screen.getByRole('group', { name: 'Which people to show' })).getByRole('button', { name })
const where = () => screen.getByTestId('where').textContent

beforeEach(() => {
  auth.role = 'assistant'
  auth.loading = false
  vi.mocked(loadMessagesView).mockClear()
})
afterEach(cleanup)

describe('/messages: Follow up with the kind pills', () => {
  it('opens on All with every pill in the prototype’s order, and everyone Follow up holds', async () => {
    at('/messages')
    expect(await screen.findByText(GREG)).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Messages' })).toBeTruthy()
    const pills = within(screen.getByRole('group', { name: 'Which people to show' })).getAllByRole('button')
    expect(pills.map((b) => b.textContent)).toEqual(['All', 'Customers', 'Trade partners', 'Architects', 'Leads', 'Subs', 'Our team', 'Supply houses and candidates'])
    expect(pill('All').getAttribute('aria-pressed')).toBe('true')
    expect(screen.getByText(ELENA)).toBeTruthy()
    expect(screen.getByText(UNKNOWN)).toBeTruthy()
    expect(screen.queryByText(DEE)).toBeNull()
    // Follow up alone: the people list and the thread are not read until something needs them.
    expect(loadMessagesView).not.toHaveBeenCalled()
  })

  it('keeps each pill’s own people, and puts the pill in the URL', async () => {
    at('/messages')
    await screen.findByText(GREG)
    fireEvent.click(pill('Customers'))
    await waitFor(() => expect(screen.queryByText(GREG)).toBeNull())
    expect(screen.getByText(ELENA)).toBeTruthy()
    expect(screen.queryByText(UNKNOWN)).toBeNull()
    expect(pill('Customers').getAttribute('aria-pressed')).toBe('true')
    expect(where()).toBe('/messages?kind=customer')
    fireEvent.click(pill('All'))
    expect(await screen.findByText(GREG)).toBeTruthy()
    expect(where()).toBe('/messages')
  })

  it('lands on the pill a link asks for', async () => {
    at('/messages?kind=trade')
    expect(await screen.findByText(GREG)).toBeTruthy()
    expect(screen.queryByText(ELENA)).toBeNull()
    expect(pill('Trade partners').getAttribute('aria-pressed')).toBe('true')
  })

  it('shows the supply houses and candidates from the people list under the last pill, with no filter row of its own', async () => {
    at('/messages')
    await screen.findByText(GREG)
    fireEvent.click(pill('Supply houses and candidates'))
    const list = await screen.findByRole('list')
    const rows = within(list)
      .getAllByRole('button')
      .map((b) => b.getAttribute('data-messages-row'))
    expect(rows.sort()).toEqual(['c-dee', 'c-jonah'])
    expect(screen.getByText('They never count on Follow up. Each shows here by their last line.')).toBeTruthy()
    expect(screen.queryByRole('group', { name: 'Who to show' })).toBeNull()
    expect(screen.queryByText(GREG)).toBeNull()
    expect(where()).toBe('/messages?kind=more')
  })

  it('shows everyone we have talked with under the lane on a press, reading the view only then (v2.5700)', async () => {
    at('/messages')
    await screen.findByText(GREG)
    expect(loadMessagesView).not.toHaveBeenCalled()
    const section = screen.getByRole('region', { name: 'Everyone we have talked with' })
    expect(within(section).queryByRole('list')).toBeNull()
    fireEvent.click(within(section).getByRole('button', { name: 'Show everyone' }))
    await waitFor(() => expect(loadMessagesView).toHaveBeenCalled())
    const list = await within(section).findByRole('list')
    const rows = within(list)
      .getAllByRole('button')
      .map((b) => b.getAttribute('data-messages-row'))
    expect(rows).toContain('c-dee')
    expect(within(section).getByLabelText('Search the messages')).toBeTruthy()
    expect(screen.getByText(GREG)).toBeTruthy()
    fireEvent.click(within(section).getByRole('button', { name: 'Hide everyone' }))
    expect(within(section).queryByRole('list')).toBeNull()
  })

  it('searches every message from the box under the pills: the lines that match replace the lists, and a row opens the thread at its line (v2.5701)', async () => {
    at('/messages')
    await screen.findByText(GREG)
    expect(loadMessagesView).not.toHaveBeenCalled()
    const box = screen.getByLabelText('Search every message') as HTMLInputElement
    fireEvent.change(box, { target: { value: 'd' } })
    expect(screen.getByText('Type two letters or more.')).toBeTruthy()
    expect(loadMessagesView).not.toHaveBeenCalled()
    fireEvent.change(box, { target: { value: 'detention' } })
    await waitFor(() => expect(loadMessagesView).toHaveBeenCalled())
    const hits = await screen.findAllByTestId('search-hit')
    expect(hits.length).toBeGreaterThanOrEqual(1)
    const greg = hits.find((h) => h.textContent?.includes('Addendum 1'))!
    expect(greg).toBeTruthy()
    expect(within(greg).getByText('detention').tagName).toBe('MARK')
    expect(screen.queryByText(GREG)).toBeNull()
    expect(screen.queryByTestId('went-out-today')).toBeNull()
    fireEvent.click(greg)
    await waitFor(() => expect(where()).toContain('thread=c-greg'))
    expect(where()).toContain('at=m-greg-text-in')
    fireEvent.change(box, { target: { value: '' } })
    expect(await screen.findByText(GREG)).toBeTruthy()
    expect(screen.queryByTestId('search-hits')).toBeNull()
  })

  it('keeps the search in the URL: a link with q= lands on the lines, and typing writes it (v2.5708)', async () => {
    at('/messages?kind=trade&q=detention')
    const box = (await screen.findByLabelText('Search every message')) as HTMLInputElement
    expect(box.value).toBe('detention')
    await waitFor(() => expect(loadMessagesView).toHaveBeenCalled())
    expect(await screen.findAllByTestId('search-hit')).toBeTruthy()
    fireEvent.change(box, { target: { value: 'pond' } })
    await waitFor(() => expect(where()).toBe('/messages?kind=trade&q=pond'))
    fireEvent.change(box, { target: { value: '' } })
    await waitFor(() => expect(where()).toBe('/messages?kind=trade'))
  })

  it('opens a person’s thread over the page and keeps the pill', async () => {
    at('/messages?kind=customer')
    fireEvent.click(await screen.findByText(ELENA))
    await waitFor(() => expect(where()).toContain('thread=c-elena'))
    expect(where()).toContain('kind=customer')
    await waitFor(() => expect(loadMessagesView).toHaveBeenCalled())
  })

  it('sends a superintendent to the Dashboard, since the spine’s tables are the office’s', async () => {
    auth.role = 'superintendent'
    at('/messages')
    expect(await screen.findByText('The Dashboard')).toBeTruthy()
    expect(screen.queryByRole('heading', { name: 'Messages' })).toBeNull()
  })
})

describe('/messages from a link: it waits for the role before it decides (a hard load)', () => {
  it('stays on Messages while auth loads', async () => {
    auth.loading = true
    at('/messages?thread=c-elena&at=m-1')
    expect(await screen.findByText('Loading…')).toBeTruthy()
    expect(screen.queryByText('The Dashboard')).toBeNull()
    expect(where()).toBe('/messages?thread=c-elena&at=m-1')
  })

  it('stays while a signed-in person’s role has not landed, the cold load that sent the owner to the Dashboard', async () => {
    auth.role = null
    at('/messages?thread=c-elena&at=m-1')
    expect(await screen.findByText('Loading…')).toBeTruthy()
    expect(screen.queryByText('The Dashboard')).toBeNull()
    expect(where()).toBe('/messages?thread=c-elena&at=m-1')
  })

  it('sends a primary to the Dashboard once the role lands', async () => {
    auth.role = 'primary'
    at('/messages?thread=c-elena&at=m-1')
    expect(await screen.findByText('The Dashboard')).toBeTruthy()
  })

  it('opens for the owner, keeping the link', async () => {
    auth.role = 'master_technician'
    at('/messages?thread=c-elena&at=m-1')
    expect(await screen.findByRole('heading', { name: 'Messages' })).toBeTruthy()
    expect(where()).toContain('thread=c-elena')
  })
})

describe('/messages: the page sits in the middle of a wide screen', () => {
  // v2.5537: the same container as GC projects, centered the same way.
  it('caps the page at 1100px and centers it with auto margins, full width inside the cap', async () => {
    at('/messages')
    await screen.findByText(GREG)
    const page = screen.getByRole('heading', { name: 'Messages' }).closest('[data-messages-page]') as HTMLElement
    expect(page).toBeTruthy()
    expect(page.style.maxWidth).toBe('1100px')
    expect(page.style.width).toBe('100%')
    expect(page.style.marginLeft).toBe('auto')
    expect(page.style.marginRight).toBe('auto')
  })
})

describe('/messages: the owner’s switch card (punch list #140 PR 2)', () => {
  it('a dev sees the Finish switching Messages on line; an assistant does not', async () => {
    auth.role = 'dev'
    at('/messages')
    expect(await screen.findByRole('button', { name: /^Finish switching Messages on · \d of 8 on/ })).toBeTruthy()
    cleanup()
    auth.role = 'assistant'
    at('/messages')
    await screen.findByRole('group', { name: 'Which people to show' })
    expect(screen.queryByRole('button', { name: /Finish switching Messages on/ })).toBeNull()
  })
})
