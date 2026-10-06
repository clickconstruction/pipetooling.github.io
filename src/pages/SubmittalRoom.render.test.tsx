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
import { sampleSubmittalRoomResponse } from '../../supabase/functions/_shared/customerSampleFixtures'
import { PORTAL_COMPANY } from '../../supabase/functions/_shared/portalCompany'
import { answeredByEmailAt, onRecord, revisionStandings } from '../../supabase/functions/_shared/submittalRecord'
import { roomCounts, type RoomRow } from '../../supabase/functions/_shared/submittalRoomPayload'

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
    expect(await screen.findByText('1 product needs your answer')).toBeTruthy()
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

  it('2026-10-02 · the procurement card after a resubmit from the rows sent back: the row approved on Rev 1 stands on it, ordered; the row asked again on Rev 2 waits', async () => {
    const procurement = {
      records: [{ tag: 'WC-1', label: '', leadTimeDays: null, stage: null, orderedOn: '2026-09-23', expectedOn: null, deliveredOn: null, note: '', sortOrder: 0 }],
      countRows: [],
      splits: [],
      stageDates: {},
      lastUpdateAt: null,
    }
    const approved = { kind: 'approved', note: null, byName: 'Dana W.', byPersonId: 'p1', at: '2026-09-20T16:00:00Z' }
    const rejected = { kind: 'rejected', note: 'hold the 199', byName: 'Dana W.', byPersonId: 'p1', at: '2026-09-20T16:00:00Z' }
    mockFetch(200, payload({
      revisions: [
        { id: 'rev-2', rev: 2, sharedAt: '2026-09-22T15:00:00Z', current: true, hasPackage: true, rows: [row({ id: 'b', tag: 'DWH-1', kind: 'differs', proposed: 'A.O. Smith BTH-199', why: 'x' })], counts: { total: 1, matches: 0, differs: 1, notQuoted: 0, added: 0, decided: 0, open: 1 } },
        { id: 'rev-1', rev: 1, sharedAt: '2026-09-16T15:00:00Z', current: false, hasPackage: true, rows: [row({ id: 'a', tag: 'WC-1', kind: 'matches', decision: approved, leadTimeDays: 0 }), row({ id: 'z', tag: 'DWH-1', kind: 'differs', proposed: 'A.O. Smith BTH-120', why: 'x', decision: rejected })], counts: { total: 2, matches: 1, differs: 1, notQuoted: 0, added: 0, decided: 2, open: 0 } },
      ],
      procurement,
    }))
    mount('/submittal?t=roomtoken')
    const cardEl = await screen.findByTestId('room-procurement')
    const lines = screen.getAllByTestId('room-procurement-row').map((r) => r.textContent ?? '')
    expect(lines).toHaveLength(1)
    expect(lines[0]).toContain('WC-1')
    expect(lines[0]).toContain('Ordered 09/23')
    // DWH-1 is Rev 2's to call: Rev 1's rejection says nothing on the card, and a row waiting on the GC is not listed.
    expect(cardEl.textContent).not.toContain('DWH-1')
  })

  describe('2026-10-06 · a revision answered by email lands in the room as the record (BP398)', () => {
    const approved = { kind: 'approved', note: null, byName: 'Dana W.', byPersonId: 'p1', at: '2026-10-02T17:00:00Z' }
    const rowsOf: Record<string, Array<Record<string, unknown>>> = {
      // Rev 2, shared Sep 16: WC-1 came back sent back.
      r2: [row({ id: 'w2', tag: 'WC-1', kind: 'differs', proposed: 'TOTO TET1LA32', why: 'x', decision: { kind: 'revise', note: 'use the CT728', byName: 'Dana W.', byPersonId: 'p1', at: '2026-09-17T15:00:00Z' } })],
      // Rev 3, answered by email Oct 2 and typed in, never shared: WC-1 approved, and the kitchen sinks and toilets.
      r3: [
        row({ id: 'w3', tag: 'WC-1', kind: 'matches', proposed: 'TOTO CT728CUVG', decision: approved, leadTimeDays: 0 }),
        row({ id: 'k3', tag: 'KS-1', kind: 'matches', plans: 'Elkay LRAD2522', proposed: 'Elkay LRAD2522', decision: approved, leadTimeDays: 0 }),
        row({ id: 't3', tag: 'WC-2', kind: 'matches', plans: 'TOTO CST454', proposed: 'TOTO CST454', decision: approved, leadTimeDays: 0 }),
      ],
      r4: [row({ id: 'd4', tag: 'DWH-1', kind: 'differs', proposed: 'Bradford White RE2HP50', why: 'x' })],
    }
    const procurement = {
      records: [
        { tag: 'WC-1', label: '', leadTimeDays: null, stage: null, orderedOn: '2026-09-29', expectedOn: null, deliveredOn: null, note: '', sortOrder: 0 },
        { tag: 'KS-1', label: '', leadTimeDays: null, stage: null, orderedOn: '2026-10-01', expectedOn: null, deliveredOn: null, note: '', sortOrder: 1 },
        { tag: 'WC-2', label: '', leadTimeDays: null, stage: null, orderedOn: '2026-09-30', expectedOn: null, deliveredOn: null, note: '', sortOrder: 2 },
      ],
      countRows: [],
      splits: [],
      stageDates: {},
      lastUpdateAt: null,
    }
    /** The revisions get-submittal-room serves, by the one rule in `_shared/submittalRecord.ts`. */
    const served = (rev4Shared: boolean) =>
      onRecord(
        revisionStandings(
          [
            { id: 'r4', rev_number: 4, shared_at: rev4Shared ? '2026-10-06T15:00:00Z' : null, package_path: rev4Shared ? 'p4.pdf' : null },
            { id: 'r3', rev_number: 3, shared_at: null, package_path: 'p3.pdf' },
            { id: 'r2', rev_number: 2, shared_at: '2026-09-16T15:00:00Z', package_path: 'p2.pdf' },
          ],
          new Map([['r3', [{ decision_source: 'entered', review_decision: 'approved', reviewed_at: '2026-10-02T17:00:00Z' }]]]),
        ),
      ).map((r, i) => {
        const rows = rowsOf[r.id] ?? []
        return { id: r.id, rev: r.rev_number, sharedAt: r.shared_at, answeredByEmailAt: answeredByEmailAt(r), current: i === 0, hasPackage: !!r.package_path, rows, counts: roomCounts(rows as unknown as RoomRow[]) }
      })
    const cardLines = () => screen.getAllByTestId('room-procurement-row').map((r) => r.textContent ?? '')

    it('before Rev 4 is shared: Rev 3 is current, answered by email, its line says so, and the card keeps every tag with WC-1 released', async () => {
      mockFetch(200, payload({ revisions: served(false), procurement }))
      mount('/submittal?t=roomtoken')
      expect((await screen.findByTestId('room-revisions')).textContent).toMatch(/Rev 3 · current · answered by email · Oct 2.*Rev 2 · Sep 16/)
      expect(screen.getByTestId('room-emailed-line').textContent).toBe('You answered this revision by email. Our office typed your answers in here, as the record.')
      const lines = cardLines()
      expect(lines.map((l) => l.match(/^[A-Z]+-\d/)?.[0])).toEqual(['KS-1', 'WC-1', 'WC-2'])
      expect(screen.getByTestId('room-procurement').textContent).not.toMatch(/Sent back/)
    })

    it('after Rev 4 is shared: Rev 4 current, Rev 3 under it as the record, and the card still keeps Kitchen sinks and Toilets', async () => {
      mockFetch(200, payload({ revisions: served(true), procurement }))
      mount('/submittal?t=roomtoken')
      expect((await screen.findByTestId('room-revisions')).textContent).toMatch(/Rev 4 · current · Oct 6.*Rev 3 · answered by email · Oct 2.*Rev 2 · Sep 16/)
      expect(screen.queryByTestId('room-emailed-line')).toBeNull()
      const lines = cardLines()
      expect(lines.find((l) => l.startsWith('KS-1'))).toContain('Ordered 10/01')
      expect(lines.find((l) => l.startsWith('WC-2'))).toContain('Ordered 09/30')
      expect(lines.find((l) => l.startsWith('WC-1'))).toContain('Ordered 09/29')
      fireEvent.click(screen.getByRole('button', { name: 'Rev 3 · answered by email · Oct 2' }))
      expect(screen.getByTestId('room-emailed-line')).toBeTruthy()
      // The answers read as the reviewer gave them, with no staff name.
      fireEvent.click(screen.getByRole('button', { name: /Show the 3 rows as the plans specify/ }))
      expect(document.body.textContent).toMatch(/Approved · Dana W\./)
    })
  })

  it('the procurement card (v2.4087): released, ordered and delivered tags with when they land against the schedule — status and dates, never a PO or a house', async () => {
    const procurement = {
      records: [
        { tag: 'DWH-1', label: '', leadTimeDays: null, stage: null, orderedOn: '2026-09-24', expectedOn: null, deliveredOn: null, note: '', sortOrder: 0 },
        { tag: 'WC-1', label: '', leadTimeDays: null, stage: null, orderedOn: '2026-09-20', expectedOn: null, deliveredOn: '2026-09-26', note: '', sortOrder: 1 },
        { tag: null, label: 'Grease interceptor', leadTimeDays: 56, stage: 'rough_in', orderedOn: '2026-09-18', expectedOn: null, deliveredOn: null, note: '', sortOrder: 2 },
      ],
      countRows: [{ id: 'c1', fixture: 'DWH-1 - WATER HEATER' }, { id: 'c2', fixture: 'WC-1 - WATER CLOSET' }],
      splits: [{ countRowId: 'c1', lineId: null, partId: null, roughIn: 0, topOut: 0, trimSet: 1, source: 'hand' }, { countRowId: 'c2', lineId: null, partId: null, roughIn: 0, topOut: 0, trimSet: 1, source: 'rule' }],
      stageDates: { rough_in: '2026-10-06', trim_set: '2026-11-17' },
      lastUpdateAt: '2026-09-28T18:00:00Z',
    }
    const rows = [
      row({ id: 'a', tag: 'DWH-1', kind: 'differs', proposed: 'Bradford White RE2HP50', why: 'x', decision: { kind: 'approved', note: null, byName: 'Dana W.', byPersonId: 'p1', at: '2026-09-22T16:00:00Z' }, leadTimeDays: 42 }),
      row({ id: 'd', tag: 'WC-1', kind: 'matches', decision: { kind: 'approved', note: null, byName: 'Dana W.', byPersonId: 'p1', at: '2026-09-22T16:00:00Z' }, leadTimeDays: 0 }),
      row({ id: 'e', tag: 'KS-1', kind: 'matches' }),
    ]
    mockFetch(200, payload({ revisions: [{ id: 'rev-2', rev: 2, sharedAt: '2026-09-16T15:00:00Z', current: true, hasPackage: true, rows, counts: { total: 3, matches: 2, differs: 1, notQuoted: 0, added: 0, decided: 2, open: 0 } }], procurement }))
    mount('/submittal?t=roomtoken')
    const cardEl = await screen.findByTestId('room-procurement')
    expect(cardEl.textContent).toContain('Updated 09/28 by Click Plumbing')
    expect(cardEl.textContent).toContain('2 released · 3 ordered · 1 delivered · 1 behind schedule')
    const lines = screen.getAllByTestId('room-procurement-row').map((r) => r.textContent)
    // DWH-1: ordered 09/24 + 6 wk → 11/05 against Trim Set 11/17 → on time. WC-1 delivered → on site. The interceptor: 8 wk from 09/18 → 11/13 against Rough In 10/06 → late.
    expect(lines[0]).toContain('DWH-1')
    expect(lines[0]).toContain('Ordered 09/24')
    expect(lines[0]).toContain('11/05')
    expect(lines[0]).toContain('11/17')
    expect(lines[0]).toContain('on time')
    expect(lines[1]).toContain('Delivered 09/26')
    expect(lines[1]).toContain('on site')
    expect(lines[2]).toContain('Grease interceptor')
    expect(lines[2]).toContain('38 d late')
    // KS-1 is awaiting review: not on the card. No PO, no house, anywhere.
    expect(cardEl.textContent).not.toContain('KS-1')
    expect(cardEl.textContent).not.toMatch(/PO|Ferguson/)
  })

  it('a personal link names its person; a watching person can tap but not send', async () => {
    mockFetch(200, payload({ person: { id: 'p1', name: 'Dana Whitfield', role: 'architect', mayDecide: false } }))
    mount('/submittal?t=persontoken')
    await screen.findByText('1 product needs your answer')
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
    await screen.findByText('1 product needs your answer')
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
    await screen.findByText('1 product needs your answer')
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
      return Promise.resolve({ ok: false, status: 409, json: () => Promise.resolve({ error: 'A newer revision has been added since you opened this page. Reload to see it.', code: 'stale_revision' }) } as Response)
    })
    vi.stubGlobal('fetch', f)
    mount('/submittal?t=logantoken')
    await screen.findByText('1 product needs your answer')
    expect(screen.getByRole('button', { name: 'Watching only' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: /Approve all/ })).toBeNull()
  })

  describe('stage 5a — the thread', () => {
    const withThread = (o: Record<string, unknown> = {}) =>
      payload({
        person: { id: 'p1', name: 'Dana Whitfield', role: 'architect', mayDecide: true, messagesThisHour: 0 },
        messages: [
          { id: 'm1', at: '2026-09-16T19:00:00Z', authorKind: 'system', authorName: 'Dana Whitfield', body: 'Dana Whitfield decided 3 rows · 2 revise · 1 reject', kind: 'decision', revNumber: 2, tags: [] },
          { id: 'm2', at: '2026-09-16T20:10:00Z', authorKind: 'reviewer', authorName: 'Dana Whitfield', body: 'Is the 50 gal ok?', kind: 'message', revNumber: 2, tags: ['DWH-1'] },
          { id: 'm3', at: '2026-09-17T14:00:00Z', authorKind: 'office', authorName: 'Click Plumbing', body: 'Yes — same footprint.', kind: 'reply', revNumber: 2, tags: ['DWH-1'] },
        ],
        ...o,
      })

    it('draws the thread oldest first with the office as the company, and an identified person asks straight away', async () => {
      const f = mockFetch(200, withThread())
      f.mockImplementation((url: string, init?: RequestInit) => {
        if (String(url).includes('submit-submittal-review')) {
          const body = JSON.parse(String(init?.body))
          expect(body).toMatchObject({ action: 'message', token: 'tok-personal', body: 'Which finish?', tags: ['FV-1'] })
          return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({ ok: true, message: { id: 'm4', at: '2026-09-17T15:00:00Z', authorKind: 'reviewer', authorName: 'Dana Whitfield', body: 'Which finish?', kind: 'message', revNumber: 2, tags: ['FV-1'] } }) } as Response)
        }
        return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(withThread()) } as Response)
      })
      mount('/submittal?t=tok-personal')
      const thread = await screen.findByTestId('room-thread')
      const entries = Array.from(thread.querySelectorAll('[data-thread-kind]'))
      expect(entries.map((e) => e.getAttribute('data-thread-kind'))).toEqual(['decision', 'message', 'reply'])
      expect(within(thread).getByText('Click Plumbing')).toBeTruthy()
      fireEvent.click(within(thread).getByRole('button', { name: 'FV-1' }))
      fireEvent.change(within(thread).getByLabelText('Ask about a product or say what you need'), { target: { value: 'Which finish?' } })
      fireEvent.click(within(thread).getByRole('button', { name: 'Ask' }))
      await waitFor(() => expect(within(thread).getByText('Which finish?')).toBeTruthy())
      expect(within(thread).getByRole('status').textContent).toMatch(/Sent/)
    })

    it('an unidentified visitor is asked who they are first, with the sheet reworded for an ask', async () => {
      mockFetch(200, withThread({ person: null }))
      mount('/submittal?t=tok-room')
      const thread = await screen.findByTestId('room-thread')
      fireEvent.change(within(thread).getByLabelText('Ask about a product or say what you need'), { target: { value: 'Hello?' } })
      fireEvent.click(within(thread).getByRole('button', { name: 'Ask' }))
      expect(await screen.findByRole('dialog', { name: 'Before you ask' })).toBeTruthy()
    })

    it('the cap reads in plain words', async () => {
      const f = mockFetch(200, withThread())
      f.mockImplementation((url: string) =>
        String(url).includes('submit-submittal-review')
          ? Promise.resolve({ ok: false, status: 429, json: () => Promise.resolve({ error: 'x', code: 'rate_limited' }) } as Response)
          : Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(withThread()) } as Response),
      )
      mount('/submittal?t=tok-personal')
      const thread = await screen.findByTestId('room-thread')
      fireEvent.change(within(thread).getByLabelText('Ask about a product or say what you need'), { target: { value: 'One more' } })
      fireEvent.click(within(thread).getByRole('button', { name: 'Ask' }))
      expect((await within(thread).findByRole('alert')).textContent).toMatch(/Five an hour/)
    })
  })
})

describe('SubmittalRoom · a call on each part (2026-10-01)', () => {
  it('a row with parts takes a call per part; the note names the part; Send posts each part with its row', async () => {
    const parts = [
      { id: 'bowl', label: 'TOTO CT728CUVG#01 TOILET', head: 'TOTO CT728CUVG#01', words: 'TOILET', quantity: 1, decision: null },
      { id: 'valve', label: 'TOTO TET2LBI31#SS 1.28 GPF', head: 'TOTO TET2LBI31#SS', words: '1.28 GPF', quantity: 1, decision: null },
    ]
    const rows = [row({ id: 'wc', tag: 'WC-1', kind: 'proposed', proposed: 'TOTO CT728CUVG#01 TOILET + TOTO TET2LBI31#SS 1.28 GPF', parts })]
    const calls: Array<{ body: unknown }> = []
    vi.stubGlobal('fetch', vi.fn((url: string, init?: RequestInit) => {
      if (String(url).includes('get-submittal-room')) return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(payload({ person: { id: 'p1', name: 'Dana Whitfield', role: 'architect', mayDecide: true }, revisions: [{ id: 'rev-3', rev: 3, sharedAt: '2026-10-08T15:00:00Z', current: true, hasPackage: true, rows, counts: { total: 1, matches: 0, differs: 0, notQuoted: 0, added: 0, proposed: 1, decided: 0, open: 1 } }] })) } as Response)
      calls.push({ body: JSON.parse(String(init?.body ?? '{}')) })
      return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({ ok: true, decided: 2 }) } as Response)
    }))
    mount('/submittal?t=ptok')
    await screen.findByText('1 product needs your answer')
    fireEvent.click(within(screen.getByRole('group', { name: 'Your call on TOTO TET2LBI31#SS' })).getByRole('button', { name: 'Revise' }))
    fireEvent.change(screen.getByLabelText('Note on WC-1 · TOTO TET2LBI31#SS'), { target: { value: 'plans call 1.0 gpf' } })
    fireEvent.click(within(screen.getByRole('group', { name: 'Your call on TOTO CT728CUVG#01' })).getByRole('button', { name: 'Approve' }))
    fireEvent.click(screen.getByRole('button', { name: 'Send my review' }))
    await screen.findByRole('status')
    expect(calls[0]?.body).toEqual({ action: 'decide', token: 'ptok', submittalId: 'rev-3', decisions: [{ itemId: 'wc', partId: 'valve', decision: 'revise', note: 'plans call 1.0 gpf' }, { itemId: 'wc', partId: 'bowl', decision: 'approved' }] })
    // The page reads the row the way the office will: a part sent back sends the row back.
    expect(screen.getByTestId('room-row').textContent).toMatch(/2 parts · 1 approved · 1 revise/)
    expect(screen.getByTestId('room-footer').textContent).toMatch(/1 decided · 0 to answer/)
  })
})

describe('SubmittalRoom · the What customers see sample (v2.4595, #62)', () => {
  it('the sample room draws through the page like a real one: the parts the GC sees, the proposed card, the to-follow row; the order-only row and part never show', async () => {
    mockFetch(200, sampleSubmittalRoomResponse('live', PORTAL_COMPANY, '2026-10-05'))
    mount('/submittal?t=sample')
    await screen.findByText('3 products need your answer')
    const cards = screen.getAllByTestId('room-row')
    const wc = cards.find((c) => c.textContent?.includes('WC-1'))!
    expect(within(wc).getAllByTestId('room-part').map((p) => p.textContent ?? '')).toEqual([expect.stringContaining('TOTO CT728CUVG#01'), expect.stringContaining('TOTO SS114#01'), expect.stringContaining('ZURN Z1203-N')])
    expect(cards.find((c) => c.textContent?.includes('SH-1'))!.textContent).toContain('for your review')
    expect(cards.find((c) => c.textContent?.includes('MB-1'))!.textContent).toContain('No product yet — to follow.')
    expect(document.body.textContent).not.toContain('HB-1')
    expect(document.body.textContent).not.toContain('KTCR19X')
  })
})

