// @vitest-environment jsdom
/**
 * Render smokes for the compare's Specified column (Submittals stage 1, v2.3460)
 * and the reason at the pick (stage 1c): the column and the status chip draw
 * once a schedule is on the bid, the counts line and the footer name the
 * unreasoned alternates, the chip opens the popover and Save writes the
 * reason + lead time + override onto every line of the picked cell, and
 * picking a price that differs from the schedule opens the popover on its own.
 */
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, waitFor, within } from '@testing-library/react'

import { renderWithProviders } from '../../test/renderSmokeMocks'
import { QuoteCompareModal } from './QuoteCompareModal'

const state: { updates: Array<{ patch: Record<string, unknown>; where: string }> } = { updates: [] }

vi.mock('../../hooks/useAuth', () => ({
  useAuth: () => ({ user: { id: 'wendi', email: 'wendi@x.test' }, profileName: 'Wendi', role: 'estimator' }),
}))

const line = (o: Record<string, unknown>) => ({
  unit_price_each_cents: null,
  cant_supply: false,
  alternate_note: null,
  picked: false,
  lot_id: null,
  lot_total_cents: null,
  component_role: null,
  label: null,
  option_group: null,
  option_label: null,
  option_chosen: false,
  page_ref: null,
  pick_reason: null,
  pick_source: null,
  alternate_reason_kind: null,
  alternate_reason_note: null,
  lead_time_days: null,
  availability: null,
  product_status_override: null,
  ...o,
})

const NWS_LINES = [
  line({ id: 'n-kit', fixture: 'WC1&2', unit_price_each_cents: 101000, picked: true, component_role: 'kit', label: 'TOTO CT728CUVG#01 kit', pick_source: 'human' }),
  line({ id: 'n-bowl', fixture: 'WC1&2', picked: true, component_role: 'bowl', label: 'TOTO CT728CUVG#01' }),
  line({ id: 'n-lav', fixture: 'LAV-1', unit_price_each_cents: 21000, label: 'Kohler K-2210 Caxton' }),
  line({ id: 'n-hb', fixture: 'HB-1', unit_price_each_cents: 4500, picked: true, label: 'Woodford B74-CH', pick_source: 'human' }),
]
const SPEC = [
  { tag: 'WC-1', fixture: 'WC1&2', manufacturer: 'TOTO', model: 'CT708UVG', description: 'Wall-hung, 1.28 gpf' },
  { tag: 'L-1', fixture: 'LAV-1', manufacturer: 'Kohler', model: 'K-2196', description: 'Pennington' },
  { tag: 'HB-1', fixture: 'HB-1', manufacturer: 'Woodford', model: 'B74C', description: 'Wall hydrant' },
  { tag: 'DWH-1', fixture: 'DWH-1', manufacturer: 'A.O. Smith', model: 'BTH-120', description: 'Water heater' },
]

vi.mock('../../lib/supabase', () => ({
  supabase: {
    from: (table: string) => {
      if (table === 'bid_quotes') {
        return {
          select: () => ({
            eq: () => ({
              order: () => Promise.resolve({ data: [{ id: 'q-nws', supply_house_id: 'h-nws', received_at: '2026-09-10T20:00:00Z', valid_until: '2026-12-31', freight_cents: 0, source: 'human', supply_house: { name: 'NWS' }, bid_quote_lines: NWS_LINES }], error: null }),
            }),
          }),
        }
      }
      if (table === 'bid_quote_lines') {
        const rec = (patch: Record<string, unknown>) => ({
          in: (_c: string, ids: string[]) => {
            state.updates.push({ patch, where: ids.join(',') })
            return Promise.resolve({ data: null, error: null })
          },
          eq: (_c: string, id: string) => {
            state.updates.push({ patch, where: id })
            return Promise.resolve({ data: null, error: null })
          },
        })
        return { update: rec }
      }
      if (table === 'bid_specified_products') return { select: () => ({ eq: () => ({ or: () => Promise.resolve({ data: SPEC, error: null }) }) }) }
      if (table === 'bid_price_matrix_requests') {
        return { select: () => ({ eq: () => ({ in: () => ({ order: () => ({ limit: () => ({ maybeSingle: () => Promise.resolve({ data: null, error: null }) }) }) }) }) }) }
      }
      if (table === 'spec_section_match_rules') return { select: () => Promise.resolve({ data: [], error: null }) }
      if (table === 'bid_rfqs') return { select: () => ({ eq: () => ({ neq: () => ({ order: () => ({ limit: () => Promise.resolve({ data: [], error: null }) }) }) }) }) }
      if (table === 'supply_house_fixture_prices') return { select: () => ({ in: () => Promise.resolve({ data: [], error: null }) }) }
      return { select: () => Promise.resolve({ data: [], error: null }) }
    },
  },
}))

const rows = [
  { id: 'r1', fixture: 'WC1&2', count: 11 },
  { id: 'r2', fixture: 'LAV-1', count: 6 },
  { id: 'r3', fixture: 'HB-1', count: 2 },
]

function mount() {
  return renderWithProviders(
    <QuoteCompareModal open onClose={() => {}} onPlugIn={() => {}} bidId="b398" bidLabel="BP398" rows={rows} takeoffMaterialsByCountRowId={{}} taxPercent={8.25} currentTotals={null} onCostsApplied={() => {}} />,
  )
}

describe('QuoteCompareModal — the Specified column and the reason at the pick', () => {
  it('draws the column, the chips, the counts line and the unreasoned footer', async () => {
    state.updates = []
    mount()
    expect(await screen.findByText('Specified')).toBeTruthy()
    // WC-1: picked TOTO CT728 against a CT708 spec → alternate, no reason yet.
    // LAV-1: nothing picked → missing. HB-1: the label carries the specified model → as specified.
    const chips = screen.getAllByTestId('product-status').map((el) => el.textContent)
    expect(chips).toContain('Alternate')
    expect(chips).toContain('Missing')
    expect(chips).toContain('As specified')
    expect(screen.getByTestId('spec-summary').textContent).toMatch(/1 as specified · 1 alternate · 1 without a reason · 1 missing/)
    expect(screen.getByTestId('unreasoned-footer').textContent).toMatch(/1 pick off the schedule with no reason yet/)
    expect(screen.getAllByTestId('pick-annotation').some((el) => /why\?/.test(el.textContent ?? ''))).toBe(true)
  })

  it('the chip opens the popover; Lead time + 2 wk + a note save onto both kit lines', async () => {
    state.updates = []
    mount()
    await screen.findByText('Specified')
    const doors = screen.getAllByTestId('product-status-door')
    const wcDoor = doors.find((d) => d.textContent === 'Alternate')
    expect(wcDoor).toBeTruthy()
    fireEvent.click(wcDoor as HTMLElement)
    const dialog = await screen.findByRole('dialog', { name: 'WC1&2 against the schedule' })
    expect(dialog.textContent).toMatch(/Specified TOTO CT708UVG/)
    expect(dialog.textContent).toMatch(/Picked from NWS TOTO CT728CUVG#01 kit/)
    fireEvent.click(within(dialog).getByRole('button', { name: 'Long lead time' }))
    fireEvent.click(within(dialog).getByRole('button', { name: '2 wk' }))
    fireEvent.change(within(dialog).getByLabelText('Note'), { target: { value: 'spec model is 8 weeks out' } })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(state.updates.length).toBe(1))
    expect(state.updates[0]!.where).toBe('n-kit,n-bowl')
    expect(state.updates[0]!.patch).toEqual({
      alternate_reason_kind: 'lead_time',
      alternate_reason_note: 'spec model is 8 weeks out',
      lead_time_days: 14,
      availability: 'lead_time',
      product_status_override: null,
    })
  })

  it('the estimator can call the pick Equal; the reason chips fold away and the override is written', async () => {
    state.updates = []
    mount()
    await screen.findByText('Specified')
    fireEvent.click(screen.getAllByTestId('product-status-door').find((d) => d.textContent === 'Alternate') as HTMLElement)
    const dialog = await screen.findByRole('dialog', { name: 'WC1&2 against the schedule' })
    expect(within(dialog).queryByRole('button', { name: 'Discontinued' })).toBeTruthy()
    fireEvent.click(within(dialog).getByRole('button', { name: 'Equal' }))
    expect(within(dialog).queryByRole('button', { name: 'Discontinued' })).toBeNull()
    fireEvent.change(within(dialog).getByLabelText('Lead time, typed'), { target: { value: '3 wk' } })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(state.updates.length).toBe(1))
    expect(state.updates[0]!.patch).toMatchObject({ product_status_override: 'equal', alternate_reason_kind: null, lead_time_days: 21, availability: 'lead_time' })
  })

  it('picking a price that differs from the schedule opens the popover on its own', async () => {
    state.updates = []
    mount()
    await screen.findByText('Specified')
    // LAV-1: Kohler K-2210 against a K-2196 spec — tapping the price picks it and asks why.
    fireEvent.click(screen.getByText('$210.00 ★'))
    await waitFor(() => expect(state.updates.some((u) => u.patch.picked === true && u.where === 'n-lav')).toBe(true))
    expect(await screen.findByRole('dialog', { name: 'LAV-1 against the schedule' })).toBeTruthy()
  })
})
