// @vitest-environment jsdom
/**
 * Render smokes for the review room (Submittals stage 4a): the customer's words on the
 * page (the differing rows first, the matching rows folded), the revision strip, the
 * PDF door through open-submittal-pdf, the identify stub behind a decision, the closed
 * state, and the dead link. The fetch is mocked; the page's own tokens ride the URL.
 */
import { describe, expect, it, vi, afterEach } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'
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

afterEach(() => vi.unstubAllGlobals())

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

  it('a decision opens the identify stub; a personal link names its person', async () => {
    mockFetch(200, payload({ person: { id: 'p1', name: 'Dana Whitfield', role: 'architect', mayDecide: false } }))
    mount('/submittal?t=persontoken')
    await screen.findByText('1 row needs a call')
    expect(screen.getByText(/This link was made for/).textContent).toMatch(/Dana Whitfield · architect · watching/)
    fireEvent.click(within(screen.getByRole('group', { name: 'Your call on DWH-1' })).getByRole('button', { name: 'Approve' }))
    expect(await screen.findByRole('dialog', { name: 'Before you decide' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Just looking' }))
    expect(screen.queryByRole('dialog')).toBeNull()
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
