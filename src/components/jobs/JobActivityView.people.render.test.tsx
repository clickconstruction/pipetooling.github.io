// @vitest-environment jsdom
/**
 * The E chip on Job activity's people line (v2.6694, punch list #129): the author of the signed estimate the job came
 * from wears a small red E beside their name, added to the line when the office never put them on the team; its press
 * is a link to the estimate. No estimate: the line reads the team alone, as before.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, screen } from '@testing-library/react'

vi.mock('../../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../../test/renderSmokeMocks')
  return { supabase: makeSupabaseStub() }
})
vi.mock('../../lib/messages/messagesIo', () => ({
  loadJobMessages: vi.fn(async () => []),
  tieMessage: vi.fn(async () => {}),
  searchJobs: vi.fn(async () => []),
  loadCustomerContact: vi.fn(async () => null),
}))
vi.mock('../../hooks/useJobEstimateAuthor', () => ({ useJobEstimateAuthor: vi.fn(() => null) }))

import { useJobEstimateAuthor } from '../../hooks/useJobEstimateAuthor'
import { makeJob, renderWithProviders } from '../../test/renderSmokeMocks'
import { JobActivityView } from './JobActivityView'

afterEach(() => {
  cleanup()
  vi.mocked(useJobEstimateAuthor).mockReturnValue(null)
})

const team = [
  { user_id: 'u-luis', name: 'Luis' },
  { user_id: 'u-marcus', name: 'Marcus' },
]
function show() {
  renderWithProviders(<JobActivityView job={makeJob({ id: 'jl-1041', status: 'billed' } as never)} activity={[]} upcoming={null} viewerRole="assistant" narrow={false} teamMembers={team} />)
}

describe('Job activity’s people line with the estimate’s author', () => {
  it('reads the team alone when the job came from no estimate', () => {
    show()
    // One run of text, as the joined names were: the hosts' own tests read the crew line whole.
    expect(screen.getByText('Luis, Marcus')).toBeTruthy()
    expect(screen.queryByRole('link', { name: /Wrote estimate/ })).toBeNull()
  })
  it('adds the author with the E chip, a link to the estimate', () => {
    vi.mocked(useJobEstimateAuthor).mockReturnValue({ userId: 'u-nia', name: 'Nia', estimateId: 'e-1', estimateNumber: 1041 })
    show()
    expect(screen.getByText('Luis, Marcus, Nia')).toBeTruthy()
    const chip = screen.getByRole('link', { name: 'Wrote estimate #1041, the one this job came from. Opens it.' })
    expect(chip.textContent).toBe('E')
    expect(chip.getAttribute('href')).toBe('/estimates/1041')
    expect(chip.style.background).toBe('rgb(220, 38, 38)')
  })
  it('puts the chip on the author’s own row when they are on the team', () => {
    vi.mocked(useJobEstimateAuthor).mockReturnValue({ userId: 'u-luis', name: 'Luis', estimateId: 'e-1', estimateNumber: 1041 })
    show()
    const chip = screen.getByRole('link', { name: /Wrote estimate #1041/ })
    expect(chip.parentElement?.textContent).toBe('LuisE, Marcus')
    expect(screen.getAllByRole('link', { name: /Wrote estimate/ })).toHaveLength(1)
  })
})
