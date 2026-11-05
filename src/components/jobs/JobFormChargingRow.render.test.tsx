// @vitest-environment jsdom
/**
 * Edit Job → Charging the customer (punch list #254, PR 4): the collapsed value reads the job's rule with its rate and
 * the markup in force with its margin; a shape picked saves the rule as you pick and the value follows; the flat-rate box wakes with
 * the flat rule; a markup typed saves the job's own, a margin typed saves the markup it makes, blank saves none; a read that fails names its reason with Try again.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, waitFor } from '@testing-library/react'
import { renderWithProviders } from '../../test/renderSmokeMocks'
import { JobFormChargingRow } from './JobFormChargingRow'

const state: { job: Record<string, unknown>; fail: boolean } = { job: {}, fail: false }
vi.mock('../../lib/supabase', () => ({
  supabase: {
    from: () => ({
      select: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve(state.fail ? { data: null, error: new Error('the network dropped') } : { data: state.job, error: null }) }) }),
    }),
  },
}))
const CARD = { rates: { master_helper: 285, two_techs: 285, tech_alone: 185, helper_alone: 75 }, extraPerson: null, materialsMarkupPct: 25 }
const writes: Array<{ rule: unknown; markupPct: number | null }> = []
vi.mock('../../lib/charges/jobChargesRead', () => ({
  loadRateCard: () => Promise.resolve(CARD),
  saveJobChargeRule: (_jobId: string, rule: unknown, markupPct: number | null) => {
    writes.push({ rule, markupPct })
    return Promise.resolve()
  },
}))

describe('JobFormChargingRow', () => {
  beforeEach(() => {
    writes.length = 0
    state.fail = false
    state.job = {}
  })

  it("collapsed, reads the company's rate card and markup when the job has none", async () => {
    renderWithProviders(<JobFormChargingRow jobId="j1" expanded={false} onToggle={() => {}} />)
    await waitFor(() => expect(screen.getByTestId('charging-row').textContent).toContain('the crew on each day, from the rate card · materials 25% over cost, a 20% margin on the sale, the company’s markup'))
  })

  it('a shape picked saves the rule as you pick, the flat rule wakes the rate box, a markup typed saves the job’s own and blank saves none', async () => {
    state.job = { charge_rule: 'shape', charge_shape: 'master_helper', materials_markup_pct: 30 }
    renderWithProviders(<JobFormChargingRow jobId="j1" expanded onToggle={() => {}} />)
    await waitFor(() => expect(screen.getByTestId('charging-rule')).toBeTruthy())
    expect(screen.getByTestId('charging-row').textContent).toContain('master with a helper throughout · $285.00 the crew’s hour · materials 30% over cost, a 23.1% margin on the sale, this job’s own')
    expect((screen.getByTestId('charging-flat') as HTMLInputElement).disabled).toBe(true)
    fireEvent.change(screen.getByTestId('charging-rule'), { target: { value: 'shape:tech_alone' } })
    await waitFor(() => expect(writes).toHaveLength(1))
    expect(writes[0]).toEqual({ rule: { kind: 'shape', shape: 'tech_alone' }, markupPct: 30 })
    await waitFor(() => expect(screen.getByTestId('charging-row').textContent).toContain('a tech alone throughout · $185.00 the crew’s hour'))
    fireEvent.change(screen.getByTestId('charging-rule'), { target: { value: 'flat' } })
    await waitFor(() => expect(writes).toHaveLength(2))
    expect(writes[1]).toEqual({ rule: { kind: 'flat', rate: 285 }, markupPct: 30 })
    await waitFor(() => expect((screen.getByTestId('charging-flat') as HTMLInputElement).disabled).toBe(false))
    fireEvent.change(screen.getByTestId('charging-flat'), { target: { value: '300' } })
    fireEvent.blur(screen.getByTestId('charging-flat'))
    await waitFor(() => expect(writes).toHaveLength(3))
    expect(writes[2]).toEqual({ rule: { kind: 'flat', rate: 300 }, markupPct: 30 })
    fireEvent.change(screen.getByTestId('charging-markup-margin'), { target: { value: '20' } })
    expect((screen.getByTestId('charging-markup') as HTMLInputElement).value).toBe('25')
    fireEvent.blur(screen.getByTestId('charging-markup-margin'))
    await waitFor(() => expect(writes).toHaveLength(4))
    expect(writes[3]).toEqual({ rule: { kind: 'flat', rate: 300 }, markupPct: 25 })
    await waitFor(() => expect(screen.getByTestId('charging-row').textContent).toContain('a flat $300.00 an hour · materials 25% over cost, a 20% margin on the sale, this job’s own'))
    fireEvent.change(screen.getByTestId('charging-markup'), { target: { value: '' } })
    expect((screen.getByTestId('charging-markup-margin') as HTMLInputElement).value).toBe('')
    fireEvent.blur(screen.getByTestId('charging-markup'))
    await waitFor(() => expect(writes).toHaveLength(5))
    expect(writes[4]).toEqual({ rule: { kind: 'flat', rate: 300 }, markupPct: null })
    await waitFor(() => expect(screen.getByTestId('charging-row').textContent).toContain('a flat $300.00 an hour · materials 25% over cost, a 20% margin on the sale, the company’s markup'))
  })

  it('a read that fails names its reason with Try again', async () => {
    state.fail = true
    renderWithProviders(<JobFormChargingRow jobId="j1" expanded onToggle={() => {}} />)
    await waitFor(() => expect(screen.getByTestId('charging-error').textContent).toContain('the network dropped'))
    expect(screen.getByText('Try again')).toBeTruthy()
  })
})
