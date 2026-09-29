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
