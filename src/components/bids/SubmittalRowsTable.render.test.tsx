// @vitest-environment jsdom
/**
 * Render smoke for the rows of one revision, moved out of `BidsSubmittalsTab.tsx` (2026-10-04):
 * the seam pinned. It draws what it is handed and reports each button; nothing is written here.
 * Redrawn 2026-10-05: two fixed shapes, each part a line with its answer beside it, the counts
 * as filters, what every row shares said once, Part of… and × behind ⋯.
 */
import { describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
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
  const headers = () => screen.getAllByRole('columnheader').map((h) => h.textContent!.replace(' ?', '')).filter(Boolean)

  it('draws a row per fixture the GC sees, with its cut sheet, lead time and their answer counted by part', () => {
    mount()
    const rows = screen.getAllByTestId('submittal-row')
    expect(rows).toHaveLength(3)
    expect(rows[0]!.textContent).toContain('DWH-1')
    expect(rows[0]!.textContent).toContain('lead time 2 wk')
    expect(rows[0]!.textContent).toContain('✓ p.6–7')
    expect(rows[1]!.textContent).toContain('sheet needed')
    expect(within(rows[2]!).getByTestId('their-call-head').textContent).toBe('1 of 2 rejected')
    expect(within(rows[2]!).getByTestId('their-call-parts').textContent).toBe('1 with no answer yet')
    // The order-only fixture sits under them, in its own group.
    expect(screen.getByTestId('submittal-rows').textContent).toContain('STOPS')
  })

  it('each button reports its row; Part of… and × wait behind the row’s ⋯; nothing is written here', () => {
    const on = mount()
    fireEvent.click(screen.getByRole('button', { name: 'Edit DWH-1' }))
    expect(on.onEdit).toHaveBeenCalledWith(dwh)
    fireEvent.click(screen.getByRole('button', { name: 'Their answer on FCO' }))
    expect(on.onAnswer).toHaveBeenCalledWith(fco)
    fireEvent.click(screen.getByRole('button', { name: 'Split LAV-1, LAV-2' }))
    expect(on.onSplit).toHaveBeenCalledWith(lav)
    // Closed, the two are not on the page at all.
    expect(screen.queryByRole('button', { name: 'Remove DWH-1' })).toBeNull()
    expect(screen.queryByTestId('fold-row')).toBeNull()
    const more = screen.getByRole('button', { name: 'More for FCO' })
    expect(more.getAttribute('aria-expanded')).toBe('false')
    fireEvent.click(more)
    expect(more.getAttribute('aria-expanded')).toBe('true')
    // A hand row with no parts can become a part of another row: the hint's row is offered.
    fireEvent.click(screen.getByRole('button', { name: 'Make FCO a part of another row' }))
    expect(on.onFold).toHaveBeenCalledWith('fco', 'dwh')
    fireEvent.click(screen.getByRole('button', { name: 'Remove FCO' }))
    expect(on.onTakeOff).toHaveBeenCalledWith(fco)
    // A row with parts from the takeoff has only × behind its ⋯; pressing ⋯ again folds it.
    fireEvent.click(screen.getByRole('button', { name: 'More for LAV-1, LAV-2' }))
    expect(screen.getAllByTestId('fold-row')).toHaveLength(1)
    fireEvent.click(screen.getByRole('button', { name: 'More for FCO' }))
    expect(screen.queryByTestId('fold-row')).toBeNull()
  })

  it('on a shared revision the draft-only buttons are gone, and an empty revision says so', () => {
    mount({ isDraft: false })
    expect(screen.queryByTestId('row-more')).toBeNull()
    expect(screen.queryByRole('button', { name: 'Split LAV-1, LAV-2' })).toBeNull()
    expect(screen.getByRole('button', { name: 'Edit DWH-1' })).toBeTruthy()
  })

  it('no rows: one line says so', () => {
    mount({ items: [], gcItems: [], orderOnlyItems: [], parts: [], decisions: { decided: 0 } })
    expect(screen.getByTestId('submittal-rows').textContent).toBe('No rows on this revision.')
    expect(screen.queryByTestId('row-filters')).toBeNull()
  })

  describe('two fixed shapes', () => {
    it('a bid built from the takeoff: Fixture, Product and parts, Their answer, Cut sheet; no Specified, Status, Reason or Lead time column', () => {
      mount()
      expect(screen.getByRole('table').getAttribute('data-shape')).toBe('takeoff')
      expect(headers()).toEqual(['Fixture', 'Product and parts', 'Their answer', 'Cut sheet'])
    })

    it('before any answer the Their answer column is not drawn', () => {
      mount({ items: [dwh, fco], gcItems: [dwh, fco], orderOnlyItems: [], parts: [], partsOf: new Map(), decisions: { decided: 0 } })
      expect(headers()).toEqual(['Fixture', 'Product and parts', 'Cut sheet'])
      expect(screen.queryByTestId('row-answer')).toBeNull()
    })

    it('a bid with a schedule keeps Tag, Specified and Submitted, and reads status, reason and lead time in one cell', () => {
      const wc = row({ id: 'wc', tag: 'WC-1', specified_manufacturer: 'TOTO', specified_model: 'CT708UVG#01', specified_description: 'WATER CLOSET', submitted_label: 'TOTO CT728', status: 'alternate', reason_kind: 'lead_time', reason_note: 'spec is 3–4 wk out', lead_time_days: 7 })
      const prv = row({ id: 'prv', tag: 'PRV-1', sequence_order: 2, specified_manufacturer: 'WATTS', specified_model: 'LF25AUB', submitted_label: 'ZURN 70XL', status: 'alternate' })
      mount({ items: [wc, prv], gcItems: [wc, prv], orderOnlyItems: [], parts: [], partsOf: new Map(), decisions: { decided: 0 } })
      expect(screen.getByRole('table').getAttribute('data-shape')).toBe('schedule')
      expect(headers()).toEqual(['Tag', 'Specified', 'Submitted', 'Status', 'Cut sheet'])
      const [first, second] = screen.getAllByTestId('submittal-row')
      expect(first!.textContent).toContain('TOTO CT708UVG#01')
      expect(first!.querySelector('td[data-label="Status"]')!.textContent).toBe('AlternateLead timespec is 3–4 wk outlead time 1 wk')
      // An alternate with no reason still asks for one.
      expect(second!.textContent).toContain('say why')
      // Nothing is said once over a schedule table: its rows differ.
      expect(screen.queryByTestId('rows-said-once')).toBeNull()
    })

    it('a schedule typed on the bid makes it the schedule shape even before the rows are rebuilt', () => {
      mount({ scheduleTags: 3 })
      expect(screen.getByRole('table').getAttribute('data-shape')).toBe('schedule')
    })

    it('on a takeoff bid a row that is not Proposed says its status under the tag', () => {
      const sink = row({ id: 'sink', tag: 'UTILITY SINK', sequence_order: 5, status: 'missing' })
      mount({ items: [dwh, sink], gcItems: [dwh, sink], orderOnlyItems: [], parts: [], partsOf: new Map(), decisions: { decided: 0 } })
      expect(screen.getAllByTestId('row-status').map((e) => e.textContent)).toEqual(['Missing'])
    })
  })

  describe('each part is a line with its answer beside it', () => {
    it('the rejected part carries Rejected and the note; the other part says it is still waiting', () => {
      const noted = lavParts.map((p) => (p.id === 'faucet' ? { ...p, review_note: 'TEL145' } : p))
      mount({ parts: noted, partsOf: new Map([['lav', noted]]) })
      const lines = within(screen.getAllByTestId('submittal-row')[2]!).getAllByTestId('row-part-line')
      expect(lines.map((l) => l.textContent)).toEqual(['TSL.MON.B.38no answer yet', 'TOTO T25S51E#CPRejected“TEL145”'])
      expect(screen.getAllByTestId('row-part-call').map((e) => e.textContent)).toEqual(['Rejected'])
    })

    it('a row nobody answered says so once, on its first line', () => {
      mount()
      const first = screen.getAllByTestId('submittal-row')[0]!
      expect(within(first).getAllByTestId('row-answer').map((e) => e.textContent)).toEqual(['No answer yet'])
    })

    it('a row answered as a whole carries its answer on its line', () => {
      const approved = { ...fco, review_decision: 'approved', review_note: 'ok as noted', reviewed_by_name: 'structura' } as SubmittalItemRow
      mount({ items: [dwh, approved], gcItems: [dwh, approved], orderOnlyItems: [], parts: [], partsOf: new Map() })
      expect(within(screen.getAllByTestId('submittal-row')[1]!).getByTestId('row-answer').textContent).toBe('Approved“ok as noted”')
    })

    it('a row with no product says so where the product goes, and offers the door', () => {
      const sink = row({ id: 'sink', tag: 'UTILITY SINK', sequence_order: 5, status: 'missing' })
      const on = mount({ items: [sink], gcItems: [sink], orderOnlyItems: [], parts: [], partsOf: new Map(), decisions: { decided: 0 } })
      expect(screen.getByTestId('row-no-product').textContent).toBe('No product yet')
      fireEvent.click(screen.getByRole('button', { name: 'Add the product' }))
      expect(on.onEdit).toHaveBeenCalledWith(sink)
    })
  })

  describe('the counts are filters', () => {
    it('All and each count above zero; pressing one keeps those rows and hides the order-only group', () => {
      mount()
      const chips = within(screen.getByTestId('row-filters')).getAllByRole('button')
      expect(chips.map((c) => c.textContent)).toEqual(['All 3', 'Need a cut sheet 2', 'Sent back 1', 'No answer yet 2'])
      expect(chips[0]!.getAttribute('aria-pressed')).toBe('true')
      fireEvent.click(screen.getByRole('button', { name: 'Sent back 1' }))
      expect(screen.getAllByTestId('submittal-row').map((r) => r.textContent!.slice(0, 12))).toEqual(['LAV-1, LAV-2'])
      expect(screen.queryByTestId('order-only-row')).toBeNull()
      expect(screen.getByTestId('row-filter-note').textContent).toBe('Showing 1 of 3 rows. Show all')
      fireEvent.click(screen.getByRole('button', { name: 'Show all' }))
      expect(screen.getAllByTestId('submittal-row')).toHaveLength(3)
      expect(screen.getByTestId('order-only-row')).toBeTruthy()
    })

    it('nothing to narrow to, no chips', () => {
      const done = { ...dwh, review_decision: null } as SubmittalItemRow
      mount({ items: [done], gcItems: [done], orderOnlyItems: [], parts: [], partsOf: new Map(), decisions: { decided: 0 } })
      expect(screen.queryByTestId('row-filters')).toBeNull()
    })
  })

  describe('what every row shares is said once', () => {
    const houses = new Map([['nws', 'National Wholesale'], ['moore', 'Moore Supply']])
    const a = row({ id: 'a', tag: 'FCO', submitted_label: 'ZURN ZN1400-2NL', supply_house_id: 'nws' })
    const b = row({ id: 'b', tag: 'FD', sequence_order: 2, submitted_label: 'JRSMITH 2005', supply_house_id: 'nws' })

    it('Proposed and the one house, over the table; the rows do not repeat the house', () => {
      const on = { onTypeSchedule: vi.fn() }
      mount({ items: [a, b], gcItems: [a, b], orderOnlyItems: [], parts: [], partsOf: new Map(), houseNameById: houses, decisions: { decided: 0 }, ...on })
      expect(screen.getByTestId('rows-said-once').textContent).toBe('Every row is Proposed because this bid has no schedule to check against. Type the schedule to change that. Every part comes from National Wholesale.')
      expect(screen.queryByTestId('row-house')).toBeNull()
      fireEvent.click(screen.getByRole('button', { name: 'Type the schedule' }))
      expect(on.onTypeSchedule).toHaveBeenCalledTimes(1)
    })

    it('two houses: each row names its own again', () => {
      const c = { ...b, supply_house_id: 'moore' } as SubmittalItemRow
      mount({ items: [a, c], gcItems: [a, c], orderOnlyItems: [], parts: [], partsOf: new Map(), houseNameById: houses, decisions: { decided: 0 } })
      expect(screen.getByTestId('rows-said-once').textContent).toBe('Every row is Proposed because this bid has no schedule to check against. ')
      expect(screen.getAllByTestId('row-house').map((e) => e.textContent)).toEqual(['National Wholesale', 'Moore Supply'])
    })

    it('one vendor file is not named on every row; two are', () => {
      mount()
      expect(screen.getAllByTestId('submittal-row')[0]!.textContent).not.toContain('NWS.pdf')
      cleanup()
      mount({ sourceFiles: [{ path: 'b/s1/0.pdf', name: 'NWS.pdf', pages: 12 } as never, { path: 'b/s1/1.pdf', name: 'MOORE.pdf', pages: 4 } as never] })
      expect(screen.getAllByTestId('submittal-row')[0]!.textContent).toContain('NWS.pdf')
    })
  })
})
