// @vitest-environment jsdom
/**
 * Render smoke for the rows of one revision, moved out of `BidsSubmittalsTab.tsx` (2026-10-04):
 * the seam pinned. It draws what it is handed and reports each button; nothing is written here.
 */
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { SubmittalRowsTable, type SubmittalRowsTableProps } from './SubmittalRowsTable'
import type { SubmittalPartRow } from '../../lib/submittals/itemParts'
import type { SubmittalItemRow } from '../../lib/submittals/submittalRevision'

const row = (o: Partial<SubmittalItemRow> & { id: string; tag: string }): SubmittalItemRow => ({
  submittal_id: 's1', source_count_row_id: null, sequence_order: 1, specified_manufacturer: null, specified_model: null, specified_description: null,
  submitted_manufacturer: null, submitted_model: null, submitted_label: null, supply_house_id: null, source_quote_line_id: null, status: 'proposed',
  reason_kind: null, reason_note: null, lead_time_days: null, sheet_file: null, sheet_pages: [], sheet_source: null, carried_from_item_id: null,
  decision_source: 'room', decision_entered_by: null, decision_entered_by_name: null, order_only: false, review_decision: null, review_note: null, reviewed_by_name: null,
  reviewed_by_person_id: null, reviewed_by_email: null, reviewed_at: null, created_at: '', updated_at: '', ...o,
} as SubmittalItemRow)
const part = (id: string, item: string, label: string, seq: number, review_decision: string | null = null): SubmittalPartRow => ({ id, item_id: item, bid_id: 'b', sequence_order: seq, label, manufacturer: null, model: null, description: null, quantity: 1, on_submittal: true, source: 'takeoff', part_id: null, source_line_id: null, source_template_item_id: null, assembly: null, priced_label: null, reason_note: null, supply_house_id: null, lead_time_days: null, stage: null, sheet_file: null, sheet_pages: [], procure_key: `k-${id}`, carried_from_part_id: null, review_decision, review_note: null, reviewed_at: null, reviewed_by_name: null, reviewed_by_email: null, reviewed_by_person_id: null, decision_source: 'room', decision_entered_by: null, decision_entered_by_name: null, created_at: '', updated_at: '' } as unknown as SubmittalPartRow)

// BP375's shape: a fixture with a cut sheet, a hand row with none, one with a part rejected, and an order-only fixture.
const dwh = row({ id: 'dwh', tag: 'DWH-1', submitted_label: 'RHEEM PROPH40', sheet_file: 0, sheet_pages: [6, 7], lead_time_days: 14 })
const fco = row({ id: 'fco', tag: 'FCO', sequence_order: 2, submitted_label: 'ZURN ZN1400-2NL' })
const lav = row({ id: 'lav', tag: 'LAV-1, LAV-2', sequence_order: 3, submitted_label: 'A + B', source_count_row_id: 'c-lav', review_decision: 'rejected', reviewed_by_name: 'structura', decision_source: 'entered', decision_entered_by_name: 'Wendi', reviewed_at: '2026-10-02T15:00:00Z' })
const stops = row({ id: 'stops', tag: 'STOPS', sequence_order: 4, submitted_label: 'BRASSCRAFT', order_only: true })
const lavParts = [part('sink', 'lav', 'TSL.MON.B.38', 1), part('faucet', 'lav', 'TOTO T25S51E#CP', 2, 'rejected')]

function mount(over: Partial<SubmittalRowsTableProps> = {}) {
  const on = { onEdit: vi.fn(), onAnswer: vi.fn(), onSplit: vi.fn(), onFold: vi.fn(), onTakeOff: vi.fn(), onPutBack: vi.fn(), onLeaveOut: vi.fn() }
  render(
    <SubmittalRowsTable
      items={[dwh, fco, lav, stops]}
      gcItems={[dwh, fco, lav]}
      orderOnlyItems={[stops]}
      parts={lavParts}
      partsOf={new Map([['lav', lavParts]])}
      houseNameById={new Map()}
      sourceFiles={[{ path: 'b/s1/0.pdf', name: 'NWS.pdf', pages: 12, houseId: null, houseName: null, trimmedAt: null } as never]}
      previousRev={null}
      prevById={new Map()}
      decisions={{ decided: 1 }}
      isDraft
      busy={false}
      foldHints={[{ fromId: 'fco', intoId: 'dwh' }]}
      {...on}
      {...over}
    />,
  )
  return on
}

describe('SubmittalRowsTable', () => {
  it('draws a row per fixture the GC sees, with its cut sheet, lead time and their answer counted by part', () => {
    mount()
    const rows = screen.getAllByTestId('submittal-row')
    expect(rows).toHaveLength(3)
    expect(rows[0]!.textContent).toContain('DWH-1')
    expect(rows[0]!.textContent).toContain('2 wk')
    expect(rows[0]!.textContent).toContain('✓ p.6–7')
    expect(rows[1]!.textContent).toContain('sheet needed')
    expect(within(rows[2]!).getByTestId('their-call-head').textContent).toBe('1 of 2 rejected')
    expect(within(rows[2]!).getByTestId('their-call-parts').textContent).toBe('1 with no answer yet')
    // The order-only fixture sits under them, in its own group.
    expect(screen.getByTestId('submittal-rows').textContent).toContain('STOPS')
  })

  it('each button reports its row; nothing is written here', () => {
    const on = mount()
    fireEvent.click(screen.getByRole('button', { name: 'Edit DWH-1' }))
    expect(on.onEdit).toHaveBeenCalledWith(dwh)
    fireEvent.click(screen.getByRole('button', { name: 'Their answer on FCO' }))
    expect(on.onAnswer).toHaveBeenCalledWith(fco)
    fireEvent.click(screen.getByRole('button', { name: 'Split LAV-1, LAV-2' }))
    expect(on.onSplit).toHaveBeenCalledWith(lav)
    // A hand row with no parts can become a part of another row: the hint's row is offered.
    fireEvent.click(screen.getByRole('button', { name: 'Make FCO a part of another row' }))
    expect(on.onFold).toHaveBeenCalledWith('fco', 'dwh')
    fireEvent.click(screen.getByRole('button', { name: 'Remove DWH-1' }))
    expect(on.onTakeOff).toHaveBeenCalledWith(dwh)
  })

  it('on a shared revision the draft-only buttons are gone, and an empty revision says so', () => {
    mount({ isDraft: false })
    expect(screen.queryByRole('button', { name: 'Remove DWH-1' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Split LAV-1, LAV-2' })).toBeNull()
    expect(screen.getByRole('button', { name: 'Edit DWH-1' })).toBeTruthy()
  })

  it('no rows: one line says so', () => {
    mount({ items: [], gcItems: [], orderOnlyItems: [], parts: [], decisions: { decided: 0 } })
    expect(screen.getByTestId('submittal-rows').textContent).toBe('No rows on this revision.')
  })
})
