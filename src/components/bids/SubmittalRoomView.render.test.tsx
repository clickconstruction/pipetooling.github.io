// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { RoomRevisionBody, RoomRowCard } from './SubmittalRoomView'
import { roomCounts, type RoomRevision, type RoomRow } from '../../../supabase/functions/_shared/submittalRoomPayload'

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
    expect(screen.getByTestId('room-headline').textContent).toContain('1 row needs a call')
    expect(screen.getByTestId('room-headline').textContent).toContain('2 rows match the plans and are marked approved. 1 differs — each says why. Just looking? Fine.')
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

  it('each part has its own call; a part approved on the last revision says so and asks nothing; Approve all takes the open ones', () => {
    const onDecide = vi.fn()
    render(<RoomRowCard row={wc} onDecide={onDecide} />)
    expect(screen.getAllByTestId('room-part')).toHaveLength(3)
    expect(screen.getByTestId('room-parts-summary').textContent).toBe('3 parts · 1 approved · 2 to go')
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
    expect(screen.getByTestId('room-parts-summary').textContent).toBe('3 parts · 1 approved · 1 revise · 1 to go')
    expect(screen.getByRole('group', { name: 'Your call on TOTO TET2LBI31#SS' }).querySelector('[aria-pressed="true"]')!.textContent).toBe('Revise')
    expect(screen.queryByTestId('room-approve-parts')).toBeNull()
    unmount()
    render(<RoomRowCard row={wc} readOnly />)
    expect(screen.queryByRole('group', { name: /Your call on/ })).toBeNull()
  })
})
