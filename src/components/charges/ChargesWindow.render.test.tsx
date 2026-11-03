// @vitest-environment jsdom
/**
 * Render smokes for the Charges window (punch list #254, PR 3): the read becomes tiles, crew-days by week and material
 * lines; a day's chip change and a line's Pass through become pending adjustments with a reason, and Save writes them
 * as the signed-in user; a read that fails names its reason with Try again; a viewer without the pay gate reads only.
 */
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, waitFor } from '@testing-library/react'

const state: { read: unknown; fail: string | null; added: unknown[]; reverted: unknown[]; rules: unknown[] } = { read: null, fail: null, added: [], reverted: [], rules: [] }

vi.mock('../../lib/charges/jobChargesRead', () => ({
  loadJobCharges: async () => {
    if (state.fail) throw new Error(state.fail)
    return state.read
  },
  addChargeAdjustments: async (jobId: string, rows: unknown[], madeBy: string) => {
    state.added.push({ jobId, rows, madeBy })
  },
  revertChargeAdjustments: async (jobId: string, by: string) => {
    state.reverted.push({ jobId, by })
  },
  saveJobChargeRule: async (jobId: string, rule: unknown, markupPct: number | null) => {
    state.rules.push({ jobId, rule, markupPct })
  },
}))
vi.mock('../../hooks/useAuth', async () => {
  const { useAuthModuleMock } = await import('../../test/renderSmokeMocks')
  return useAuthModuleMock({ role: 'dev' })
})

import ChargesWindow from './ChargesWindow'
import { renderWithProviders } from '../../test/renderSmokeMocks'

const CARD = { rates: { master_helper: 285, two_techs: 285, tech_alone: 185, helper_alone: 75 }, extraPerson: null, materialsMarkupPct: 25 }
const READ = {
  input: {
    sessions: [
      { userId: 't', name: 'Trace', standing: 'master', workDate: '2026-04-24', hours: 8 },
      { userId: 'z', name: 'Zack', standing: 'tech', workDate: '2026-04-24', hours: 7.66 },
      { userId: 'z', name: 'Zack', standing: 'tech', workDate: '2026-04-25', hours: 9.44 },
    ],
    lines: [{ id: 'inv:1', kind: 'supply_invoice', label: 'Sunbelt Rentals · invoice 180856872-0001', dateKey: '2026-04-01', cost: 1423.08 }],
    card: CARD,
    rule: { kind: 'shape', shape: 'master_helper' },
    markupPct: null,
    adjustments: [],
    revenue: 10000,
  },
  job: { id: 'j1', number: '629', name: 'ROUGH IN', customerName: 'DSI', revenue: 10000 },
  rule: { kind: 'shape', shape: 'master_helper' },
  jobMarkupPct: null,
  adjustments: [],
}
const viewer = { userId: 'u-me', role: 'dev', canAccessPay: true }

describe('ChargesWindow', () => {
  it('reads the job into tiles, crew-days and lines, with the record and the stand against the revenue', async () => {
    state.read = READ
    state.fail = null
    renderWithProviders(<ChargesWindow jobId="j1" viewer={viewer} onClose={() => {}} />)
    await waitFor(() => expect(screen.getByTestId('charges-days')).toBeTruthy())
    expect(screen.getByTestId('tile-labor').textContent).toContain('$4,970')
    expect(screen.getByTestId('tile-materials').textContent).toContain('$1,778')
    expect(screen.getByTestId('tile-charges').textContent).toContain('$6,749')
    expect(screen.getByTestId('tile-premium').textContent).toContain('premium')
    expect(screen.getByTestId('crew-day-2026-04-24').textContent).toContain('Trace 8 · Zack 7.66')
    expect(screen.getByTestId('charges-save').textContent).toBe('Save 0 adjustments')
    expect((screen.getByTestId('charges-save') as HTMLButtonElement).disabled).toBe(true)
  })

  it("a day's chip set to a tech alone and a line passed through become pending adjustments that need a reason, and Save writes them", async () => {
    state.read = READ
    state.added = []
    renderWithProviders(<ChargesWindow jobId="j1" viewer={viewer} onClose={() => {}} />)
    await waitFor(() => expect(screen.getByTestId('charges-days')).toBeTruthy())
    fireEvent.change(screen.getByLabelText('The crew on Sat, Apr 25'), { target: { value: 'tech_alone' } })
    expect(screen.getByTestId('charges-save').textContent).toBe('Save 1 adjustment')
    expect((screen.getByTestId('charges-save') as HTMLButtonElement).disabled).toBe(true)
    fireEvent.change(screen.getByLabelText('Reason for Sat, Apr 25'), { target: { value: 'Zack was alone' } })
    fireEvent.click(screen.getByRole('button', { name: 'Pass through' }))
    fireEvent.change(screen.getByLabelText('Reason for Sunbelt Rentals · invoice 180856872-0001'), { target: { value: 'a rental' } })
    expect(screen.getByTestId('charges-save').textContent).toBe('Save 2 adjustments')
    expect(screen.getByTestId('tile-labor').textContent).toContain('the record')
    fireEvent.click(screen.getByTestId('charges-save'))
    await waitFor(() => expect(state.added).toHaveLength(1))
    const call = state.added[0] as { jobId: string; madeBy: string; rows: Array<{ kind: string; target: string; shape: string | null; amount: number | null; reason: string }> }
    expect(call.jobId).toBe('j1')
    expect(call.madeBy).toBe('u-me')
    expect(call.rows).toEqual([
      { key: 'day_shape:2026-04-25', kind: 'day_shape', target: '2026-04-25', shape: 'tech_alone', amount: null, reason: 'Zack was alone' },
      { key: 'line_pass_through:inv:1', kind: 'line_pass_through', target: 'inv:1', shape: null, amount: 1423.08, reason: 'a rental' },
    ])
  })

  it('a read that fails names its reason and offers Try again; a viewer without the pay gate reads only', async () => {
    state.fail = 'The job could not be read.'
    renderWithProviders(<ChargesWindow jobId="j1" viewer={viewer} onClose={() => {}} />)
    await waitFor(() => expect(screen.getByTestId('charges-error').textContent).toContain('could not be read'))
    expect(screen.getByRole('button', { name: 'Try again' })).toBeTruthy()
    state.fail = null
    state.read = READ
    renderWithProviders(<ChargesWindow jobId="j1" viewer={{ userId: 'u-a', role: 'assistant', canAccessPay: false }} onClose={() => {}} />)
    await waitFor(() => expect(screen.getAllByTestId('charges-days').length).toBeGreaterThan(0))
    expect(screen.getByText('Read only: a dev, the controller or a pay-approved master adjusts charges.')).toBeTruthy()
    expect((screen.getByLabelText('The crew on Fri, Apr 24') as HTMLSelectElement).disabled).toBe(true)
  })
})
