// @vitest-environment jsdom
/**
 * The Costs tab inside the job window reads the form's own price and other job charges over the
 * loaded job's. Pins the seam: with the job loaded at $1,500 and nothing spent, a form holding
 * $1,700 and a $25 charge makes the tab say $1,700 and $25 — without the job being read again.
 */
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { renderSettled, useAuthModuleMock } from '../../test/renderSmokeMocks'
import { JobFormLaborCostPanel } from './JobFormLaborCostPanel'
import type { JobWithDetails } from '../../types/jobWithDetails'

const reads = vi.hoisted(() => ({ n: 0 }))

vi.mock('../../hooks/useAuth', async () => useAuthModuleMock())
vi.mock('../../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../../test/renderSmokeMocks')
  return { supabase: makeSupabaseStub() }
})
vi.mock('../../hooks/useJobChargesTimelineInputs', () => ({
  useJobChargesTimelineInputs: () => {
    reads.n += 1
    return { kind: 'ready', inputs: { chargeEvents: [], valueEvents: [], paymentEvents: [], revenue: 1_500, fallbackPercent: null, teamHours: 0, cardChargesExcluded: false } }
  },
}))

const job = { id: 'job-1', job_name: 'ZZ test', status: 'working', revenue: 1_500, bid_id: null, linkedBid: null, materials: [], payments: [] } as unknown as JobWithDetails

// The cost chart sizes itself with a ResizeObserver, which jsdom does not have.
beforeAll(() => {
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} })
})
afterEach(() => {
  cleanup()
  reads.n = 0
})

describe('JobFormLaborCostPanel — the Costs tab follows the form', () => {
  it('shows the form’s price, not the loaded job’s', async () => {
    await renderSettled(<JobFormLaborCostPanel editing={job} editJobTeamLaborRow={null} livePriceUsd={1_700} liveMaterials={[]} />, { loaded: () => screen.findAllByText(/\$1,700/) })
    expect(screen.queryByText(/\$1,500/)).toBeNull()
  })

  it('counts an other job charge typed in the form as money spent', async () => {
    await renderSettled(<JobFormLaborCostPanel editing={job} editJobTeamLaborRow={null} livePriceUsd={1_700} liveMaterials={[{ id: 'new', description: 'ZZ test charge', amount: 25 }]} />, { loaded: () => screen.findAllByText(/\$1,700/) })
    expect(screen.getAllByText(/\$25/).length).toBeGreaterThan(0)
  })

  it('prints the Costs tab as a packet when the window hands it the lines (v2.5749)', async () => {
    const written: string[] = []
    const fakeWindow = { document: { write: (html: string) => written.push(html), close: () => {} }, focus: () => {}, print: () => {}, onafterprint: null as null | (() => void) }
    const open = vi.spyOn(window, 'open').mockReturnValue(fakeWindow as unknown as Window)
    const packet = {
      supplyInvoiceTotal: 0, supplyInvoiceRpcFailed: false, supplyInvoiceLines: [],
      mercuryCardTotal: 0, mercuryFetchFailed: false, mercuryAllocLines: [],
      tallyPartsTotal: 0, tallyFetchFailed: false, tallyPartLines: [],
      teamLabor: { loading: false, error: false, row: null }, subLabor: { loading: false, error: false, data: null },
      otherCharges: [{ id: 'm1', description: 'Permit', amount: 25 }],
    }
    await renderSettled(<JobFormLaborCostPanel editing={job} editJobTeamLaborRow={null} livePriceUsd={1_700} liveMaterials={[]} packet={packet} />, { loaded: () => screen.findByTestId('costs-print') })
    fireEvent.click(screen.getByTestId('costs-print'))
    expect(open).toHaveBeenCalledWith('', '_blank')
    expect(written).toHaveLength(1)
    expect(written[0]).toContain('<title>ZZ test · Job costs</title>')
    expect(written[0]).toContain('<div>by Smoke Dev</div>')
    expect(written[0]).toContain('<tr><td>Permit</td><td class="num">$25.00</td></tr>')
    open.mockRestore()
  })

  it('shows no Print without the lines behind the money table', async () => {
    await renderSettled(<JobFormLaborCostPanel editing={job} editJobTeamLaborRow={null} livePriceUsd={1_700} liveMaterials={[]} />, { loaded: () => screen.findAllByText(/\$1,700/) })
    expect(screen.queryByTestId('costs-print')).toBeNull()
  })

  it('renders nothing on a new job', () => {
    const { container } = render(<JobFormLaborCostPanel editing={null} editJobTeamLaborRow={null} livePriceUsd={0} liveMaterials={[]} />)
    expect(container.textContent).toBe('')
  })
})
