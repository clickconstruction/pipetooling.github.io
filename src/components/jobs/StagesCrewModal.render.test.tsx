// @vitest-environment jsdom
/**
 * Everyone on the job with the estimate's author (v2.6694, punch list #129): the Pipeline's crew modal lists the author
 * of the signed estimate the job came from with the live crew, the E chip beside their name and *wrote the estimate*
 * in place of Active when the office never put them on the team.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, screen } from '@testing-library/react'

vi.mock('../../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../../test/renderSmokeMocks')
  return { supabase: makeSupabaseStub() }
})
vi.mock('../../utils/teamLabor', () => ({ fetchTeamLaborBreakdownForJob: vi.fn(async () => []) }))
vi.mock('../../contexts/PersonDeskContext', () => ({ usePersonDeskContext: () => ({ canOpen: false, open: vi.fn() }) }))
vi.mock('../../hooks/useIsMobile', () => ({ useIsMobile: () => false }))
vi.mock('../../hooks/useJobEstimateAuthor', () => ({ useJobEstimateAuthor: vi.fn(() => null) }))

import { useJobEstimateAuthor } from '../../hooks/useJobEstimateAuthor'
import { makeJob, renderWithProviders } from '../../test/renderSmokeMocks'
import { StagesCrewModal } from './StagesCrewModal'

afterEach(() => {
  cleanup()
  vi.mocked(useJobEstimateAuthor).mockReturnValue(null)
})

const job = makeJob({
  id: 'jl-1041',
  hcp_number: '1041',
  job_name: 'Whitfield water heater',
  team_members: [{ id: 't1', job_id: 'jl-1041', user_id: 'u-luis', users: { name: 'Luis', archived_at: null, role: 'primary' } }],
} as never)

describe('the crew modal with the estimate’s author', () => {
  it('lists the team alone when the job came from no estimate', async () => {
    renderWithProviders(<StagesCrewModal job={job} onClose={() => {}} />)
    expect(await screen.findByText('Luis')).toBeTruthy()
    expect(screen.queryByText('wrote the estimate')).toBeNull()
  })
  it('lists the author with the E chip and *wrote the estimate*', async () => {
    vi.mocked(useJobEstimateAuthor).mockReturnValue({ userId: 'u-nia', name: 'Nia', estimateId: 'e-1', estimateNumber: 1041 })
    renderWithProviders(<StagesCrewModal job={job} onClose={() => {}} />)
    expect(await screen.findByText('Nia')).toBeTruthy()
    expect(screen.getByText('wrote the estimate')).toBeTruthy()
    expect(screen.getByText('Active')).toBeTruthy()
    const chip = screen.getByRole('link', { name: /Wrote estimate #1041/ })
    expect(chip.getAttribute('href')).toBe('/estimates/1041')
  })
})
