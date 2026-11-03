// @vitest-environment jsdom
/**
 * Render smoke for Projects → Job History's day window: its Card charges row counts the day's lines from
 * every card line on the job, read a page at a time (v2.6465). PostgREST stops an answer at 1,000 rows with
 * no error, so a job with more lines than that lost the newest ones before.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react'
import { ProjectsJobHistoryDayModal } from './ProjectsJobHistoryDayModal'
import { installDomShims, renderWithProviders } from '../../test/renderSmokeMocks'
import type { ProjectsJobHistoryBar } from '../../lib/projectsJobHistoryData'

type Step = { method: string; args: unknown[] }
const reads = vi.hoisted(() => [] as Array<{ table: string; steps: Step[] }>)
// A thousand card lines from August fill the first page; the day's own line is the 1,001st.
const cardLines = vi.hoisted(() => [
  ...Array.from({ length: 1000 }, (_, i) => ({ amount: -1, note: null, mercury_transactions: { posted_at: '2026-08-01T15:00:00Z', counterparty_name: `August ${i}` } })),
  { amount: -42.5, note: null, mercury_transactions: { posted_at: '2026-09-02T15:00:00Z', counterparty_name: 'Ferguson' } },
])

vi.mock('../../lib/supabase', () => {
  function makeBuilder(table: string): Record<string, unknown> {
    const steps: Step[] = []
    reads.push({ table, steps })
    const builder: Record<string, unknown> = {}
    for (const m of ['select', 'eq', 'neq', 'in', 'is', 'not', 'order', 'range', 'limit']) {
      builder[m] = (...args: unknown[]) => {
        steps.push({ method: m, args })
        return builder
      }
    }
    builder.then = (onFulfilled?: (v: unknown) => unknown, onRejected?: (e: unknown) => unknown) => {
      // PostgREST's max_rows: an answer stops at 1,000 rows, ranged or not.
      const [from, to] = (steps.find((s) => s.method === 'range')?.args ?? [0, 999]) as [number, number]
      const rows = table === 'mercury_transaction_job_allocations' ? cardLines : []
      return Promise.resolve({ data: rows.slice(from, Math.min(to, from + 999) + 1), error: null, status: 200 }).then(onFulfilled, onRejected)
    }
    return builder
  }
  return { supabase: { from: (table: string) => makeBuilder(table), rpc: (name: string) => makeBuilder(`rpc:${name}`) } }
})

installDomShims()
afterEach(cleanup)

const bar: ProjectsJobHistoryBar = {
  jobId: 'job-1',
  hcpNumber: '629',
  clickNumber: '',
  jobName: 'Rough in',
  jobAddress: '2 Draw St',
  serviceTypeId: null,
  projectId: null,
  firstWorkDateYmd: '2026-08-01',
  lastWorkDateYmd: '2026-09-02',
  openEnded: false,
  perDayCounts: new Map([
    ['2026-08-01', 1],
    ['2026-09-02', 1],
  ]),
}

describe('ProjectsJobHistoryDayModal', () => {
  it('counts the day’s card line from the second page of the job’s card lines', async () => {
    renderWithProviders(
      <ProjectsJobHistoryDayModal
        open
        onClose={() => {}}
        jobId="job-1"
        jobTitle="629 · Rough in"
        workDateYmd="2026-09-02"
        bar={bar}
        todayYmd="2026-11-03"
        authUserId="user-1"
        userRole="dev"
        onOpenEditJob={() => {}}
        onOpenJobDetail={() => {}}
      />,
    )
    const row = await screen.findByRole('button', { name: 'Card charges — expand details' })
    await waitFor(() => expect(row.textContent).toContain('$42.50'))

    // Two pages of the job's card lines, each in id order, so no line moves between pages.
    const cardReads = reads.filter((r) => r.table === 'mercury_transaction_job_allocations')
    expect(cardReads.map((r) => r.steps.filter((s) => s.method === 'range').map((s) => s.args))).toEqual([[[0, 999]], [[1000, 1999]]])
    for (const r of cardReads) {
      expect(r.steps.filter((s) => s.method === 'eq').map((s) => s.args)).toEqual([['job_id', 'job-1']])
      expect(r.steps.filter((s) => s.method === 'order').map((s) => s.args)).toEqual([['id']])
    }

    // The detail lists the day's line and none of August's.
    fireEvent.click(row)
    expect(await screen.findByText('Ferguson')).toBeTruthy()
    expect(screen.queryByText('August 0')).toBeNull()
  })
})
