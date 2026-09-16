// @vitest-environment jsdom
/**
 * Render smokes for the review room (Submittals stage 4a): the customer's words on the
 * page (the differing rows first, the matching rows folded), the revision strip, the
 * PDF door through open-submittal-pdf, the identify stub behind a decision, the closed
 * state, and the dead link. The fetch is mocked; the page's own tokens ride the URL.
 */
import { describe, expect, it, vi, afterEach } from 'vitest'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

import SubmittalRoom from './SubmittalRoom'

vi.mock('../lib/publicFunctionStaffHeaders', () => ({ staffAwarePublicHeaders: () => Promise.resolve({ apikey: 'anon', Authorization: 'Bearer anon' }) }))

const row = (o: Record<string, unknown>) => ({ id: 'r', tag: 'X-1', kind: 'matches', plans: 'TOTO CT708UVG', proposed: 'TOTO CT708UVG#01', why: '', performanceChange: false, sheetPages: 1, decision: null, ...o })
const payload = (o: Record<string, unknown> = {}) => ({
  status: 'open',
  closedAt: null,
  bid: { label: 'B398 ZZ Test', projectName: 'ZZ Test', address: '5501 Balcones Dr, Austin, TX' },
  company: { name: 'Click Plumbing', tagline: 'Plumbing, Electrical, and HVAC', phone: '(512) 555-0100' },
  person: null,
  revisions: [
    {
      id: 'rev-2', rev: 2, sharedAt: '2026-09-16T15:00:00Z', current: true, hasPackage: true,
      rows: [
        row({ id: 'a', tag: 'DWH-1', kind: 'differs', plans: 'Rheem RH375 · 40 gal', proposed: 'Bradford White RE2HP50 · 50 gal', why: 'The specified product has a long lead time · about 1 week.' }),
        row({ id: 'b', tag: 'FV-1', kind: 'differs', plans: 'TOTO TET2UA31 · 1.0 gpf', proposed: 'TOTO TET2LB31 · 1.28 gpf', why: 'A performance value differs from the plans.', performanceChange: true, decision: { kind: 'revise', note: 'hold 1.0 gpf', byName: 'Dana W.', byPersonId: 'p1', at: '2026-09-16T16:00:00Z' } }),
        row({ id: 'c', tag: 'PRV-1', kind: 'not_quoted', proposed: '', why: 'No product yet — to follow.', sheetPages: 0 }),
        row({ id: 'd', tag: 'WC-1', kind: 'matches' }),
        row({ id: 'e', tag: 'KS-1', kind: 'matches', plans: 'Elkay LRAD2522', proposed: 'ELKAY LRAD2522' }),
      ],
      counts: { total: 5, matches: 2, differs: 2, notQuoted: 1, added: 0, decided: 1, open: 1 },
    },
    { id: 'rev-1', rev: 1, sharedAt: '2026-09-15T15:00:00Z', current: false, hasPackage: true, rows: [row({ id: 'z', tag: 'WC-1', kind: 'matches' })], counts: { total: 1, matches: 1, differs: 0, notQuoted: 0, added: 0, decided: 0, open: 0 } },
  ],
  ...o,
})

function mockFetch(status: number, body: unknown) {
  const f = vi.fn((_url: string, _init?: RequestInit) => Promise.resolve({ ok: status >= 200 && status < 300, status, json: () => Promise.resolve(body) } as Response))
  vi.stubGlobal('fetch', f)
  return f
}

function mount(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <SubmittalRoom />
    </MemoryRouter>,
  )
}

afterEach(() => {
  vi.unstubAllGlobals()
  localStorage.clear()
})

describe('SubmittalRoom', () => {
  it('draws the room in the customer\'s words: the differing rows first, the matches folded, the PDF door, the strip', async () => {
    const f = mockFetch(200, payload())
    mount('/submittal?t=roomtoken')
    expect(await screen.findByText('1 row needs a call')).toBeTruthy()
    expect(String(f.mock.calls[0]?.[0])).toMatch(/get-submittal-room\?t=roomtoken$/)
    const cards = screen.getAllByTestId('room-row')
    expect(cards.map((c) => c.querySelector('b')?.textContent)).toEqual(['DWH-1', 'FV-1', 'PRV-1'])
    expect(within(cards[0]!).getByText(/Why: The specified product has a long lead time/)).toBeTruthy()
    expect(within(cards[1]!).getByText('This changes a performance value on the plans.')).toBeTruthy()
    expect(cards[1]!.textContent).toMatch(/Revise · Dana W\./)
    expect(screen.queryByText('KS-1')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: /Show the 2 rows as the plans specify/ }))
    expect(screen.getByText('KS-1')).toBeTruthy()
    expect(screen.getByTestId('room-pdf').getAttribute('href')).toMatch(/open-submittal-pdf\?t=roomtoken&r=rev-2$/)
    expect(screen.getByTestId('room-revisions').textContent).toMatch(/Rev 2 · current · Sep 16.*Rev 1 · Sep 15/)
    expect(document.body.textContent).not.toMatch(/\$|NWS|Alternate/)
    fireEvent.click(screen.getByRole('button', { name: 'Rev 1 · Sep 15' }))
    expect(screen.getByText('Everything matches the plans')).toBeTruthy()
  })

  it('a personal link names its person; a watching person can tap but not send', async () => {
    mockFetch(200, payload({ person: { id: 'p1', name: 'Dana Whitfield', role: 'architect', mayDecide: false } }))
    mount('/submittal?t=persontoken')
    await screen.findByText('1 row needs a call')
    expect(screen.getByText(/This link was made for/).textContent).toMatch(/Dana Whitfield · architect · watching/)
    expect(screen.getByTestId('room-send').textContent).toMatch(/Reviewing as Dana Whitfield · architect · watching/)
    fireEvent.click(within(screen.getByRole('group', { name: 'Your call on DWH-1' })).getByRole('button', { name: 'Approve' }))
    expect(screen.queryByRole('dialog')).toBeNull()
    expect((screen.getByRole('button', { name: 'Watching only' }) as HTMLButtonElement).disabled).toBe(true)
  })

  it('a closed room says so; a dead link says so; no token says so', async () => {
    mockFetch(410, payload({ status: 'closed', closedAt: '2026-09-19T15:00:00Z', revisions: [] }))
    mount('/submittal?t=old')
    expect((await screen.findByTestId('room-closed')).textContent).toMatch(/This review is closed · Sep 19/)
    vi.unstubAllGlobals()
    mockFetch(404, { error: 'Not found' })
    mount('/submittal?t=gone')
    expect(await screen.findByText('This link is no longer active. Please contact our office for a new one.')).toBeTruthy()
    mount('/submittal')
    expect(await screen.findByText('This link is incomplete.')).toBeTruthy()
  })
})

describe('SubmittalRoom · identify and decide (4a-ii)', () => {
  function mockRoomAndPosts(personToken = 'ptok') {
    const calls: Array<{ url: string; body: unknown }> = []
    const f = vi.fn((url: string, init?: RequestInit) => {
      if (String(url).includes('get-submittal-room')) return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(payload()) } as Response)
      const body = JSON.parse(String(init?.body ?? '{}')) as { action?: string }
      calls.push({ url: String(url), body })
      if (body.action === 'identify') return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({ ok: true, personToken, person: { id: 'p9', name: 'Tom Reyes', role: 'owners_rep', mayDecide: true } }) } as Response)
      if (body.action === 'decide') return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({ ok: true, decided: 2, counts: { approved: 1, revise: 1, rejected: 0 } }) } as Response)
      return Promise.resolve({ ok: false, status: 400, json: () => Promise.resolve({ error: 'x' }) } as Response)
    })
    vi.stubGlobal('fetch', f)
    return calls
  }

  it('the first decision asks who you are; That\'s me identifies, rewrites the address, and Send my review records the decisions with the name', async () => {
    const calls = mockRoomAndPosts()
    const replace = vi.spyOn(window.history, 'replaceState').mockImplementation(() => {})
    mount('/submittal?t=roomtoken')
    await screen.findByText('1 row needs a call')
    fireEvent.click(within(screen.getByRole('group', { name: 'Your call on DWH-1' })).getByRole('button', { name: 'Approve' }))
    const sheet = await screen.findByRole('dialog', { name: 'Before you decide' })
    fireEvent.change(within(sheet).getByLabelText('Your name'), { target: { value: 'Tom Reyes' } })
    fireEvent.change(within(sheet).getByLabelText('Your email'), { target: { value: 'tom@spacex.com' } })
    fireEvent.click(within(sheet).getByRole('button', { name: "owner's rep" }))
    fireEvent.click(within(sheet).getByRole('button', { name: "That's me" }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(calls[0]?.body).toMatchObject({ action: 'identify', token: 'roomtoken', name: 'Tom Reyes', email: 'tom@spacex.com', role: 'owners_rep', viaToken: null, website: '' })
    expect(replace).toHaveBeenCalledWith(null, '', '/submittal?t=ptok')
    expect(screen.getByTestId('room-send').textContent).toMatch(/Reviewing as Tom Reyes · owner's rep/)
    // A second decision needs no sheet; a note goes with it; Send posts both with the personal token.
    fireEvent.click(within(screen.getByRole('group', { name: 'Your call on FV-1' })).getByRole('button', { name: 'Revise' }))
    expect(screen.queryByRole('dialog')).toBeNull()
    fireEvent.change(screen.getByLabelText('Note on FV-1'), { target: { value: 'hold 1.0 gpf' } })
    expect(screen.getByTestId('room-footer').textContent).toMatch(/2 to send/)
    fireEvent.click(screen.getByRole('button', { name: 'Send my review' }))
    await screen.findByRole('status')
    expect(calls[1]?.body).toEqual({ action: 'decide', token: 'ptok', submittalId: 'rev-2', decisions: [{ itemId: 'a', decision: 'approved' }, { itemId: 'b', decision: 'revise', note: 'hold 1.0 gpf' }] })
    expect(screen.getByRole('status').textContent).toBe('2 recorded as Tom Reyes. Thank you.')
    expect(screen.getAllByTestId('room-row')[0]!.textContent).toMatch(/Approved · Tom Reyes/)
    replace.mockRestore()
  })

  it('Just looking clears the tapped decision; Approve all marks every open differing row', async () => {
    mockRoomAndPosts()
    mount('/submittal?t=roomtoken')
    await screen.findByText('1 row needs a call')
    fireEvent.click(within(screen.getByRole('group', { name: 'Your call on DWH-1' })).getByRole('button', { name: 'Reject' }))
    fireEvent.click(within(await screen.findByRole('dialog', { name: 'Before you decide' })).getByRole('button', { name: 'Just looking' }))
    expect(screen.queryByTestId('room-pending')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Approve all 1 as marked' }))
    expect(await screen.findByRole('dialog', { name: 'Before you decide' })).toBeTruthy()
    expect(screen.getByTestId('room-pending').textContent).toMatch(/DWH-1 · Approve/)
  })

  it('a watching person cannot send; a stale revision answer shows the office\'s words', async () => {
    const f = vi.fn((url: string, _init?: RequestInit) => {
      if (String(url).includes('get-submittal-room')) return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(payload({ person: { id: 'p1', name: 'Logan Parsons', role: 'builder', mayDecide: false } })) } as Response)
      return Promise.resolve({ ok: false, status: 409, json: () => Promise.resolve({ error: 'A newer revision has been shared since you opened this page. Reload to see it.', code: 'stale_revision' }) } as Response)
    })
    vi.stubGlobal('fetch', f)
    mount('/submittal?t=logantoken')
    await screen.findByText('1 row needs a call')
    expect(screen.getByRole('button', { name: 'Watching only' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: /Approve all/ })).toBeNull()
  })
})
