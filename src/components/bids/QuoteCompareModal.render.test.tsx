// @vitest-environment jsdom
/**
 * Render smokes for QuoteCompareModal with the robot's structured quotes
 * (Price Matrix PR 4): a kit row shows one $/each and expands into its parts,
 * an incomplete kit never wins, an option group reads "needs a choice" and the
 * Settle door writes option_chosen + a correction, and a human repick of a
 * robot pick stamps pick_source and records the overrule.
 */
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, waitFor, within } from '@testing-library/react'

import { renderWithProviders } from '../../test/renderSmokeMocks'
import { QuoteCompareModal } from './QuoteCompareModal'

const state: { updates: Array<{ patch: Record<string, unknown>; where: string }>; corrections: Record<string, unknown>[] } = { updates: [], corrections: [] }

vi.mock('../../hooks/useAuth', () => ({
  useAuth: () => ({ user: { id: 'wendi', email: 'wendi@x.test' }, profileName: 'Wendi', role: 'estimator' }),
}))

const NWS_LINES = [
  { id: 'n-kit', fixture: 'WC1&2', unit_price_each_cents: 101000, cant_supply: false, alternate_note: null, picked: true, lot_id: null, lot_total_cents: null, component_role: 'kit', label: 'Subtotal — WC-1 & WC-2 EACH', option_group: null, option_label: null, option_chosen: false, page_ref: 'p. 3', pick_reason: 'cheapest complete kit', pick_source: 'robot' },
  { id: 'n-bowl', fixture: 'WC1&2', unit_price_each_cents: null, cant_supply: false, alternate_note: null, picked: true, lot_id: null, lot_total_cents: null, component_role: 'bowl', label: 'TOTO CT728CUVG#01', option_group: null, option_label: null, option_chosen: false, page_ref: 'p. 2', pick_reason: null, pick_source: 'robot' },
  { id: 'n-car', fixture: 'WC1&2', unit_price_each_cents: 33841, cant_supply: false, alternate_note: null, picked: true, lot_id: null, lot_total_cents: null, component_role: 'carrier', label: 'Josam 12704 vertical, no side inlets', option_group: null, option_label: null, option_chosen: false, page_ref: 'carrier sheet', pick_reason: null, pick_source: 'robot' },
  { id: 'r-1', fixture: 'RPZ', unit_price_each_cents: 286485, cant_supply: false, alternate_note: null, picked: false, lot_id: null, lot_total_cents: null, component_role: null, label: 'Watts 957 2½in', option_group: 'size', option_label: '2½in', option_chosen: false, page_ref: 'p. 1', pick_reason: null, pick_source: null },
  { id: 'r-4', fixture: 'RPZ', unit_price_each_cents: 368009, cant_supply: false, alternate_note: null, picked: false, lot_id: null, lot_total_cents: null, component_role: null, label: 'Watts 957 4in', option_group: 'size', option_label: '4in', option_chosen: false, page_ref: 'p. 1', pick_reason: null, pick_source: null },
]
const OTHER_LINES = [
  { id: 'o-kit', fixture: 'WC1&2', unit_price_each_cents: 95000, cant_supply: false, alternate_note: null, picked: false, lot_id: null, lot_total_cents: null, component_role: 'kit', label: 'kit', option_group: null, option_label: null, option_chosen: false, page_ref: 'p. 1', pick_reason: null, pick_source: null },
  { id: 'o-bowl', fixture: 'WC1&2', unit_price_each_cents: null, cant_supply: false, alternate_note: null, picked: false, lot_id: null, lot_total_cents: null, component_role: 'bowl', label: 'Kohler bowl', option_group: null, option_label: null, option_chosen: false, page_ref: 'p. 1', pick_reason: null, pick_source: null },
]

vi.mock('../../lib/supabase', () => ({
  supabase: {
    from: (table: string) => {
      if (table === 'bid_quotes') {
        return {
          select: () => ({
            eq: () => ({
              order: () =>
                Promise.resolve({
                  data: [
                    { id: 'q-nws', supply_house_id: 'h-nws', received_at: '2026-09-10T20:00:00Z', valid_until: '2026-12-31', freight_cents: null, source: 'robot', supply_house: { name: 'National Wholesale Supply' }, bid_quote_lines: NWS_LINES },
                    { id: 'q-o', supply_house_id: 'h-o', received_at: '2026-09-10T21:00:00Z', valid_until: '2026-12-31', freight_cents: 0, source: 'robot', supply_house: { name: 'Other House' }, bid_quote_lines: OTHER_LINES },
                  ],
                  error: null,
                }),
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
      if (table === 'fixture_component_corrections') {
        return {
          insert: (row: Record<string, unknown>) => {
            state.corrections.push(row)
            return Promise.resolve({ data: null, error: null })
          },
        }
      }
      if (table === 'bid_price_matrix_requests') {
        return {
          select: () => ({
            eq: () => ({
              in: () => ({
                order: () => ({
                  limit: () => ({
                    maybeSingle: () => Promise.resolve({ data: { id: 'req-1', status: 'ready', summary: 'Read the NWS quote; RPZ needs a size.', result: { rows_priced: 1, rows_total: 2, rows_asked: 1 }, finished_at: '2026-09-10T22:00:00Z' }, error: null }),
                  }),
                }),
              }),
            }),
          }),
        }
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
  { id: 'r2', fixture: 'RPZ', count: 1 },
]

function mount() {
  return renderWithProviders(
    <QuoteCompareModal open onClose={() => {}} onPlugIn={() => {}} bidId="b359" bidLabel="BP359" rows={rows} takeoffMaterialsByCountRowId={{}} taxPercent={8.25} currentTotals={null} onCostsApplied={() => {}} />,
  )
}

describe('QuoteCompareModal with structured robot quotes', () => {
  it('shows the kit as one $/each, the incomplete house as incomplete, the robot reason, and the banner', async () => {
    state.updates = []
    mount()
    expect(await screen.findByText('$1,348.41 ★')).toBeTruthy()
    expect(screen.getByText('incomplete')).toBeTruthy()
    expect(screen.getByText('missing carrier')).toBeTruthy()
    expect(screen.getByText('cheapest complete kit')).toBeTruthy()
    expect(screen.getByTestId('robot-banner').textContent).toMatch(/read 2 quotes/)
    expect(screen.getByTestId('robot-banner').textContent).toMatch(/1 to settle/)
    // Expand the kit: the carrier sub-row names its price and the other house's gap.
    fireEvent.click(screen.getByRole('button', { name: 'Show the parts of WC1&2' }))
    expect(screen.getByText('$338.41')).toBeTruthy()
    expect(screen.getAllByText('not quoted').length).toBeGreaterThan(0)
    expect(screen.getAllByText('in kit').length).toBeGreaterThan(0)
  })

  it('an option group reads "needs a choice" with the range; Settle writes option_chosen and a correction', async () => {
    state.updates = []
    state.corrections = []
    mount()
    const needs = await screen.findByRole('button', { name: /needs a choice/ })
    expect(needs.textContent).toMatch(/\$2,864\.85 – \$3,680\.09/)
    expect(screen.getByTestId('settle-strip').textContent).toMatch(/RPZ/)
    fireEvent.click(needs)
    const dialog = await screen.findByRole('dialog', { name: 'Choose the size for RPZ' })
    fireEvent.click(within(dialog).getByRole('button', { name: /4in/ }))
    await waitFor(() => expect(state.updates.some((u) => u.patch.option_chosen === true && u.where === 'r-4')).toBe(true))
    expect(state.updates.some((u) => u.patch.option_chosen === false && u.where === 'r-1,r-4')).toBe(true)
    expect(state.corrections).toHaveLength(1)
    expect(state.corrections[0]!.action).toBe('choose_option')
    expect(state.corrections[0]!.request_id).toBe('req-1')
    expect(state.corrections[0]!.created_by).toBe('wendi')
  })

  it('unpicking the robot’s kit clears every line of it and records the overrule', async () => {
    state.updates = []
    state.corrections = []
    mount()
    const kitCell = await screen.findByText('$1,348.41 ★')
    fireEvent.click(kitCell)
    await waitFor(() => expect(state.updates.length).toBeGreaterThan(0))
    const unpick = state.updates.find((u) => u.patch.picked === false)
    expect(unpick?.where).toBe('n-kit,n-bowl,n-car')
    expect(unpick?.patch.pick_source).toBe('robot')
    await waitFor(() => expect(state.corrections).toHaveLength(1))
    expect(state.corrections[0]!.action).toBe('unpick')
    expect(state.corrections[0]!.from_fixture).toBe('WC1&2')
  })
})
