// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
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
const props = { items, revNumber: 1, shared: false, hasPackage: false, company: { name: 'Click Plumbing', tagline: 'Plumbing', phone: '(512) 555-0100' }, bid: { label: 'B398', projectName: 'ZZ Test', address: '5501 Balcones Dr' }, onClose: () => {} }

describe('SeeWhatTheGcSees (v2.4189, #62 Layer 2)', () => {
  if (typeof window.matchMedia !== 'function') window.matchMedia = (() => ({ matches: false, addEventListener: () => {}, removeEventListener: () => {}, addListener: () => {}, removeListener: () => {} })) as unknown as typeof window.matchMedia

  it('a window at every width (2026-10-02): the reviewer’s header, headline and rows from the draft, read-only, and the why line; × closes it', () => {
    const onClose = vi.fn()
    render(<SeeWhatTheGcSees {...props} onClose={onClose} />)
    const dialog = screen.getByRole('dialog', { name: 'What the GC sees' })
    const pane = screen.getByTestId('see-gc-pane')
    expect(dialog.contains(pane)).toBe(true)
    expect(pane.textContent).toContain('CLICK PLUMBING')
    expect(pane.textContent).toContain('Product review · Rev 1')
    expect(pane.textContent).toContain('ZZ Test')
    expect(screen.getByTestId('room-headline').textContent).toContain('1 row needs a call')
    expect(screen.getAllByTestId('room-row')).toHaveLength(1)
    expect(screen.getAllByTestId('room-row')[0]!.textContent).toContain('DWH-1')
    expect(screen.queryByRole('group', { name: /Your call on/ })).toBeNull()
    expect(screen.getByTestId('see-gc-why').textContent).toContain('The GC sees nothing until you share.')
    fireEvent.click(screen.getByRole('button', { name: 'Close' }))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('Escape closes it; a shared revision says the link shows this now', () => {
    const onClose = vi.fn()
    render(<SeeWhatTheGcSees {...props} shared onClose={onClose} />)
    expect(screen.getByTestId('see-gc-why').textContent).toContain('This is what the link shows now.')
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})
