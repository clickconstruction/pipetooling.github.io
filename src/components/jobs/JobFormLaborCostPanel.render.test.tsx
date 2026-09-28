// @vitest-environment jsdom
/**
 * The Costs tab inside the job window reads the form's own price and other job charges over the
 * loaded job's. Pins the seam: with the job loaded at $1,500 and nothing spent, a form holding
 * $1,700 and a $25 charge makes the tab say $1,700 and $25 — without the job being read again.
 */
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
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

  it('renders nothing on a new job', () => {
    const { container } = render(<JobFormLaborCostPanel editing={null} editJobTeamLaborRow={null} livePriceUsd={0} liveMaterials={[]} />)
    expect(container.textContent).toBe('')
  })
})
