// @vitest-environment jsdom
/**
 * v2.2222: primaries only reach their own Account-Man jobs (v2.2177 RLS), and
 * Recent Reports spans every job — so the section must not offer them the
 * job-detail door (clickable job name + "Job detail" chip). Other roles keep both.
 */
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, waitFor } from '@testing-library/react'

const report = {
  id: 'r1',
  template_name: 'Status Report',
  created_by_user_id: 'u1',
  created_by_name: 'Abraham',
  created_at: '2026-08-22T18:16:00Z',
  field_values: { 'How complete is the job?': '100' },
  job_ledger_id: 'j1',
  project_id: null,
  job_display_name: 'Mike Holub',
  job_hcp_number: '473',
  job_address: null,
}

vi.mock('../../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../../test/renderSmokeMocks')
  const stub = makeSupabaseStub() as unknown as { rpc: (name: string) => unknown }
  const origRpc = stub.rpc.bind(stub)
  stub.rpc = (name: string) =>
    name === 'list_reports_with_job_info' ? Promise.resolve({ data: [report], error: null }) : origRpc(name)
  return { supabase: stub }
})

vi.mock('../../hooks/useAuth', async () => {
  const { useAuthModuleMock } = await import('../../test/renderSmokeMocks')
  return useAuthModuleMock()
})

import { DashboardRecentReportsSection } from './DashboardRecentReportsSection'
import { renderWithProviders } from '../../test/renderSmokeMocks'
import type { UserRole } from '../../hooks/useAuth'

async function renderExpandedAs(role: UserRole) {
  renderWithProviders(<DashboardRecentReportsSection authUserId="me" role={role} />)
  await waitFor(() => expect(screen.getByText('Recent Reports')).toBeTruthy())
  fireEvent.click(screen.getByText('Recent Reports'))
  await waitFor(() => expect(screen.getByText(/Mike Holub/)).toBeTruthy())
  fireEvent.click(screen.getByText(/Abraham/))
  await waitFor(() => expect(screen.getByText(/How complete is the job/)).toBeTruthy())
}

describe('DashboardRecentReportsSection — primary job-detail gating', () => {
  it('primary: job name is plain text and there is no Job detail chip', async () => {
    await renderExpandedAs('primary')
    expect(screen.queryByRole('button', { name: /Job details/ })).toBeNull()
    expect(screen.queryByText('Job detail')).toBeNull()
  })
})
