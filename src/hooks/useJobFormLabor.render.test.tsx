// @vitest-environment jsdom
/**
 * v2.3871: the job form's labor loader as a hook. Pins the seam — no job means nothing loads;
 * with a job the team row is the job's own out of the team-labor read, and the sub-labor half
 * comes back as a count and a total through the shared cost kernel (a job with no sheets reads
 * 0 / $0, not null); a failed team read marks the error and clears the row.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, screen } from '@testing-library/react'
import { renderSettled, renderWithProviders } from '../test/renderSmokeMocks'
import { useJobFormLabor } from './useJobFormLabor'

vi.mock('../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../test/renderSmokeMocks')
  return { supabase: makeSupabaseStub() }
})

const teamRows: Array<Record<string, unknown>> = []
let teamFails = false
vi.mock('../utils/teamLabor', () => ({
  loadTeamLaborData: async () => {
    if (teamFails) throw new Error('boom')
    return teamRows
  },
}))

vi.mock('../utils/errorHandling', () => ({
  withSupabaseRetry: async (op: () => Promise<{ data: unknown; error: unknown }>) => {
    const r = await op()
    if (r.error) throw r.error
    return r.data
  },
}))

function Probe({ jobId }: { jobId: string | null }) {
  const l = useJobFormLabor(jobId)
  return (
    <div data-testid="labor">
      {`team:${l.editJobTeamLaborLoading ? 'loading' : l.editJobTeamLaborError ? 'error' : l.editJobTeamLaborRow ? `row ${String((l.editJobTeamLaborRow as { jobId: string }).jobId)}` : 'none'}`}
      {' · '}
      {`sub:${l.editJobSubLaborLoading ? 'loading' : l.editJobSubLaborError ? 'error' : l.editJobSubLaborData ? `${l.editJobSubLaborData.count}/${l.editJobSubLaborData.total}` : 'none'}`}
    </div>
  )
}

afterEach(() => {
  cleanup()
  teamRows.length = 0
  teamFails = false
})

describe('useJobFormLabor', () => {
  it('with no job, nothing loads and both halves read none', async () => {
    await renderSettled(<Probe jobId={null} />, { loaded: () => screen.findByTestId('labor') })
    expect(screen.getByTestId('labor').textContent).toBe('team:none · sub:none')
  })

  it('with a job, the team row is the job’s own and the sub-labor half is a count and a total (0 / 0 with no sheets)', async () => {
    teamRows.push({ jobId: 'other', hours: 1 }, { jobId: 'job-1', hours: 8 })
    renderWithProviders(<Probe jobId="job-1" />)
    await screen.findByText('team:row job-1 · sub:0/0')
  })

  it('a failed team read marks the error and clears the row; the sub half still answers', async () => {
    teamFails = true
    renderWithProviders(<Probe jobId="job-1" />)
    await screen.findByText('team:error · sub:0/0')
  })
})
