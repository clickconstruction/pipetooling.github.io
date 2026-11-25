// @vitest-environment jsdom
/**
 * Punch list #125: the Pipeline row's waiting dot, from the database's rows to the drawn bubble. Until v2.8577 no
 * test crossed that whole path: the kernel's test fed lines whose job was a bare word, and the row's tests seeded the
 * map with `job.id`, so nobody saw that the board's read keys a dot by job key (`pipeline:<id>`) while a row asks by
 * its bare ledger id. Here the hook reads through the real loader (`loadBoardDotRows`) over a fake client that
 * answers `contacts` and `messages` rows as the database does, and a real Pipeline customer line is drawn from the
 * hook's own map. Dana is the mockups' made-up customer.
 */
import { cleanup, waitFor } from '@testing-library/react'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'

vi.mock('../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../test/renderSmokeMocks')
  return { supabase: makeSupabaseStub() }
})
vi.mock('./useAuth', async () => {
  const { useAuthModuleMock } = await import('../test/renderSmokeMocks')
  return useAuthModuleMock()
})

import { renderJobCustomerLine, type StagesRowRenderContext } from '../components/jobs/jobsStagesRowShared'
import { loadBoardDotRows, type BoardDotRows } from '../lib/messages/boardDotsIo'
import { installDomShims, makeJob, renderWithProviders } from '../test/renderSmokeMocks'
import type { JobWithDetails } from '../types/jobWithDetails'
import { useBoardDots } from './useBoardDots'

beforeAll(installDomShims)
afterEach(cleanup)

const LEDGER = '5b1f0c1e-0000-4000-8000-00000000a125'
const BID = '7c2e1d2f-0000-4000-8000-00000000b125'

const CONTACT = { id: 'c-dana', kind: 'customer', name: 'Dana Whitfield', goes_by: null, state: 'waiting', snoozed_until: null, has_user_id: null, has_since: null, has_how: null }
const message = (tie: { jobs_ledger_id?: string; bid_id?: string }) => ({
  id: 'm-ask',
  contact_id: 'c-dana',
  channel_id: null,
  bid_id: tie.bid_id ?? null,
  project_id: null,
  jobs_ledger_id: tie.jobs_ledger_id ?? null,
  channel: 'text',
  direction: 'in',
  who_user_id: null,
  who_text: '',
  at: '2026-10-12T14:05:00Z',
  subject: null,
  body: 'Can you do Thursday?',
  optout_line: null,
  back_on: null,
  back_by: null,
  back_words: null,
  back_done_at: null,
  mailbox: null,
  tied_by: null,
  auto: false,
  invitation: null,
  history: null,
})

/** A client that answers the loader's two reads with these rows, whatever the filters. */
function clientWith(messages: unknown[]) {
  const answer = (data: unknown[]) => {
    const b: Record<string, unknown> = {}
    for (const m of ['select', 'eq', 'in', 'order', 'limit']) b[m] = () => b
    b.then = (ok?: (v: unknown) => unknown, bad?: (e: unknown) => unknown) => Promise.resolve({ data, error: null }).then(ok, bad)
    return b
  }
  return { from: (table: string) => answer(table === 'contacts' ? [CONTACT] : messages) }
}

/** The board's read over those rows: the real loader, held still so the hook reads once. */
const loadOf = (messages: unknown[]) => {
  const client = clientWith(messages)
  return vi.fn(() => loadBoardDotRows(client))
}

/** A board of one row: the hook's own map goes on the row's context, and the row asks with `job.id`. */
function Board({ job, load }: { job: JobWithDetails; load: () => ReturnType<typeof loadBoardDotRows> }) {
  const { dotByJobId } = useBoardDots({ enabled: true, load, todayYmd: '2026-10-12', nowIso: '2026-10-12T20:00:00Z' })
  const ctx = { authRole: 'assistant', loadJobs: vi.fn(), showToast: vi.fn(), onOpenCustomerDoor: vi.fn(), boardDotByJobId: dotByJobId } as unknown as StagesRowRenderContext
  return <div data-dots={dotByJobId.size}>{renderJobCustomerLine(ctx, job)}</div>
}

const bubble = () => document.querySelector('[data-messages-button="cust-dana"]') as HTMLButtonElement
const dana = (id?: string) => makeJob({ ...(id ? { id } : {}), customer_id: 'cust-dana', customer_name: 'Dana Whitfield', customer_phone: '(210) 555-0188' })

describe('the Pipeline row’s waiting dot, from the rows the database answers', () => {
  it('lights on the job its customer’s unanswered line is tied to, and says Nobody has answered', async () => {
    const load = loadOf([message({ jobs_ledger_id: LEDGER })])
    renderWithProviders(<Board job={dana(LEDGER)} load={load} />)
    await waitFor(() => expect(bubble().querySelector('[data-messages-dot]')).not.toBeNull())
    expect(bubble().title).toBe('Open Dana Whitfield’s messages · Dana · text · 9:05 AM · Can you do Thursday? · Nobody has answered.')
    expect(load).toHaveBeenCalledTimes(1)
  })

  it('stays dark on another Pipeline job, though the map holds a dot', async () => {
    renderWithProviders(<Board job={dana()} load={loadOf([message({ jobs_ledger_id: LEDGER })])} />)
    await waitFor(() => expect(document.querySelector('[data-dots="1"]')).not.toBeNull())
    expect(bubble().querySelector('[data-messages-dot]')).toBeNull()
  })

  it('a line tied to a bid lights nothing on the Pipeline, even on a job that shares the bid’s id', async () => {
    const load = loadOf([message({ bid_id: BID })])
    renderWithProviders(<Board job={dana(BID)} load={load} />)
    await waitFor(() => expect(load).toHaveBeenCalledTimes(1))
    // The read has landed: its one line made a dot under the bid's key, and the Pipeline's map left it out.
    const read = (await load.mock.results[0]!.value) as BoardDotRows
    expect(read.lines.map((l) => l.jobId)).toEqual([`bid:${BID}`])
    await waitFor(() => expect(document.querySelector('[data-dots="0"]')).not.toBeNull())
    expect(bubble().querySelector('[data-messages-dot]')).toBeNull()
  })
})
