// @vitest-environment jsdom
/**
 * Render smoke for the Hiring tab's Try-out stage (v2.3627): Try out is offered in a helper
 * column only, and a card on a try-out sits in its own stage with Hire and Pass.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react'
import { renderWithProviders } from '../../test/renderSmokeMocks'
import TeamProspectsTab from './TeamProspectsTab'

vi.mock('../../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../../test/renderSmokeMocks')
  const stub = makeSupabaseStub() as { from: (table: string) => unknown }
  const base = { master_user_id: 'm1', created_by: 'm1', phone_number: null, trade: null, source: null, notes: null, last_contact: null, created_at: '2026-09-01', updated_at: null, rating_ability: null, rating_drive: null, rating_integrity: null, links: [] }
  const tables: Record<string, unknown[]> = {
    team_prospect_roles: [
      { id: 'helper', name: 'Helper', position: 1, created_at: null },
      { id: 'office', name: 'Office Manager', position: 2, created_at: null },
    ],
    team_prospects: [
      { ...base, id: 'c1', name: 'Austin Helper', email: 'austin@example.com', status: 'active', rank_order: 1, role_id: 'helper' },
      { ...base, id: 'c2', name: 'Olive Office', email: 'olive@example.com', status: 'active', rank_order: 1, role_id: 'office' },
      { ...base, id: 'c3', name: 'Bryan Trial', email: 'bryan@example.com', status: 'trial', rank_order: 2, role_id: 'helper', trial_user_id: 'u9', trial_started_at: '2026-09-13T01:30:00Z' },
    ],
  }
  // v2.3715: the Try-out tally — two leaders said no, so the card nudges to pass and offers Keep trying.
  const tally = [
    {
      prospect_id: 'c3',
      helper_user_id: 'u9',
      deferred_at: null,
      deferred_by: null,
      deferred_by_name: null,
      days: [
        { work_date: '2026-09-15', clocked: true, open: false, job_id: 'j1', hcp_number: '258', click_number: null, job_name: 'Oak St', customer_name: null, leaders: [{ user_id: 'mike', name: 'Mike Ortiz', role: 'master_technician' }] },
        { work_date: '2026-09-16', clocked: true, open: false, job_id: 'j1', hcp_number: '258', click_number: null, job_name: 'Oak St', customer_name: null, leaders: [{ user_id: 'jake', name: 'Jake Sub', role: 'subcontractor' }] },
      ],
      verdicts: [
        { leader_user_id: 'mike', leader_name: 'Mike Ortiz', leader_role: 'master_technician', work_date: '2026-09-15', verdict: 'no', note: 'late twice', updated_at: '2026-09-15T23:00:00Z' },
        { leader_user_id: 'jake', leader_name: 'Jake Sub', leader_role: 'subcontractor', work_date: '2026-09-16', verdict: 'no', note: null, updated_at: '2026-09-16T23:00:00Z' },
      ],
    },
  ]
  ;(stub as unknown as { rpc: unknown }).rpc = () => ({
    then: (ok: (v: unknown) => unknown, ko?: (e: unknown) => unknown) => Promise.resolve({ data: tally, error: null }).then(ok, ko),
  })
  const realFrom = stub.from.bind(stub)
  stub.from = (table: string) => {
    const rows = tables[table]
    if (!rows) return realFrom(table)
    const builder: Record<string, unknown> = {}
    for (const m of ['select', 'order', 'eq', 'in', 'is']) builder[m] = () => builder
    builder.then = (ok: (v: unknown) => unknown) => Promise.resolve({ data: rows, error: null, count: rows.length }).then(ok)
    return builder
  }
  return { supabase: stub }
})

afterEach(cleanup)

describe('TeamProspectsTab — Try-out stage', () => {
  it('offers Try out in a helper column only, and keeps a trial card off the Screen board', async () => {
    renderWithProviders(<TeamProspectsTab authUserId="m1" isDev={false} resolveMasterId={async () => 'm1'} />)
    await waitFor(() => expect(screen.getByText('Austin Helper')).toBeTruthy())
    expect(screen.getByText('Olive Office')).toBeTruthy()
    expect(screen.getAllByRole('button', { name: 'Try out' })).toHaveLength(1)
    expect(screen.queryByText('Bryan Trial')).toBeNull()
  })

  it('shows the trial card on the Try-out stage with Hire and Pass, dated by the company calendar', async () => {
    renderWithProviders(<TeamProspectsTab authUserId="m1" isDev={false} resolveMasterId={async () => 'm1'} />)
    await waitFor(() => expect(screen.getByText('Austin Helper')).toBeTruthy())
    fireEvent.click(screen.getByRole('tab', { name: /Try-out/ }))
    expect(screen.getByText('Bryan Trial')).toBeTruthy()
    expect(screen.getByText('on trial since Sep 12')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Hire' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Pass' })).toBeTruthy()
  })

  it('shows the tally by name, the nudge, and Keep trying when the nudge asks (v2.3715)', async () => {
    renderWithProviders(<TeamProspectsTab authUserId="m1" isDev={false} resolveMasterId={async () => 'm1'} />)
    await waitFor(() => expect(screen.getByText('Austin Helper')).toBeTruthy())
    fireEvent.click(screen.getByRole('tab', { name: /Try-out/ }))
    await waitFor(() => expect(screen.getByTestId('trial-tally')).toBeTruthy())
    expect(screen.getByText('2 days worked · 2 leaders')).toBeTruthy()
    expect(screen.getByText('Mike Ortiz')).toBeTruthy()
    expect(screen.getByText('“late twice”')).toBeTruthy()
    expect(screen.getByText('sub')).toBeTruthy()
    expect(screen.getByText('2 said no — pass?')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Keep trying' })).toBeTruthy()
  })
})
