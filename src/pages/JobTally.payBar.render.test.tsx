// @vitest-environment jsdom
/**
 * Punch list #72, the pay bar's gate as JobTally wires it (v2.5118). The Team queue gets
 * `canMarkPayroll` from the value My card's Mark payroll uses (`canMarkTallyPayroll` over
 * `usePeopleAccess`): an assistant gets false, so no bar; a pay-approved master, a controller and a
 * dev get true. The queue is a probe here; its own smoke covers the bar.
 */
import { describe, expect, it, vi } from 'vitest'
import { screen } from '@testing-library/react'
import { renderWithProviders } from '../test/renderSmokeMocks'

let mockRole = 'assistant'
let mockCanAccessPay = false

vi.mock('../hooks/useAuth', async () => {
  const { useAuthModuleMock } = await import('../test/renderSmokeMocks')
  return useAuthModuleMock({})
})
vi.mock('../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../test/renderSmokeMocks')
  const stub = makeSupabaseStub()
  return {
    supabase: {
      ...stub,
      // JobTally reads its own role from `users`; everything else reads empty.
      from: (table: string) =>
        table === 'users'
          ? { select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: { role: mockRole }, error: null }) }) }) }
          : stub.from(),
    },
  }
})
vi.mock('../hooks/usePeopleAccess', () => ({ usePeopleAccess: () => ({ canAccessPay: mockCanAccessPay }) }))
vi.mock('../components/tally/TallyTeamQueue', () => ({
  TallyTeamQueue: (p: { canMarkPayroll?: boolean }) => (
    <div data-testid="team-queue-probe" data-can-mark-payroll={String(p.canMarkPayroll === true)} />
  ),
}))

const { default: JobTally } = await import('./JobTally')

async function probeFor(role: string, canAccessPay: boolean): Promise<string | null> {
  mockRole = role
  mockCanAccessPay = canAccessPay
  const view = renderWithProviders(<JobTally />)
  const probe = await screen.findByTestId('team-queue-probe')
  const value = probe.getAttribute('data-can-mark-payroll')
  view.unmount()
  return value
}

describe('JobTally → the Team queue’s pay bar gate', () => {
  it('an assistant’s queue may not mark payroll, so it draws no bar', async () => {
    expect(await probeFor('assistant', false)).toBe('false')
  })

  it('a pay-approved master’s and a dev’s queue may', async () => {
    expect(await probeFor('master_technician', true)).toBe('true')
    expect(await probeFor('dev', false)).toBe('true')
  })

  it('a master who is not pay-approved may not', async () => {
    expect(await probeFor('master_technician', false)).toBe('false')
  })
})
