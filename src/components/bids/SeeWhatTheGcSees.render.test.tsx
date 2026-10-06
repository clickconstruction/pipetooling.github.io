// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { SeeWhatTheGcSees } from './SeeWhatTheGcSees'
import type { RoomItemSource } from '../../../supabase/functions/_shared/submittalRoomPayload'

const item = (o: Partial<RoomItemSource> & Pick<RoomItemSource, 'id' | 'tag' | 'status'>): RoomItemSource => ({
  sequence_order: 1, specified_manufacturer: null, specified_model: null, specified_description: null, submitted_manufacturer: null, submitted_model: null, submitted_label: null,
  reason_kind: null, reason_note: null, lead_time_days: null, sheet_pages: null, review_decision: null, review_note: null, reviewed_by_name: null, reviewed_by_person_id: null, reviewed_at: null,
  ...o,
})
const items = [
  item({ id: 'a', tag: 'WC-1', status: 'as_specified', sequence_order: 1, specified_manufacturer: 'TOTO', specified_model: 'CT708UVG', submitted_label: 'TOTO CT708UVG#01' }),
  item({ id: 'b', tag: 'DWH-1', status: 'alternate', sequence_order: 2, specified_manufacturer: 'Rheem', specified_model: 'RH375', submitted_label: 'BW RE2HP50', reason_kind: 'lead_time' }),
]
const props = { items, revNumber: 1, link: { linkShowsRev: null, roomClosed: false }, hasPackage: false, company: { name: 'Click Plumbing', tagline: 'Plumbing', phone: '(512) 555-0100' }, bid: { label: 'B398', projectName: 'ZZ Test', address: '5501 Balcones Dr' }, onClose: () => {} }

describe('SeeWhatTheGcSees (v2.4189, #62 Layer 2)', () => {
  if (typeof window.matchMedia !== 'function') window.matchMedia = (() => ({ matches: false, addEventListener: () => {}, removeEventListener: () => {}, addListener: () => {}, removeListener: () => {} })) as unknown as typeof window.matchMedia

  it('a window at every width (2026-10-02): the reviewer’s header, headline and rows from the draft, read-only, and the why line; × closes it', () => {
    const onClose = vi.fn()
    render(<SeeWhatTheGcSees {...props} onClose={onClose} />)
    const dialog = screen.getByRole('dialog', { name: 'What the GC sees' })
    const pane = screen.getByTestId('see-gc-pane')
    expect(dialog.contains(pane)).toBe(true)
    expect(pane.textContent).toContain('CLICK PLUMBING')
    expect(pane.textContent).toContain('Product review')
    expect(pane.textContent).not.toContain('Product review · Rev')
    expect(pane.textContent).toContain('ZZ Test')
    expect(screen.getByTestId('room-headline').textContent).toContain('1 product needs your answer')
    expect(screen.getAllByTestId('room-row')).toHaveLength(1)
    expect(screen.getAllByTestId('room-row')[0]!.textContent).toContain('DWH-1')
    expect(screen.queryByRole('group', { name: /Your call on/ })).toBeNull()
    expect(screen.getByTestId('see-gc-why').textContent).toBe('This is the page the GC will open from your link. It is drawn from your rows as they stand. The GC sees nothing until you share.')
    fireEvent.click(screen.getByRole('button', { name: 'Close' }))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('Escape closes it; a shared revision says the link shows this now', () => {
    const onClose = vi.fn()
    render(<SeeWhatTheGcSees {...props} link={{ linkShowsRev: 1, roomClosed: false }} onClose={onClose} />)
    expect(screen.getByTestId('see-gc-why').textContent).toBe('This is the page the GC opens from your link. It is drawn from your rows as they stand. That is what the link shows now.')
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('v2.4593 · a draft over a shared revision says what the link shows until it is shared; a closed room says the link is closed', () => {
    const { unmount } = render(<SeeWhatTheGcSees {...props} revNumber={4} link={{ linkShowsRev: 2, roomClosed: false }} />)
    expect(screen.getByTestId('see-gc-why').textContent).toBe('This is the page the GC will open from your link. It is drawn from your rows as they stand. Until you share Rev 4, the link shows Rev 2.')
    unmount()
    render(<SeeWhatTheGcSees {...props} revNumber={2} link={{ linkShowsRev: 2, roomClosed: true }} />)
    expect(screen.getByTestId('see-gc-why').textContent).toContain('The room is closed. Its link says only that the review is closed. Reopen it to show this again.')
  })

  it('v2.4606 · the page’s own header and chips: the list the GC will see after the share, read only, and the revisions it skips', () => {
    const revisions = [
      { id: 'r4', rev_number: 4, shared_at: null },
      { id: 'r3', rev_number: 3, shared_at: null },
      { id: 'r2', rev_number: 2, shared_at: '2026-09-16T15:00:00Z' },
      { id: 'r1', rev_number: 1, shared_at: null },
    ]
    render(<SeeWhatTheGcSees {...props} revNumber={4} revisions={revisions} link={{ linkShowsRev: 2, roomClosed: false }} />)
    const chips = within(screen.getByTestId('room-revisions')).getAllByRole('button')
    expect(chips.map((c) => c.textContent)).toEqual(['Rev 4 · current', expect.stringMatching(/^Rev 2 · /)])
    expect(chips.every((c) => c.getAttribute('aria-disabled') === 'true')).toBe(true)
    expect(chips[0]!.getAttribute('aria-pressed')).toBe('true')
    expect(screen.getByTestId('see-gc-list-line').textContent).toBe('Older revisions stay under it as the record. Rev 3 and Rev 1 are not on their page, because they were never shared.')
  })

  it('v2.4608 · the door: their real page as it is now, flagged; only when the link shows something', () => {
    const token = 'c'.repeat(48)
    const { unmount } = render(<SeeWhatTheGcSees {...props} revNumber={4} roomToken={token} link={{ linkShowsRev: 2, roomClosed: false }} />)
    const door = screen.getByTestId('see-gc-door') as HTMLAnchorElement
    expect(door.textContent).toBe('Open their page as it is now · Rev 2 ↗')
    expect(door.getAttribute('href')).toBe(`${window.location.origin}/submittal?t=${token}&preview=1`)
    unmount()
    const closed = render(<SeeWhatTheGcSees {...props} revNumber={2} roomToken={token} link={{ linkShowsRev: 2, roomClosed: true }} />)
    expect(screen.getByTestId('see-gc-door').textContent).toBe('Open their page as it is now ↗')
    closed.unmount()
    const nothing = render(<SeeWhatTheGcSees {...props} roomToken={token} link={{ linkShowsRev: null, roomClosed: false }} />)
    expect(screen.queryByTestId('see-gc-door')).toBeNull()
    nothing.unmount()
    render(<SeeWhatTheGcSees {...props} link={{ linkShowsRev: 1, roomClosed: false }} />)
    expect(screen.queryByTestId('see-gc-door')).toBeNull()
  })
})

