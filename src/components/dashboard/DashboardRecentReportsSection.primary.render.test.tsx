// @vitest-environment jsdom
/**
 * v2.2222: primaries only reach their own Account-Man jobs (v2.2177 RLS), and
 * Recent Reports also lists reports on jobs that list them as superintendent and
 * the reports they wrote on any job — so the section must not offer them the
 * job-detail door (clickable job name + "Job detail" chip). Other roles keep both.
 *
 * 2026-11-19: a primary reads their own jobs' reports alone. The database decides
 * (migration 20261119040000_primary_scope_reports, held by the primary-scope-reports
 * SQL bed); the card lists what `list_reports_with_job_info` answers, counts from that
 * list alone, and says over it whose reports those are.
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
  job_display_name: 'Mike Holmby',
  job_hcp_number: '473',
  job_address: null,
}
/** What list_reports_with_job_info answers; the empty-state case empties it. */
const listed: { rows: unknown[] } = { rows: [report] }

vi.mock('../../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../../test/renderSmokeMocks')
  const stub = makeSupabaseStub() as unknown as { rpc: (name: string) => unknown }
  const origRpc = stub.rpc.bind(stub)
  stub.rpc = (name: string) =>
    name === 'list_reports_with_job_info' ? Promise.resolve({ data: listed.rows, error: null }) : origRpc(name)
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
  await waitFor(() => expect(screen.getByText(/Mike Holmby/)).toBeTruthy())
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

describe('DashboardRecentReportsSection — no report yet (punch list #184, sweep C)', () => {
  it('the empty list links to Jobs → Reports, where New report is', async () => {
    listed.rows = []
    try {
      renderWithProviders(<DashboardRecentReportsSection authUserId="me" role="assistant" />)
      await waitFor(() => expect(screen.getByText('Recent Reports')).toBeTruthy())
      fireEvent.click(screen.getByText('Recent Reports'))
      const empty = await waitFor(() => {
        const el = document.querySelector('[data-empty-state]') as HTMLElement | null
        expect(el).not.toBeNull()
        return el as HTMLElement
      })
      expect(empty.textContent).toBe('No reports yet. Reports is where you write one.')
      expect(screen.getByRole('link', { name: 'Reports' }).getAttribute('href')).toBe('/jobs?tab=reports')
    } finally {
      listed.rows = [report]
    }
  })
})

describe('DashboardRecentReportsSection — a primary reads their own jobs\' reports (2026-11-19)', () => {
  const second = { ...report, id: 'r2', job_ledger_id: 'j2', job_display_name: 'Laurel Field Bathroom Rough', created_by_name: 'Abraham' }

  it('the counts are the list the database answered, and no more', async () => {
    listed.rows = [report, second]
    const counts: Array<{ listed: number; fresh: number } | null> = []
    try {
      renderWithProviders(<DashboardRecentReportsSection authUserId="me" role="primary" onCounts={(c) => counts.push(c)} />)
      await waitFor(() => expect(counts[counts.length - 1]).toEqual({ listed: 2, fresh: 2 }))
      fireEvent.click(screen.getByText('Recent Reports'))
      await waitFor(() => expect(screen.getByText(/Laurel Field Bathroom Rough/)).toBeTruthy())
      expect(screen.getByLabelText('2 new reports')).toBeTruthy()
      expect(screen.getByRole('button', { name: 'Mark 2 opened' })).toBeTruthy()
      expect(document.querySelectorAll('li').length).toBe(2)
    } finally {
      listed.rows = [report]
    }
  })

  it('the card says whose reports a primary reads, and says nothing to the office', async () => {
    renderWithProviders(<DashboardRecentReportsSection authUserId="me" role="primary" />)
    await waitFor(() => expect(screen.getByText('Recent Reports')).toBeTruthy())
    fireEvent.click(screen.getByText('Recent Reports'))
    await waitFor(() => expect(screen.getByText(/Mike Holmby/)).toBeTruthy())
    expect(document.querySelector('[data-reports-scope]')?.textContent).toBe('You see reports on jobs where you are the account manager or the superintendent, and reports you wrote.')
  })

  it('the office reads the list with no line', async () => {
    renderWithProviders(<DashboardRecentReportsSection authUserId="me" role="assistant" />)
    await waitFor(() => expect(screen.getByText(/Mike Holmby/)).toBeTruthy())
    expect(document.querySelector('[data-reports-scope]')).toBeNull()
  })

  it('a primary with no report on their jobs reads whose reports the list waits for', async () => {
    listed.rows = []
    try {
      renderWithProviders(<DashboardRecentReportsSection authUserId="me" role="primary" />)
      await waitFor(() => expect(screen.getByText('Recent Reports')).toBeTruthy())
      fireEvent.click(screen.getByText('Recent Reports'))
      const empty = await waitFor(() => {
        const el = document.querySelector('[data-empty-state]') as HTMLElement | null
        expect(el).not.toBeNull()
        return el as HTMLElement
      })
      expect(empty.textContent).toBe('No reports on your jobs yet. Reports is where you write one.')
    } finally {
      listed.rows = [report]
    }
  })
})
