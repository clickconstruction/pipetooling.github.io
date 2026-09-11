// @vitest-environment jsdom
/**
 * Wiring smoke for the New Labor view (the Labor refresh PR 1): the head reads
 * completeness and the strip, the queue lists the zero rows with the book's
 * guess, the grid shows a source chip per filled row. Supabase is stubbed; the
 * applied book comes back empty, so every zero row is "no match".
 */
import { describe, expect, it, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'

vi.mock('../../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../../test/renderSmokeMocks')
  return { supabase: makeSupabaseStub() }
})

import { BidsLaborNewView } from './BidsLaborNewView'
import type { CostEstimateLaborRow } from '../../lib/bids/bidPricingEngineTypes'

const row = (id: string, fixture: string, count: number, hrs: [number, number, number], extra: Partial<CostEstimateLaborRow> = {}): CostEstimateLaborRow =>
  ({ id, cost_estimate_id: 'ce-1', fixture, count, rough_in_hrs_per_unit: hrs[0], top_out_hrs_per_unit: hrs[1], trim_set_hrs_per_unit: hrs[2], is_fixed: false, kind: 'fixture', unit: 'each', source: null, source_note: null, sequence_order: 0, created_at: null, ...extra }) as CostEstimateLaborRow

const rows = [row('r1', 'Toilets', 4, [1, 1, 1]), row('r2', 'Gas drops', 5, [3, 1, 0]), row('r3', 'WHA-500', 1, [0, 0, 0]), row('r4', 'SAWCUTTING', 1, [0, 0, 0])]

function renderView(over: Partial<Parameters<typeof BidsLaborNewView>[0]> = {}) {
  return render(
    <BidsLaborNewView
      bidId="bid-1"
      bidValue={41_550}
      rows={rows}
      ratePerHour={35.76}
      materialsSource="none"
      appliedBookVersionId={null}
      laborBookVersions={[]}
      onChangeBook={vi.fn()}
      setRowHours={vi.fn()}
      markCell={vi.fn()}
      cellA11y={() => ({})}
      cellSaveStyle={() => ({})}
      replaceRows={vi.fn()}
      getOrCreateFixtureTypeId={vi.fn(async () => ({ id: 'ft-1' }))}
      onFocusRate={vi.fn()}
      setError={vi.fn()}
      rowDomId={(f) => `labor-row-${f ?? ''}`}
      rowJumpFlashDomId={null}
      {...over}
    />,
  )
}

describe('BidsLaborNewView', () => {
  it('reads completeness and the strip off the rows', () => {
    renderView()
    expect(screen.getByText('Not yet usable as a job budget')).toBeTruthy()
    expect(screen.getByText('hours on 2 of 4 rows')).toBeTruthy()
    expect(screen.getByText('2 rows need hours ↓')).toBeTruthy()
    expect(screen.getByText('rate set')).toBeTruthy()
    // 4 toilets × 3 h + 5 gas drops × 4 h = 32 h → 2 crew-days → $1,144.32
    expect(screen.getAllByText('32').length).toBeGreaterThanOrEqual(1) // the Field hours tile (and the totals row)
    expect(screen.getAllByText('$1,144.32').length).toBeGreaterThanOrEqual(1) // the Labor $ tile and the bottom line
    expect(screen.getByText('$1,298')).toBeTruthy() // 41,550 ÷ 32
  })

  it('queues the zero rows with a Read as picker and a Save button; filled rows carry a source chip', () => {
    renderView()
    const queue = screen.getByTestId('labor-queue')
    expect(within(queue).getByText('2 rows need hours')).toBeTruthy()
    expect(within(queue).getByText('WHA-500')).toBeTruthy()
    expect(within(queue).getByText('SAWCUTTING')).toBeTruthy()
    expect(within(queue).getAllByLabelText(/^Read .* as$/)).toHaveLength(2)
    expect(within(queue).getAllByRole('button', { name: /^Save/ })).toHaveLength(2)
    // Each queue row names its kind (v2.3291): Fixture · Task · Sub, Fixture pressed by default.
    expect(within(queue).getAllByRole('group', { name: /is a$/ })).toHaveLength(2)
    expect(within(queue).getAllByRole('button', { name: 'Fixture', pressed: true })).toHaveLength(2)
    expect(within(queue).getAllByRole('button', { name: 'Sub', pressed: false })).toHaveLength(2)
    expect(screen.getByText('2 rows with hours')).toBeTruthy()
    // No book → every filled row reads as typed.
    expect(screen.getAllByText('✎ typed')).toHaveLength(2)
    expect(screen.getByText('2 typed · 2 pending above')).toBeTruthy()
  })

  it('says every row has hours when the queue is empty and offers the rate when none is set', () => {
    renderView({ rows: rows.slice(0, 2), ratePerHour: null })
    expect(screen.getByText('Every row has hours.')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'set a labor rate ↓' })).toBeTruthy()
    expect(screen.getByText('no labor rate')).toBeTruthy()
  })
})

describe('BidsLaborNewView · kinds and units (v2.3291)', () => {
  it('a sub line is answered without hours, a per-100-ft row says so, and a robot row wears its chip', () => {
    renderView({
      rows: [
        row('r1', 'Toilets', 4, [1, 1, 1]),
        row('r2', 'ft of 2IN WASTE', 729.5, [4, 0, 0], { unit: 'per_100ft', source: 'typed' }),
        row('r3', 'Ramirez excavation', 1, [0, 0, 0], { kind: 'sub', source: 'typed', source_note: 'sub line — priced under direct costs' }),
        row('r4', 'HB-3', 2, [1, 0.5, 1], { source: 'robot' }),
      ],
    })
    // 12 + 29.18 + 0 + 5 = 46.2 h; the sub line is not a row that needs hours.
    expect(screen.getByText('Every row has hours.')).toBeTruthy()
    expect(screen.getByText('hours on 3 of 3 rows')).toBeTruthy()
    expect(screen.getByText('1 sub line')).toBeTruthy()
    expect(screen.getByText('sub · priced under direct costs')).toBeTruthy()
    expect(screen.getByText('hours per 100 ft · 729.5 ft')).toBeTruthy()
    expect(screen.getByText('✎ typed · per 100 ft')).toBeTruthy()
    expect(screen.getByText('🤖 robot')).toBeTruthy()
    expect(screen.getAllByText('46.2').length).toBeGreaterThanOrEqual(1) // the Field hours tile and the totals row
    expect(screen.getByText('2 typed · 1 robot · 1 sub')).toBeTruthy() // Toilets has no book to match, so it reads typed too
  })
  it('the Other direct tile is on the head, empty until the view returns rows', () => {
    renderView()
    const t = screen.getByTestId('labor-other-direct')
    expect(within(t).getByText('Other direct')).toBeTruthy()
    expect(within(t).getByText('equipment · permits · subs · waste · other, below')).toBeTruthy()
  })
})

describe('BidsLaborNewView · the crew rate and the bottom line (v2.3294)', () => {
  const crewRate = { avgFieldWage: 29.8, fieldHours: 3_120, burden: 1.2, companyRate: 35.76, overheadPerFieldHour: 11.5, fromYmd: '2026-06-13', toYmd: '2026-09-11' }
  it('with no rate on the bid, costs at the company rate and offers to save it; the overhead tile and bid labor are facts', () => {
    const onUseCompanyRate = vi.fn()
    renderView({ ratePerHour: null, crewRate, onUseCompanyRate, teamLabor: { hours: 12.5, cost: 446, people: ['Wendi'] }, materials: { rough: 40_000, top: 15_000, trim: 6_300 }, costEstimate: { driving_cost_rate: 0.7, hours_per_trip: 8 } as never, distanceFromOffice: '41', countRowsLength: 4, directCostTables: { sub: [{ rough_in: 6_500 }], permit: [{ rough_in: 1_240 }] } })
    const card = screen.getByTestId('labor-crew-rate')
    expect(within(card).getByText('$35.76/h')).toBeTruthy()
    expect(within(card).getByText('= $29.80 avg recorded field wage (90 d, 3,120 h) × 1.20 burden')).toBeTruthy()
    expect(within(card).getByText('company rate')).toBeTruthy()
    within(card).getByRole('button', { name: 'save it on the bid' }).click()
    expect(onUseCompanyRate).toHaveBeenCalledWith(35.76)
    expect(within(screen.getByTestId('labor-bid-labor-recorded')).getByText('12.5 h · $446.00')).toBeTruthy()
    expect(screen.getByText('rate set')).toBeTruthy() // completeness reads the effective rate
    expect(within(screen.getByTestId('labor-overhead-per-hour')).getByText('$11.50')).toBeTruthy()
    // 32 h × $35.76 = $1,144.32 labor; driving 32/8 × 0.7 × 41 = $114.80; other direct $7,740; materials $61,300 → $70,299.12; margin at $41,550 is negative
    const line = screen.getByTestId('labor-bottom-line')
    expect(within(line).getByText('$1,144.32')).toBeTruthy()
    expect(within(line).getByText('$114.80')).toBeTruthy()
    expect(within(line).getByText('$7,740.00')).toBeTruthy()
    expect(within(line).getByText('$70,299.12')).toBeTruthy()
    expect(within(line).getByText('-69% margin at $41,550.00')).toBeTruthy()
  })
  it('with a rate on the bid, the override wins and can be cleared back to the company rate', () => {
    const onClearRate = vi.fn()
    renderView({ ratePerHour: 35, crewRate, onClearRate })
    const card = screen.getByTestId('labor-crew-rate')
    expect(within(card).getByText('$35.00/h override')).toBeTruthy()
    within(card).getByRole('button', { name: 'use company rate' }).click()
    expect(onClearRate).toHaveBeenCalled()
  })
  it('with neither, asks for a rate', () => {
    renderView({ ratePerHour: null, crewRate: null })
    expect(within(screen.getByTestId('labor-crew-rate')).getByText('no rate')).toBeTruthy()
    expect(screen.getByText('no labor rate')).toBeTruthy()
  })
})
