// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { RoomRevisionBody, RoomRowCard } from './SubmittalRoomView'
import { roomCounts, roomRowFrom, type RoomRevision, type RoomRow } from '../../../supabase/functions/_shared/submittalRoomPayload'

const row = (o: Partial<RoomRow> & Pick<RoomRow, 'id' | 'tag' | 'kind'>): RoomRow => ({
  plans: '', proposed: '', why: '', performanceChange: false, sheetPages: 0, decision: null, ...o,
})
const rows: RoomRow[] = [
  row({ id: 'a', tag: 'DWH-1', kind: 'differs', plans: 'Rheem RH375', proposed: 'Bradford White RE2HP50', why: 'the lead time is long' }),
  row({ id: 'b', tag: 'WC-1', kind: 'matches', plans: 'TOTO CT708UVG', proposed: 'TOTO CT708UVG#01' }),
  row({ id: 'c', tag: 'L-1', kind: 'matches', plans: 'Kohler K-2005', proposed: 'Kohler K-2005' }),
]
const rev: RoomRevision = { id: 'rev-1', rev: 1, sharedAt: null, current: true, hasPackage: false, rows, counts: roomCounts(rows) }

describe('RoomRevisionBody (v2.4187, #62 Layer 2 PR 1)', () => {
  it('draws the headline, the differing rows, and the matches behind a fold — with the call group when it may decide', () => {
    const onDecide = vi.fn()
    render(<RoomRevisionBody rev={rev} onDecide={onDecide} afterSubline={<b>Just looking? Fine.</b>} />)
    expect(screen.getByTestId('room-headline').textContent).toContain('1 product needs your answer')
    expect(screen.getByTestId('room-headline').textContent).toContain('2 products match the plans and are marked approved. 1 differs — each says why. Just looking? Fine.')
    expect(screen.getAllByTestId('room-row')).toHaveLength(1)
    fireEvent.click(screen.getByRole('button', { name: /Show the 2 rows as the plans specify/ }))
    expect(screen.getAllByTestId('room-row')).toHaveLength(3)
    fireEvent.click(screen.getByRole('button', { name: 'Revise' }))
    expect(onDecide).toHaveBeenCalledWith('a', 'revise')
  })

  it('read-only draws the same rows with no call group and no invitation', () => {
    render(<RoomRevisionBody rev={rev} readOnly />)
    expect(screen.getByTestId('room-headline').textContent).not.toContain('Just looking')
    expect(screen.queryByRole('group', { name: /Your call on/ })).toBeNull()
    expect(screen.getAllByTestId('room-row')[0]!.textContent).toContain('Why: the lead time is long')
  })

  it('a row card shows a decision already made, dated', () => {
    render(<RoomRowCard row={row({ id: 'd', tag: 'FD-1', kind: 'differs', decision: { kind: 'approved', note: 'fine', byName: 'Dana Whitfield', byPersonId: 'p1', at: '2026-09-17T15:00:00Z' } })} readOnly />)
    expect(screen.getByTestId('room-row').textContent).toMatch(/Approved · Dana Whitfield · Sep 17 · “fine”/)
  })
})

describe('RoomRowCard · the GC calls each part (2026-10-01)', () => {
  const part = (id: string, head: string, words: string, decision: RoomRow['decision'] = null, carried = false) => ({ id, label: `${head} ${words}`.trim(), head, words, quantity: 1, decision, ...(carried ? { carried: true } : {}) })
  const wc = row({
    id: 'wc', tag: 'WC-1, WC-2', kind: 'proposed', proposed: 'x',
    parts: [
      part('bowl', 'TOTO CT728CUVG#01', 'TORNADO FLUSH WALL MOUNTED TOILET', { kind: 'approved', note: null, byName: 'Dana Whitfield', byPersonId: 'p1', at: '2026-10-01T15:00:00Z' }, true),
      part('valve', 'TOTO TET2LBI31#SS', '1.28 GPF FLUSHOMETER VALVE'),
      part('seat', 'TOTO SC534#01', 'COMMERCIAL TOILET SEAT'),
    ],
  })

  it('2026-10-03 · a proposed row asks in the GC’s words: for your review, the fixture’s name with no "The plans:", We intend to install', () => {
    const { unmount } = render(<RoomRowCard row={{ ...wc, plans: 'WC 1&2' }} readOnly />)
    const card = screen.getByTestId('room-row')
    expect(card.textContent).toContain('for your review')
    expect(screen.getByTestId('room-row-plans').textContent).toBe('WC 1&2')
    expect(card.textContent).toContain('We intend to install:')
    expect(card.textContent).not.toMatch(/The plans:|Proposed:/)
    unmount()
    // A row that differs from the schedule still names the plans' product.
    render(<RoomRowCard row={row({ id: 'a', tag: 'DWH-1', kind: 'differs', plans: 'Rheem RH375', proposed: 'Bradford White RE2HP50', why: 'the lead time is long' })} readOnly />)
    expect(screen.getByTestId('room-row-plans').textContent).toBe('The plans: Rheem RH375')
    expect(screen.getByTestId('room-row').textContent).toContain('Proposed: Bradford White RE2HP50')
  })

  it('each part has its own call; a part approved on the last revision says so and asks nothing; Approve all takes the open ones', () => {
    const onDecide = vi.fn()
    render(<RoomRowCard row={wc} onDecide={onDecide} />)
    expect(screen.getAllByTestId('room-part')).toHaveLength(3)
    expect(screen.getByTestId('room-parts-summary').textContent).toBe('3 parts · 1 approved · 2 to answer')
    expect(screen.getByTestId('room-part-call').textContent).toMatch(/Approved on the last revision · Dana Whitfield · Oct 1/)
    expect(screen.queryByRole('group', { name: 'Your call on TOTO CT728CUVG#01' })).toBeNull()
    fireEvent.click(screen.getByRole('group', { name: 'Your call on TOTO TET2LBI31#SS' }).querySelector('button[aria-pressed="false"]:nth-child(2)')!)
    expect(onDecide).toHaveBeenLastCalledWith('revise', 'valve')
    fireEvent.click(screen.getByTestId('room-approve-parts'))
    expect(onDecide.mock.calls.slice(1)).toEqual([['approved', 'valve'], ['approved', 'seat']])
    expect(screen.queryByRole('group', { name: 'Your call on WC-1, WC-2' })).toBeNull()
  })

  it('the calls not sent yet count in the summary and light their buttons; read only draws no buttons', () => {
    const { unmount } = render(<RoomRowCard row={wc} onDecide={() => {}} localParts={{ valve: 'revise' }} />)
    expect(screen.getByTestId('room-parts-summary').textContent).toBe('3 parts · 1 approved · 1 revise · 1 to answer')
    expect(screen.getByRole('group', { name: 'Your call on TOTO TET2LBI31#SS' }).querySelector('[aria-pressed="true"]')!.textContent).toBe('Revise')
    expect(screen.queryByTestId('room-approve-parts')).toBeNull()
    unmount()
    render(<RoomRowCard row={wc} readOnly />)
    expect(screen.queryByRole('group', { name: /Your call on/ })).toBeNull()
  })
})

describe('RoomRowCard · a design change says whose call it is (decision 11, the owner’s call of 2026-10-09)', () => {
  const stored = { id: 'dc', tag: 'WH-1', sequence_order: 1, specified_manufacturer: 'Rheem', specified_model: 'RH375', specified_description: '75 gal', submitted_manufacturer: 'Rheem', submitted_model: 'RH350', submitted_label: null, status: 'design_change', reason_kind: 'lead_time', reason_note: null, lead_time_days: null, sheet_pages: [], review_decision: null, review_note: null, reviewed_by_name: null, reviewed_by_person_id: null, reviewed_at: null }
  it('prints the call and the sign-off under the performance line', () => {
    render(<RoomRowCard row={roomRowFrom({ ...stored, call_by: 'engineer', signoff_name: 'Pat Lee', signoff_on: '2026-10-09', signoff_via: 'email' })} readOnly />)
    expect(screen.getByTestId('room-row').textContent).toContain('This changes a performance value on the plans.')
    expect(screen.getByTestId('room-design-call').textContent).toBe("The engineer's call · signed off by Pat Lee on Oct 9, 2026, by email.")
  })
  it('a design change with nothing recorded prints no line', () => {
    render(<RoomRowCard row={roomRowFrom(stored)} readOnly />)
    expect(screen.queryByTestId('room-design-call')).toBeNull()
  })
})
