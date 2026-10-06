// @vitest-environment jsdom
/**
 * The History tab's lien timeline (v2.3879, punch list #32 PR 3): the strip with the demand
 * letter and the Waiting-on line for a job that owes money, nothing for a paid job with no
 * paper out.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, waitFor } from '@testing-library/react'
import JobHistoryLienTimeline from './JobHistoryLienTimeline'
import { makeJob } from '../../test/renderSmokeMocks'
import { setLienTimelineView } from '../../hooks/useLienTimelineView'

const rows: Record<string, unknown[]> = {}
vi.mock('../../lib/supabase', () => {
  const builder = (table: string) => {
    const b: Record<string, unknown> = {}
    const chain = () => b
    for (const m of ['select', 'eq', 'is', 'in', 'order', 'not', 'gte', 'lte']) b[m] = chain
    b.maybeSingle = () => Promise.resolve({ data: (rows[table] ?? [])[0] ?? null, error: null })
    b.then = (ok: (v: unknown) => unknown) => Promise.resolve({ data: rows[table] ?? [], error: null }).then(ok)
    return b
  }
  return { supabase: { from: (t: string) => builder(t), rpc: () => Promise.resolve({ data: [], error: null }) } }
})
vi.mock('../../hooks/useForecastWorkMonths', () => ({ useForecastWorkMonths: () => ({ byJob: null, loading: false }) }))
vi.mock('../../utils/dateUtils', async (orig) => ({ ...(await orig<typeof import('../../utils/dateUtils')>()), todayYmdInAppTz: () => '2026-09-27' }))

const letter = { id: 'd1', job_id: 'job-1', amount: 8940, created_at: '2026-09-14T16:00:00Z', created_by: null, deadline_date: '2026-09-28', debtor_party: 'gc', exhibits: [], fields: {}, invoice_ids: [], recipient_address: '', recipient_email: '', recipient_name: 'Dudley Mason', sent_at: '2026-09-14T16:10:00Z', sent_method: 'certified', tracking_number: '', voided_at: null }

beforeEach(() => {
  for (const k of Object.keys(rows)) delete rows[k]
  setLienTimelineView('steps')
})

describe('JobHistoryLienTimeline', () => {
  it('draws the strip with the demand letter and the Waiting-on line for a sub job that owes money', async () => {
    rows.job_demand_letters = [letter]
    rows.customer_addresses = [{ property_kind: 'non_residential' }]
    const job = makeJob({ id: 'job-1', revenue: 8940, payments_made: 0, gc_customer_id: 'gc-1', customer_address_id: 'addr-1', last_work_date: '2026-07-30' })
    const { container } = render(<JobHistoryLienTimeline job={job} />)
    await waitFor(() => expect(container.querySelector('[data-job-history-lien-timeline]')).toBeTruthy())
    // The calendar, fixed (v2.4652): no Steps · Windows switch, the verdict band first, the letter as a row, whose move under the live rows.
    expect(container.querySelector('[data-lien-timeline]')?.getAttribute('data-view')).toBe('windows')
    expect(container.querySelector('[data-lien-timeline-view]')).toBeNull()
    const verdict = container.querySelector('[data-lien-timeline-verdict]')!
    const chart = container.querySelector('[data-lien-timeline-windows]')!
    expect(verdict.compareDocumentPosition(chart) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(container.querySelector('[data-lien-timeline-window="demand"]')?.textContent).toContain('reply by Sep 28')
    expect(container.querySelector('[data-lien-timeline-waiting]')?.textContent).toContain('the GC')
    expect(container.querySelector('[data-lien-timeline-window="affidavit"] [data-lien-timeline-move="ours"]')).toBeTruthy()
  })

  it('draws nothing for a paid job with no filing and no letter', async () => {
    const job = makeJob({ id: 'job-2', revenue: 500, payments_made: 500, gc_customer_id: 'gc-1', customer_address_id: null })
    const { container } = render(<JobHistoryLienTimeline job={job} />)
    await new Promise((r) => setTimeout(r, 20))
    expect(container.querySelector('[data-job-history-lien-timeline]')).toBeNull()
  })
})
