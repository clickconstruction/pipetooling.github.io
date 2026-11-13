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
import { supabaseFollowUpIo } from '../lib/followUp/followUpIo'
import type { FollowUpRows } from '../lib/followUp/followUpRows'
import { KEPT_READ_SCHEMA } from '../lib/keptRead'
import { messagesKeptKey, type MessagesKeptQueue } from '../lib/messages/keptQueue'
import { loadMessagesView } from '../lib/messages/messagesIo'
import { installDomShims, SMOKE_AUTH_USER_ID } from '../test/renderSmokeMocks'
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

// The device's kept read (punch list #183 PR 5): nothing kept unless a case says so.
const keptStore = vi.hoisted(() => ({ read: vi.fn(async (_key: string): Promise<unknown> => null), write: vi.fn(async (_kept: unknown) => {}) }))
vi.mock('../lib/keptReadStore', () => ({
  readKeptRead: (key: string) => keptStore.read(key),
  writeKeptRead: (kept: unknown) => keptStore.write(kept),
  clearKeptReads: vi.fn(async () => {}),
}))

// The last 7 days (punch list #140 PR 5): an empty fortnight; the longest wait comes from the queue below, not this read.
vi.mock('../lib/messages/weekStripIo', () => ({ loadWeekStrip: vi.fn(() => Promise.resolve({ lines: [], estimates: [] })) }))

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
    // A lead's doors (punch list #140 PR 8) and Answer all's box (PR 6) read the person with their numbers; nobody's record reads here.
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
      // Held by the signed-in person (the smoke's auth user), for the Show lens (punch list #140 PR 3).
      contact('c-held', 'customer', { name: 'Held Customer', has_user_id: 'smoke-auth-user-1', has_since: '2026-10-02T16:10:00.000Z', has_how: 'took' }),
    ],
    channels: [],
    records: { gcCompanies: [{ id: 'gc-hillside', name: 'Hillside Excavation', contact_name: 'Greg Paulk', trades: ['Sitework'] }] },
    messages: [
      text('m1', 'c-greg', '2026-10-01T14:00:00.000Z', 'Is the detention pond in sitework?'),
      text('m2', 'c-elena', '2026-10-01T16:00:00.000Z', 'Is the certificate in yet? The bank is asking.'),
      text('m3', 'c-unk', '2026-10-02T15:00:00.000Z', 'Is this the plumbing office?'),
      text('m4', 'c-dee', '2026-10-02T15:30:00.000Z', 'Your fittings are in at the counter.'),
      text('m5', 'c-held', '2026-10-02T16:00:00.000Z', 'Can you come Thursday?'),
    ],
    heard: [],
    owed: [],
  }
  const io = { loadQueue: vi.fn(() => Promise.resolve(rows)), loadHighlights: vi.fn(() => Promise.resolve([])), loadDoneFold: vi.fn(() => Promise.resolve({ said: [], filed: [] })), count: vi.fn(() => Promise.resolve(3)) }
  return { ...actual, supabaseFollowUpIo: () => io }
})

const GREG = 'Is the detention pond in sitework?'
const ELENA = 'Is the certificate in yet? The bank is asking.'
const UNKNOWN = 'Is this the plumbing office?'
const DEE = 'Your fittings are in at the counter.'
const HELD = 'Can you come Thursday?'

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

/** The kind picker's menu (v2.5801): opened on the first press, then a pill in it. */
const menu = () => {
  if (!screen.queryByRole('group', { name: 'Which people to show' })) fireEvent.click(screen.getByTestId('kind-picker'))
  return within(screen.getByRole('group', { name: 'Which people to show' }))
}
const pill = (name: string) => menu().getByRole('button', { name })
/** The search box (v2.5801): behind the glass until a press, or a link with ?q=. */
const openSearch = () => fireEvent.click(screen.getByRole('button', { name: 'Open the search' }))
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
    const pills = menu().getAllByRole('button')
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
    openSearch()
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
    expect(await screen.findByRole('button', { name: /^Finish switching Messages on · \d of 9 on/ })).toBeTruthy()
    cleanup()
    auth.role = 'assistant'
    at('/messages')
    await screen.findByTestId('kind-picker')
    expect(screen.queryByRole('button', { name: /Finish switching Messages on/ })).toBeNull()
  })
})

describe('/messages: Show, Mine · Everyone (punch list #140 PR 3)', () => {
  beforeEach(() => localStorage.removeItem('messages_show_lens'))
  const show = () => within(screen.getByRole('radiogroup', { name: 'Show' }))

  it('Mine shows only the people I hold, the browser keeps it, and Everyone brings them back', async () => {
    at('/messages')
    await screen.findByText(GREG)
    expect(screen.getByText(HELD)).toBeTruthy()
    // The counts land a render after the rows: the panel hears the queue in an effect, so wait for them.
    expect((await show().findByRole('radio', { name: /^Everyone · \d+$/ })).getAttribute('aria-checked')).toBe('true')
    fireEvent.click(await show().findByRole('radio', { name: 'Mine · 1' }))
    await waitFor(() => expect(screen.queryByText(GREG)).toBeNull())
    expect(screen.getByText(HELD)).toBeTruthy()
    expect(screen.queryByText(UNKNOWN)).toBeNull()
    expect(screen.getByText('Waiting on them and Went out show everyone. Nobody holds a send.')).toBeTruthy()
    expect(localStorage.getItem('messages_show_lens')).toBe('mine')
    cleanup()
    at('/messages')
    await screen.findByText(HELD)
    expect(show().getByRole('radio', { name: /^Mine/ }).getAttribute('aria-checked')).toBe('true')
    expect(screen.queryByText(GREG)).toBeNull()
    fireEvent.click(show().getByRole('radio', { name: /^Everyone/ }))
    expect(await screen.findByText(GREG)).toBeTruthy()
    expect(localStorage.getItem('messages_show_lens')).toBe('everyone')
  })
})

describe('/messages: the last 7 days (punch list #140 PR 5)', () => {
  it('sits with the lanes, its longest wait the queue’s first row, and hides while searching', async () => {
    at('/messages')
    await screen.findByText(GREG)
    localStorage.removeItem('messages_week_open')
    fireEvent.click(await screen.findByRole('button', { name: '7 days' }))
    const strip = await screen.findByTestId('week-strip')
    const tiles = await within(strip).findAllByTestId('strip-tile')
    expect(tiles.map((t) => t.getAttribute('data-key'))).toEqual(['answered', 'longest', 'notDelivered', 'estimates', 'ratings'])
    // An empty fortnight: three tiles read none. Needs a reply holds the one person somebody has (the rest wait in
    // New), so the longest wait is the held customer, with who has them.
    expect(within(tiles[0]!).getByTestId('strip-value').textContent).toBe('none')
    // The longest wait lands a render after the rows: the page hears the queue in the panel's effect, so wait for it.
    await waitFor(() => expect(within(tiles[1]!).getByTestId('strip-sub').textContent).toBe('Held Customer · Smoke Dev has it'))
    expect((tiles[1] as HTMLButtonElement).disabled).toBe(false)
    fireEvent.click(tiles[1]!)
    expect(where()).toBe('/messages?thread=c-held&at=m5')
    openSearch()
    fireEvent.change(screen.getByTestId('search-lines'), { target: { value: 'pond' } })
    await waitFor(() => expect(screen.queryByTestId('week-strip')).toBeNull())
  })
})

describe('/messages: Answer all (punch list #140 PR 6)', () => {
  it('under Mine the desk walks only the people I hold, and reads the threads while it is open', async () => {
    at('/messages')
    await screen.findByText(GREG)
    fireEvent.click(await within(screen.getByRole('radiogroup', { name: 'Show' })).findByRole('radio', { name: 'Mine · 1' }))
    await waitFor(() => expect(screen.queryByText(GREG)).toBeNull())
    const lane = screen.getByRole('region', { name: 'Needs a reply' })
    fireEvent.click(within(lane).getByRole('button', { name: 'Answer all' }))
    const desk = await screen.findByRole('dialog', { name: 'Answer all' })
    expect([...desk.querySelectorAll('[data-answer-all-progress] span > span:last-child')].map((s) => s.textContent)).toEqual(['Needs a reply', '1 to answer', '1 of 1'])
    expect(desk.querySelector('[data-answer-all-card]')?.getAttribute('data-answer-all-card')).toBe('c-held')
    await waitFor(() => expect(loadMessagesView).toHaveBeenCalled())
    expect(await within(desk).findByText('Their record could not be read. Answer them from their thread.')).toBeTruthy()
  })
  it('a link with answer=all opens the desk with no press, and closing it takes the link off the address (v2.5816)', async () => {
    localStorage.removeItem('messages_show_lens')
    at('/messages?answer=all&kind=all')
    expect(await screen.findByRole('dialog', { name: 'Answer all' })).toBeTruthy()
    fireEvent.keyDown(window, { key: 'Escape' })
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Answer all' })).toBeNull())
    await waitFor(() => expect(where()).not.toContain('answer=all'))
    expect(where()).toContain('/messages')
  })
})

describe('/messages: the kept queue (punch list #183 PR 5)', () => {
  const STAMP = '[data-kept-read-stamp]'
  /** What the device kept: Kay waiting on a reply, held by the signed-in person. Made up. */
  const stored = (lane: MessagesKeptQueue['lanes']['needsReply'], people: MessagesKeptQueue['people']) => ({
    key: messagesKeptKey(SMOKE_AUTH_USER_ID),
    schema: KEPT_READ_SCHEMA,
    scopes: ['queue'],
    readAt: Date.now() - 5 * 60_000,
    rows: [{ lanes: { newLane: [], needsYou: [], needsReply: lane, weOwe: [], calls: [] }, count: lane.length, people, lines: [], setAside: [] } satisfies MessagesKeptQueue],
  })
  const KAY: MessagesKeptQueue['people'][number] = { id: 'c-kay', kind: 'customer', name: 'Kay Winters', state: 'waiting', has: 'You', hasUserId: SMOKE_AUTH_USER_ID, hasSince: '2026-10-01T15:00:00.000Z', hasHow: 'took' }
  const KAY_ROW: MessagesKeptQueue['lanes']['needsReply'][number] = { contactId: 'c-kay', landOnId: null, waitingSince: '2026-10-01T15:00:00.000Z', callBack: false, offers: [], acts: ['Reply', 'No reply needed', 'Remind me Monday'] }
  const queueIo = supabaseFollowUpIo()
  /** The queue's read hangs until the case lands it; the read every other case makes comes back after. */
  const holdTheRead = () => {
    let land: (rows: FollowUpRows) => void = () => {}
    vi.mocked(queueIo.loadQueue).mockImplementationOnce(() => new Promise<FollowUpRows>((resolve) => (land = resolve)))
    return (rows: FollowUpRows) => land(rows)
  }
  const nobody: FollowUpRows = { contacts: [], channels: [], records: {}, messages: [], heard: [], owed: [] }
  const realMatchMedia = window.matchMedia

  beforeEach(() => {
    localStorage.removeItem('messages_week_open')
    localStorage.removeItem('messages_show_lens')
    keptStore.read.mockReset()
    keptStore.read.mockResolvedValue(null)
    keptStore.write.mockClear()
  })
  afterEach(() => {
    // The tree comes down before the phone's matchMedia is put back: a passive effect of the last render (the jump
    // strip's `useMatchMedia`) can still flush on the unmount, and the saved value is jsdom's undefined, which the
    // shim fills again (the merge queue's flake of 2026-11-02, "window.matchMedia is not a function").
    cleanup()
    window.matchMedia = realMatchMedia
    installDomShims()
    keptStore.read.mockReset()
    keptStore.read.mockResolvedValue(null)
  })

  it('while the read hangs, the bar counts the device’s kept read and mutes it, and the live read lands over it', async () => {
    keptStore.read.mockResolvedValue(stored([KAY_ROW], [KAY]))
    const land = holdTheRead()
    at('/messages')
    await screen.findByText('Kay Winters')
    expect(keptStore.read).toHaveBeenCalledWith(messagesKeptKey(SMOKE_AUTH_USER_ID))
    expect(document.querySelector(STAMP)!.textContent).toMatch(/^Who was waiting at .+ · reading again…$/)
    expect(screen.queryByText('Loading who is waiting on us…')).toBeNull()
    const pinned = document.querySelector('[data-messages-pinned]') as HTMLElement
    await waitFor(() => expect(pinned.hasAttribute('data-kept-read')).toBe(true))
    expect(document.querySelector('[data-messages-jump-strip]')!.hasAttribute('data-kept-read')).toBe(true)
    // The bar's counts are the kept read's: one waiting, held by me.
    const lane = within(pinned).getAllByTestId('jump-lane').find((b) => b.dataset.lane === 'needsReply')!
    expect(lane.querySelector('.stagesStageSegMeta')!.textContent).toBe('1')
    expect(lane.querySelector('.stagesStageSegMeta')!.classList.contains('keptCount')).toBe(true)
    const show = within(screen.getByRole('radiogroup', { name: 'Show' }))
    expect(show.getByRole('radio', { name: 'Mine · 1' })).toBeTruthy()
    expect(show.getByRole('radio', { name: 'Everyone · 1' })).toBeTruthy()
    expect((screen.getByRole('button', { name: 'Answer all' }) as HTMLButtonElement).disabled).toBe(true)
    // A kind pill narrows the kept queue as it does the live one.
    fireEvent.click(pill('Trade partners'))
    await waitFor(() => expect(screen.queryByText('Kay Winters')).toBeNull())
    expect(document.querySelector(STAMP)).not.toBeNull()
    fireEvent.click(pill('All'))
    await screen.findByText('Kay Winters')

    land(nobody)
    await waitFor(() => expect(document.querySelector(STAMP)).toBeNull())
    expect(screen.queryByText('Kay Winters')).toBeNull()
    await waitFor(() => expect(pinned.hasAttribute('data-kept-read')).toBe(false))
    expect(document.querySelector('[data-messages-jump-strip]')!.hasAttribute('data-kept-read')).toBe(false)
    await waitFor(() => expect(keptStore.write).toHaveBeenCalledTimes(1))
    expect(keptStore.write.mock.calls[0]![0]).toMatchObject({ key: messagesKeptKey(SMOKE_AUTH_USER_ID), scopes: ['queue'] })
  })

  it('a phone never folds a kept queue, whose stamp must show, even one with nobody waiting; it folds once the live read says so', async () => {
    window.matchMedia = ((query: string) => ({ matches: query.includes('760px'), media: query, onchange: null, addListener: () => {}, removeListener: () => {}, addEventListener: () => {}, removeEventListener: () => {}, dispatchEvent: () => false })) as typeof window.matchMedia
    keptStore.read.mockResolvedValue(stored([], []))
    const land = holdTheRead()
    at('/messages')
    await waitFor(() => expect(document.querySelector(STAMP)).not.toBeNull())
    // The page hears the kept count and the kept time in the render after the stamp; read the fold once it has both.
    await waitFor(() => expect(document.querySelector('[data-messages-top-bar]')!.hasAttribute('data-kept-read')).toBe(true))
    expect(screen.queryByTestId('queues-fold')).toBeNull()
    expect((screen.getByTestId('queues') as HTMLElement).style.display).not.toBe('none')
    land(nobody)
    await screen.findByTestId('queues-fold')
    expect(document.querySelector(STAMP)).toBeNull()
  })
})

describe('/messages: the jump strip over the lanes (punch list #151 PR 1)', () => {
  it('lists the lanes with the counts their headings show, lands a press on the lane, and hides while searching', async () => {
    at('/messages')
    const lanes = await screen.findAllByTestId('jump-lane')
    expect(lanes.map((b) => b.dataset.lane)).toEqual(['new', 'needsReply', 'weOwe', 'waiting', 'wentOut'])
    // Each segment's count is its heading's own: the strip reads nothing of its own.
    await waitFor(() => {
      for (const lane of screen.getAllByTestId('jump-lane')) {
        const label = lane.querySelector('.stagesStageSegName')!.textContent
        const count = lane.querySelector('.stagesStageSegMeta')!.textContent
        expect(count).not.toBe('…')
        expect(screen.getByRole('heading', { name: `${label} (${count})` })).toBeTruthy()
      }
    })
    const scroll = vi.spyOn(Element.prototype, 'scrollIntoView')
    fireEvent.click(screen.getByLabelText(/^Jump to Went out/))
    await waitFor(() => expect(scroll).toHaveBeenCalled())
    expect(scroll.mock.instances[0]).toBe(document.getElementById('went-out'))
    expect(document.getElementById('went-out')?.className).toBe('messagesLane')
    expect(document.getElementById('new-lane')?.className).toBe('messagesLane')
    scroll.mockRestore()
    openSearch()
    fireEvent.change(screen.getByTestId('search-lines'), { target: { value: 'pond' } })
    await waitFor(() => expect(screen.queryByTestId('jump-lane')).toBeNull())
  })
})

describe('/messages: one bar at the top (punch list #151 PR 2)', () => {
  // The browser keeps Show and the week: the Answer all case above leaves Mine on, so start each case on Everyone, closed.
  beforeEach(() => {
    localStorage.removeItem('messages_week_open')
    localStorage.removeItem('messages_show_lens')
  })

  it('pins the title, the picker, Show, the glass, the strip and 7 days in one bar, and the picker keeps the pill in the URL', async () => {
    at('/messages')
    await screen.findByText(GREG)
    const pinned = document.querySelector('[data-messages-pinned]') as HTMLElement
    expect(pinned).toBeTruthy()
    expect(within(pinned).getByRole('heading', { name: 'Messages' })).toBeTruthy()
    expect(within(pinned).getAllByTestId('jump-lane').length).toBeGreaterThanOrEqual(5)
    expect(within(pinned).getByRole('radiogroup', { name: 'Show' })).toBeTruthy()
    expect(screen.queryByTestId('search-lines')).toBeNull()
    expect(screen.queryByTestId('week-strip')).toBeNull()
    fireEvent.click(pill('Trade partners'))
    await waitFor(() => expect(where()).toBe('/messages?kind=trade'))
    expect(screen.getByTestId('kind-picker').textContent).toBe('Trade partners ▾')
  })

  it('the glass opens the box with focus and closing it clears the words; 7 days opens the week and the browser keeps it', async () => {
    at('/messages')
    await screen.findByText(GREG)
    openSearch()
    const box = screen.getByTestId('search-lines') as HTMLInputElement
    expect(document.activeElement).toBe(box)
    fireEvent.change(box, { target: { value: 'pond' } })
    await waitFor(() => expect(where()).toBe('/messages?q=pond'))
    fireEvent.click(screen.getByRole('button', { name: 'Close the search' }))
    await waitFor(() => expect(where()).toBe('/messages'))
    expect(screen.queryByTestId('search-lines')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: '7 days' }))
    expect(await screen.findByTestId('week-strip')).toBeTruthy()
    expect(localStorage.getItem('messages_week_open')).toBe('open')
    cleanup()
    at('/messages')
    expect(await screen.findByTestId('week-strip')).toBeTruthy()
    expect(screen.getByRole('button', { name: '7 days' }).getAttribute('aria-expanded')).toBe('true')
  })
})

describe('/messages: the lanes’ sentences behind the ?, the headings as bands (punch list #151 PR 3)', () => {
  it('keeps every lane’s sentence off the page until ? opens the card, and draws each heading as a band with its count', async () => {
    at('/messages')
    await screen.findByText(GREG)
    const newNote = 'What came in and still needs sorting. Its row opens the thread, with the sort at the top.'
    expect(screen.queryByText(newNote)).toBeNull()
    expect(screen.queryByText(/Our line is the last word/)).toBeNull()
    expect(screen.queryByTestId('lane-legend')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'What each lane holds' }))
    const card = await screen.findByRole('region', { name: 'What each lane holds' })
    expect(within(card).getByText(newNote)).toBeTruthy()
    expect(within(card).getByText(/^Every text and email we sent in the last 7 days/)).toBeTruthy()
    fireEvent.click(within(card).getByRole('button', { name: 'Close' }))
    expect(screen.queryByTestId('lane-legend')).toBeNull()
    expect(screen.getAllByTestId('lane-band').length).toBeGreaterThanOrEqual(4)
    const heading = screen.getByRole('heading', { name: /^New \(\d+\)$/ })
    expect(heading.querySelector('.stagesBandCount')?.textContent).toMatch(/^\d+$/)
    expect(heading.closest('.messagesLaneBand')?.getAttribute('style')).toContain('--stage-color: #3b82f6')
    expect(screen.getByRole('heading', { name: /^Went out \(\d+\)$/ }).closest('.messagesLaneBand')).toBeTruthy()
  })
})
