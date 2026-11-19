// @vitest-environment jsdom
/**
 * The Lien desk and ZZ test jobs (punch list #61, PR 3): a ZZ job leaves all four lists (the due months, the
 * items, the affidavit and retainage windows) and the jobs right after the jobs join, by the joined rows' own
 * names, before any queue is built. Without the option the desk reads as before. Made-up jobs, light mode.
 */
import { describe, expect, it, vi } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'

const month = (jobId: string) => ({
  job_id: jobId, work_month: '2026-08', approved_hours: 10, deadline: '2026-10-15', noticed: false, open_balance: 500,
  customer_id: 'c1', gc_customer_id: 'gc-1', property_kind: 'commercial', has_owner: true, desk_item_id: null, desk_status: null, desk_months: null,
})
const RPC: Record<string, unknown[]> = {
  list_lien_notice_months: [month('A'), month('Z')],
  list_lien_affidavit_windows: [
    // Inside the desk's 30-day lead from the test's 2026-10-09: since v2.7261 the desk reads 180 days and keeps a later
    // row only on a job with a started paper, so a Nov 15 day with no draft is rightly left off.
    { job_id: 'Y', last_month: '2026-07', deadline: '2026-10-15', is_sub: true, noticed: false, filed: false, open_balance: 300, customer_id: 'c1', gc_customer_id: 'gc-1', property_kind: 'commercial', has_owner: true },
  ],
  list_lien_retainage_windows: [
    { job_id: 'Z', retainage_held: 100, contract_ended_on: null, contract_ended_how: null, deadline: null, noticed: false, open_balance: 100, customer_id: 'c1', gc_customer_id: 'gc-1', property_kind: 'commercial', has_owner: true },
  ],
}
// A reader that answers an error instead of rows, by name: PostgREST's answer for a function that is not there yet.
const RPC_REFUSED: Record<string, { code: string; message: string }> = {}
const job = (id: string, name: string, customer: string) => ({ id, hcp_number: id, click_number: null, job_name: name, customer_name: customer, gc_customer_id: 'gc-1', revenue: 500, payments_made: 0 })
const TABLES: Record<string, unknown[]> = {
  job_lien_desk_items: [
    { id: 'iA', job_id: 'A', kind: 'notice_53_056', status: 'held', months: ['2026-08'], created_at: '2026-10-01', voided_at: null },
    { id: 'iZ', job_id: 'Z', kind: 'notice_53_056', status: 'held', months: ['2026-08'], created_at: '2026-10-01', voided_at: null },
  ],
  // Z is a ZZ job by its own name, Y by its customer's.
  jobs_ledger: [job('A', '101 Hill Street', 'Ann Lee'), job('Z', 'ZZ TEST lien', 'Ann Lee'), job('Y', 'Hill Street remodel', 'ZZ Test Customer')],
  customers: [{ id: 'gc-1', name: 'Kestrin Builders', address: '', contact_info: null, lien_notice_policy: null, lien_notice_policy_note: null }],
}
vi.mock('../lib/supabase', () => ({
  supabase: {
    from: (table: string) => {
      const chain: Record<string, unknown> = {}
      for (const m of ['select', 'is', 'order', 'in', 'eq', 'overlaps']) chain[m] = () => chain
      chain.then = (resolve: (v: unknown) => void) => resolve({ data: TABLES[table] ?? [], error: null })
      return chain
    },
    rpc: (name: string) => Promise.resolve(RPC_REFUSED[name] ? { data: null, error: RPC_REFUSED[name] } : { data: RPC[name] ?? [], error: null }),
  },
}))
vi.mock('../utils/errorHandling', () => ({
  withSupabaseRetry: async (op: () => PromiseLike<{ data: unknown; error: unknown }>) => {
    const r = await op()
    if (r.error) throw r.error
    return r.data
  },
  formatErrorMessage: (e: unknown, fallback: string) => (e instanceof Error && e.message ? `${fallback} ${e.message}` : fallback),
}))
// Retainage nobody recorded (fix A of the retainage clock check, PR 2): the desk's own read, set per test.
const unrecorded = vi.hoisted(() => ({ rows: [] as Array<Record<string, unknown>>, fail: null as Error | null, reads: 0 }))
vi.mock('../lib/ar/retainageHeldIo', () => ({
  loadRetainageUnrecorded: async () => {
    unrecorded.reads += 1
    if (unrecorded.fail) throw unrecorded.fail
    return unrecorded.rows
  },
}))

const { useLienDeskData } = await import('./useLienDeskData')

const read = async (hideZzTestJobs: boolean) => {
  const { result } = renderHook(() => useLienDeskData(true, '2026-10-09', { light: true, hideZzTestJobs }))
  await waitFor(() => expect(result.current.data).not.toBeNull())
  return result.current.data!
}

describe('useLienDeskData · ZZ test jobs', () => {
  it('drops a ZZ job, by its own name or its customer’s, from all four lists and the jobs', async () => {
    const data = await read(true)
    expect(data.rows.map((r) => r.job_id)).toEqual(['A'])
    expect(data.items.map((i) => i.job_id)).toEqual(['A'])
    expect(data.affidavitRows).toEqual([])
    expect(data.retainageRows).toEqual([])
    expect(Object.keys(data.jobsById).sort()).toEqual(['A'])
  })

  it('without the option, reads every job as before', async () => {
    const data = await read(false)
    expect(data.rows.map((r) => r.job_id).sort()).toEqual(['A', 'Z'])
    expect(data.affidavitRows.map((r) => r.job_id)).toEqual(['Y'])
    expect(Object.keys(data.jobsById).sort()).toEqual(['A', 'Y', 'Z'])
  })

  it('a job with a sent item and no month row reads its GC and customer from jobs_ledger (v2.6376, job 890)', async () => {
    const items = TABLES.job_lien_desk_items!
    const jobsLedger = TABLES.jobs_ledger!
    TABLES.job_lien_desk_items = [...items, { id: 'iS', job_id: 'S', kind: 'notice_53_056', status: 'sent', sent_at: '2026-10-01T15:00:00Z', months: ['2026-07'], created_at: '2026-10-01', voided_at: null }]
    TABLES.jobs_ledger = [...jobsLedger, { ...job('S', '628 Tarrow Rd', 'Dunmere Mallin'), customer_id: 'c-mallin' }]
    try {
      const data = await read(false)
      const sent = data.queue.entries.find((e) => e.jobId === 'S')!
      expect(sent.pile).toBe('sent')
      expect(sent.months).toEqual([])
      expect(sent.gcCustomerId).toBe('gc-1')
      expect(sent.customerId).toBe('c-mallin')
      expect(data.gcsById['gc-1']?.name).toBe('Kestrin Builders')
    } finally {
      TABLES.job_lien_desk_items = items
      TABLES.jobs_ledger = jobsLedger
    }
  })

  it('on the open desk, a sent-only job’s money is what its sent bills still owe (v2.6380): the bills are read for just those jobs', async () => {
    const items = TABLES.job_lien_desk_items!
    const jobsLedger = TABLES.jobs_ledger!
    TABLES.job_lien_desk_items = [...items, { id: 'iS', job_id: 'S', kind: 'notice_53_056', status: 'sent', sent_at: '2026-10-01T15:00:00Z', months: ['2026-07'], created_at: '2026-10-01', voided_at: null }]
    TABLES.jobs_ledger = [...jobsLedger, { ...job('S', '628 Tarrow Rd', 'Dunmere Mallin'), customer_id: 'c-mallin', status: 'billed', revenue: 285 }]
    TABLES.jobs_ledger_invoices = [{ id: 'inv-S', job_id: 'S', status: 'billed', amount: 285, sequence_order: 1, billed_at: '2026-07-15' }]
    TABLES.jobs_ledger_payments = []
    try {
      const { result } = renderHook(() => useLienDeskData(true, '2026-10-09', { light: false, hideZzTestJobs: false }))
      await waitFor(() => expect(result.current.data).not.toBeNull())
      const sent = result.current.data!.queue.entries.find((e) => e.jobId === 'S')!
      expect(sent.openBalance).toBe(285)
      // A job the RPC lists keeps the RPC's figure.
      expect(result.current.data!.queue.entries.find((e) => e.jobId === 'A')!.openBalance).toBe(500)
    } finally {
      TABLES.job_lien_desk_items = items
      TABLES.jobs_ledger = jobsLedger
      delete TABLES.jobs_ledger_invoices
      delete TABLES.jobs_ledger_payments
    }
  })

  it('in light mode the bills are read for the notices that wait on the leader, and no other (v2.7435): the Dashboard’s card and the desk claim the same money', async () => {
    const items = TABLES.job_lien_desk_items!
    const jobsLedger = TABLES.jobs_ledger!
    TABLES.job_lien_desk_items = [
      ...items,
      { id: 'iW', job_id: 'W', kind: 'notice_53_056', status: 'awaiting_approval', submitted_at: '2026-10-07T21:13:00Z', months: ['2026-07'], created_at: '2026-10-07', voided_at: null },
      { id: 'iS', job_id: 'S', kind: 'notice_53_056', status: 'sent', sent_at: '2026-10-01T15:00:00Z', months: ['2026-07'], created_at: '2026-10-01', voided_at: null },
    ]
    TABLES.jobs_ledger = [...jobsLedger, { ...job('W', 'ZZ walk job', 'Ann Lee'), status: 'billed', revenue: 3553.4 }, { ...job('S', '628 Tarrow Rd', 'Dunmere Mallin'), status: 'billed', revenue: 285 }]
    TABLES.jobs_ledger_invoices = [
      { id: 'inv-W', job_id: 'W', status: 'billed', amount: 3553.4, sequence_order: 1, billed_at: '2026-07-15' },
      { id: 'inv-S', job_id: 'S', status: 'billed', amount: 285, sequence_order: 1, billed_at: '2026-07-15' },
    ]
    TABLES.jobs_ledger_payments = []
    try {
      const data = await read(false)
      const waiting = data.queue.piles.awaiting.find((e) => e.jobId === 'W')!
      // No month row for the job, so before this the Dashboard read $0 where the open desk read the bills.
      expect(waiting.months).toEqual([])
      expect(waiting.openBalance).toBe(3553.4)
      expect(data.summary.leader).toMatchObject({ jobs: 1, dollars: 3553.4 })
      // A sent notice's job is still left to the open desk: the light read stays small.
      expect(data.queue.entries.find((e) => e.jobId === 'S')!.openBalance).toBe(0)
    } finally {
      TABLES.job_lien_desk_items = items
      TABLES.jobs_ledger = jobsLedger
      delete TABLES.jobs_ledger_invoices
      delete TABLES.jobs_ledger_payments
    }
  })

  it('a job an open in-kind deal pays leaves every list, the jobs and the counts, whoever looks; the deal ended, it is back (v2.7253)', async () => {
    const jobsLedger = TABLES.jobs_ledger!
    const onDeal = (deal: string | null) => jobsLedger.map((j) => ((j as { id: string }).id === 'A' ? { ...(j as object), in_kind_arrangement_id: deal } : j))
    try {
      TABLES.jobs_ledger = onDeal('deal-1')
      const off = await read(false)
      expect(off.rows.map((r) => r.job_id)).toEqual(['Z'])
      expect(off.items.map((i) => i.job_id)).toEqual(['Z'])
      expect(Object.keys(off.jobsById).sort()).toEqual(['Y', 'Z'])
      expect(off.queue.entries.map((e) => e.jobId)).toEqual(['Z'])
      expect(off.queue.counts.held).toBe(1)
      // The deal ended: the trigger cleared the link, and the next read lists the job as before.
      TABLES.jobs_ledger = onDeal(null)
      const back = await read(false)
      expect(back.rows.map((r) => r.job_id).sort()).toEqual(['A', 'Z'])
      expect(back.queue.entries.map((e) => e.jobId).sort()).toEqual(['A', 'Z'])
      expect(back.queue.counts.held).toBe(2)
    } finally {
      TABLES.jobs_ledger = jobsLedger
    }
  })

  it('in full, reads the pieces an approved notice already went out as, by its desk item (v2.5532)', async () => {
    const items = TABLES.job_lien_desk_items!
    TABLES.job_lien_desk_items = [{ ...(items[0] as object), status: 'approved' }, items[1]!]
    TABLES.mail_pieces = [{ id: 'p1', kind: 'lien_notice_53_056', recipient: 'owner', status: 'mailed', source_ids: ['iA'] }]
    try {
      const { result } = renderHook(() => useLienDeskData(true, '2026-10-09', { light: false, hideZzTestJobs: false }))
      await waitFor(() => expect(result.current.data).not.toBeNull())
      expect(result.current.data!.mailPiecesByItem).toEqual({ iA: TABLES.mail_pieces })
    } finally {
      TABLES.job_lien_desk_items = items
      delete TABLES.mail_pieces
    }
  })

  it('reads retainage nobody recorded on the open desk alone, without a ZZ job when they are hidden, and stands when that read is refused', async () => {
    const row = (jobId: string, name: string) => ({ jobId, label: jobId, name, heldBy: 'Kestrin Builders', status: 'billed', suggestion: { held: 250, percent: 10, billCount: 1, billIds: ['b'] }, noteDay: null })
    unrecorded.rows = [row('H', 'Cedar Hollow Clinic'), row('T', 'ZZ TEST sink')]
    unrecorded.reads = 0
    try {
      // The Dashboard's light read makes no such request.
      const light = await read(false)
      expect(light.retainageUnrecorded).toBeUndefined()
      expect(unrecorded.reads).toBe(0)

      const open = renderHook(() => useLienDeskData(true, '2026-10-09', { light: false, hideZzTestJobs: false }))
      await waitFor(() => expect(open.result.current.data).not.toBeNull())
      expect(open.result.current.data!.retainageUnrecorded?.map((r) => r.jobId)).toEqual(['H', 'T'])
      expect(open.result.current.data!.retainageUnrecordedFailure).toBeNull()

      const hidden = renderHook(() => useLienDeskData(true, '2026-10-09', { light: false, hideZzTestJobs: true }))
      await waitFor(() => expect(hidden.result.current.data).not.toBeNull())
      expect(hidden.result.current.data!.retainageUnrecorded?.map((r) => r.jobId)).toEqual(['H'])

      unrecorded.fail = new Error('permission denied for table jobs_ledger_thread_notes')
      const refused = renderHook(() => useLienDeskData(true, '2026-10-09', { light: false, hideZzTestJobs: false }))
      await waitFor(() => expect(refused.result.current.data).not.toBeNull())
      expect(refused.result.current.data!.retainageUnrecorded).toEqual([])
      expect(refused.result.current.data!.retainageUnrecordedFailure).toBe('The check for retainage nobody recorded could not be read. permission denied for table jobs_ledger_thread_notes')
      // The rest of the desk is read as before.
      expect(refused.result.current.data!.queue.entries.map((e) => e.jobId)).toContain('A')
    } finally {
      unrecorded.rows = []
      unrecorded.fail = null
    }
  })
})

describe('useLienDeskData · a public property’s jobs leave the lien path at the source (v2.7439)', () => {
  /** Job A and job Y on one property, with whatever the property record says; the ZZ job Z stays as it was. */
  const withProperty = async (record: Record<string, unknown>, light = true) => {
    const jobsLedger = TABLES.jobs_ledger!
    TABLES.jobs_ledger = jobsLedger.map((j) => (['A', 'Y'].includes((j as { id: string }).id) ? { ...(j as object), customer_address_id: 'addr-1', lien_payment_bond: 'unknown', collections_at: (j as { id: string }).id === 'A' ? '2026-10-08T15:00:00Z' : null } : j))
    TABLES.customer_addresses = [{ id: 'addr-1', owner_name: 'ZZ TEST CITY OF', owner_company: 'ATTN REAL ESTATE MANAGER', ...record }]
    try {
      const { result } = renderHook(() => useLienDeskData(true, '2026-10-09', { light, hideZzTestJobs: false }))
      await waitFor(() => expect(result.current.data).not.toBeNull())
      return result.current.data!
    } finally {
      TABLES.jobs_ledger = jobsLedger
      delete TABLES.customer_addresses
    }
  }

  it('answered public: both jobs leave every list the desk builds and land in the bin’s list, by the property and no flag of their own', async () => {
    const data = await withProperty({ lien_public_answer: 'public', lien_public_answered_at: '2026-10-08T15:00:00Z', lien_public_reason: 'Public property.' })
    // Every list a reader draws from: the due months, the items, the affidavit and retainage windows, the jobs, and the queues over them.
    expect(data.rows.map((r) => r.job_id)).toEqual(['Z'])
    expect(data.items.map((i) => i.job_id)).toEqual(['Z'])
    expect(data.affidavitRows).toEqual([])
    expect(data.affidavits.entries).toEqual([])
    expect(data.retainageRows.map((r) => r.job_id)).toEqual(['Z'])
    expect(Object.keys(data.jobsById).sort()).toEqual(['Z'])
    expect(data.queue.entries.map((e) => e.jobId)).toEqual(['Z'])
    expect(data.queue.counts.held).toBe(1)
    // The Dashboard's counts read the same queue, so they drop the jobs too.
    expect(data.summary.held).toBe(1)
    // Handed on, with the money, the bond, the day it went to the attorney and the papers on it.
    expect(data.publicJobs!.map((j) => j.jobId).sort()).toEqual(['A', 'Y'])
    const a = data.publicJobs!.find((j) => j.jobId === 'A')!
    expect(a).toMatchObject({ addressId: 'addr-1', number: 'A', name: '101 Hill Street', gcName: 'Kestrin Builders', unpaid: 500, bond: 'unknown', attorneySince: '2026-10-08T15:00:00Z' })
    expect(a.papers).toEqual([{ kind: 'notice_53_056', status: 'held', months: ['2026-08'], sent_at: undefined, approved_at: undefined, voided_at: null }])
    expect(data.publicJobs!.find((j) => j.jobId === 'Y')).toMatchObject({ unpaid: 300, attorneySince: null, papers: [] })
    expect([...data.publicAskJobIds!]).toEqual([])
    expect(data.propertiesById!['addr-1']).toMatchObject({ lien_public_answer: 'public' })
  })

  it('unanswered: the jobs stay on the lien path, the affidavit holds on the name as before, and the property asks', async () => {
    const data = await withProperty({ lien_public_answer: null })
    expect(data.rows.map((r) => r.job_id).sort()).toEqual(['A', 'Z'])
    expect(data.publicJobs).toEqual([])
    expect([...data.publicAskJobIds!].sort()).toEqual(['A', 'Y'])
    expect(data.affidavitRows.find((r) => r.job_id === 'Y')).toMatchObject({ owner_public: true })
  })

  it('before the migration is pushed the record carries no answer’s column: nothing asks, and the name guess holds as before', async () => {
    const data = await withProperty({})
    expect(data.publicJobs).toEqual([])
    expect([...data.publicAskJobIds!]).toEqual([])
    expect(data.affidavitRows.find((r) => r.job_id === 'Y')).toMatchObject({ owner_public: true })
  })

  it('answered private: the name guess is overruled, so the affidavit’s public-owner hold opens and nothing asks', async () => {
    const data = await withProperty({ lien_public_answer: 'private' })
    expect(data.rows.map((r) => r.job_id).sort()).toEqual(['A', 'Z'])
    expect(data.publicJobs).toEqual([])
    expect([...data.publicAskJobIds!]).toEqual([])
    expect(data.affidavitRows.find((r) => r.job_id === 'Y')).toMatchObject({ owner_public: false })
  })

  it('every reader drops them with no rule of its own: the Board, the lists, the run, the notary print and the Dashboard’s counts', async () => {
    const { buildLienBoard } = await import('../lib/jobs/lienBoard')
    const { buildLienDeskRun } = await import('../lib/jobs/lienDeskRun')
    const { lienAffidavitPrintPlan } = await import('../lib/jobs/lienAffidavitBatch')
    const items = TABLES.job_lien_desk_items!
    // Job A has a notice approved and waiting for the run; job Y has an affidavit approved and ready to file.
    TABLES.job_lien_desk_items = [
      { id: 'iA', job_id: 'A', kind: 'notice_53_056', status: 'approved', approved_at: '2026-10-08T15:00:00Z', months: ['2026-08'], created_at: '2026-10-01', voided_at: null, fields: { notice: { claimAmount: '500.00' } } },
      { id: 'iY', job_id: 'Y', kind: 'affidavit', status: 'approved', approved_at: '2026-10-08T15:00:00Z', months: ['2026-07'], created_at: '2026-10-01', voided_at: null, fields: {} },
      items[1]!,
    ]
    /** What each reader draws from one read of the desk. */
    const readers = (data: Awaited<ReturnType<typeof withProperty>>) => {
      const board = buildLienBoard({ todayYmd: '2026-10-09', notices: data.queue.entries, affidavits: data.affidavits.entries, retainage: data.retainage.entries, jobNumber: (id) => id, jobName: () => '', gcName: () => '' })
      return {
        board: [...board.notices, ...board.affidavits].flatMap((b) => b.chips.map((c) => c.jobId)).sort(),
        noticeList: data.queue.entries.map((e) => e.jobId).sort(),
        affidavitList: data.affidavits.entries.map((e) => e.jobId).sort(),
        run: buildLienDeskRun(data.queue.piles.ready, data, null, () => 'ZZ Test Signer', '2026-10-09').map((n) => n.jobId),
        notaryPrint: lienAffidavitPrintPlan(data.affidavits.piles.ready).ready.map((e) => e.jobId),
        dashboardReady: data.summary.office.ready,
      }
    }
    try {
      // While nobody has answered, both jobs are in every reader (the affidavit held on the name, so it is not in the print).
      const before = readers(await withProperty({}))
      expect(before.board).toEqual(['A', 'Y', 'Z'])
      expect(before.noticeList).toEqual(['A', 'Z'])
      expect(before.affidavitList).toEqual(['Y'])
      expect(before.run).toEqual(['A'])
      expect(before.dashboardReady).toBe(1)
      // Answered public: neither job is in any of them.
      const after = readers(await withProperty({ lien_public_answer: 'public' }))
      expect(after).toEqual({ board: ['Z'], noticeList: ['Z'], affidavitList: [], run: [], notaryPrint: [], dashboardReady: 0 })
      // Answered private: both jobs stay in every reader, as while unanswered.
      const priv = readers(await withProperty({ lien_public_answer: 'private' }))
      expect({ ...priv, notaryPrint: [] }).toEqual({ ...before, notaryPrint: [] })
    } finally {
      TABLES.job_lien_desk_items = items
    }
  })

  it('a ZZ job hidden from the desk is not listed in the bin either', async () => {
    const jobsLedger = TABLES.jobs_ledger!
    TABLES.jobs_ledger = jobsLedger.map((j) => ({ ...(j as object), customer_address_id: 'addr-1' }))
    TABLES.customer_addresses = [{ id: 'addr-1', owner_name: 'ZZ TEST CITY OF', owner_company: '', lien_public_answer: 'public' }]
    try {
      const data = await read(true)
      expect(data.publicJobs!.map((j) => j.jobId)).toEqual(['A'])
      expect(data.queue.entries).toEqual([])
    } finally {
      TABLES.jobs_ledger = jobsLedger
      delete TABLES.customer_addresses
    }
  })
})

describe('useLienDeskData · a job a person took off the lien path leaves at the source (v2.7521)', () => {
  const OFF = { lien_path_answer: 'off_path', lien_path_reason: 'The bill is for trips to pick up checks.', lien_path_answered_at: '2026-10-08T15:00:00Z', lien_path_answered_by: 'u1' }
  /** Job A carries the answer handed in; P is a job no reader and no paper names, off the path by its own answer. */
  const withAnswer = async (answer: Record<string, unknown>, opts: { light?: boolean; hideZzTestJobs?: boolean; more?: unknown[] } = {}) => {
    const jobsLedger = TABLES.jobs_ledger!
    TABLES.users = [{ id: 'u1', name: ' Dana ' }]
    TABLES.jobs_ledger = [...jobsLedger.map((j) => ((j as { id: string }).id === 'A' ? { ...(j as object), status: 'billed', collections_at: '2026-10-08T16:00:00Z', ...answer } : j)), ...(opts.more ?? [])]
    try {
      const { result } = renderHook(() => useLienDeskData(true, '2026-10-09', { light: opts.light ?? false, hideZzTestJobs: opts.hideZzTestJobs ?? false }))
      await waitFor(() => expect(result.current.data).not.toBeNull())
      return result.current.data!
    } finally {
      TABLES.jobs_ledger = jobsLedger
      delete TABLES.users
    }
  }

  it('off the path: the job leaves every list the desk builds and the Dashboard’s counts, and is handed on with why, who and the day', async () => {
    const data = await withAnswer(OFF)
    expect(data.rows.map((r) => r.job_id)).toEqual(['Z'])
    expect(data.items.map((i) => i.job_id)).toEqual(['Z'])
    expect(Object.keys(data.jobsById).sort()).toEqual(['Y', 'Z'])
    expect(data.queue.entries.map((e) => e.jobId)).toEqual(['Z'])
    expect(data.queue.counts.held).toBe(1)
    expect(data.summary.held).toBe(1)
    expect(data.offPathJobs).toEqual([
      {
        jobId: 'A',
        number: 'A',
        name: '101 Hill Street',
        gcName: 'Kestrin Builders',
        unpaid: 500,
        reason: 'The bill is for trips to pick up checks.',
        since: '2026-10-08T15:00:00Z',
        byUserId: 'u1',
        byName: 'Dana',
        attorneySince: '2026-10-08T16:00:00Z',
        status: 'billed',
        papers: [{ kind: 'notice_53_056', status: 'held', months: ['2026-08'], sent_at: undefined, approved_at: undefined, voided_at: null }],
      },
    ])
    // Its paper is not voided or deleted: it is only out of the lists, so it is there when the job comes back.
    expect(data.publicJobs).toEqual([])
  })

  it('put back: the job carries no answer and is on every list again, with nothing in the bin', async () => {
    const data = await withAnswer({ lien_path_answer: null, lien_path_reason: 'Counsel says the claim stands.', lien_path_answered_at: '2026-10-09T15:00:00Z' })
    expect(data.rows.map((r) => r.job_id).sort()).toEqual(['A', 'Z'])
    expect(data.queue.entries.map((e) => e.jobId).sort()).toEqual(['A', 'Z'])
    expect(data.queue.counts.held).toBe(2)
    expect(data.offPathJobs).toEqual([])
  })

  it('a job no reader and no paper names is still in the bin while it owes money, and never on a list', async () => {
    const data = await withAnswer(OFF, { more: [{ ...job('P', 'Parrow Court', 'Ann Lee'), status: 'billed', ...OFF, lien_path_reason: 'No lien right here.' }] })
    expect(data.offPathJobs!.map((j) => j.jobId).sort()).toEqual(['A', 'P'])
    expect(data.offPathJobs!.find((j) => j.jobId === 'P')).toMatchObject({ name: 'Parrow Court', reason: 'No lien right here.', unpaid: 500, papers: [] })
    expect(Object.keys(data.jobsById).sort()).toEqual(['Y', 'Z'])
    expect(data.queue.entries.map((e) => e.jobId)).toEqual(['Z'])
  })

  it('in light mode the Dashboard’s counts drop the job and no bin is read', async () => {
    const data = await withAnswer(OFF, { light: true })
    expect(data.queue.entries.map((e) => e.jobId)).toEqual(['Z'])
    expect(data.summary.held).toBe(1)
    expect(data.offPathJobs).toEqual([])
  })

  it('a ZZ job hidden from the desk is not listed in the bin either', async () => {
    const data = await withAnswer(OFF, { hideZzTestJobs: true, more: [{ ...job('Q', 'ZZ TEST off path', 'Ann Lee'), status: 'billed', ...OFF }] })
    expect(data.offPathJobs!.map((j) => j.jobId)).toEqual(['A'])
  })
})

describe('useLienDeskData · a lien day that passed with nothing filed stays until someone answers it (v2.7817)', () => {
  /** Job C's lien day passed 55 days before the test's 2026-10-09; the windows reader stopped listing it after seven. */
  const closedDay = (jobId: string, over: Record<string, unknown> = {}) => ({ job_id: jobId, last_month: '2026-04', deadline: '2026-08-15', is_sub: true, noticed: true, filed: false, open_balance: 900, customer_id: 'c1', gc_customer_id: 'gc-1', property_kind: 'commercial', has_owner: true, has_legal: true, homestead: false, desk_item_id: null, desk_status: null, month_source: 'hours', ...over })
  const withClosed = async (rows: unknown[], opts: { light?: boolean; hideZzTestJobs?: boolean; jobs?: unknown[] } = {}) => {
    const jobsLedger = TABLES.jobs_ledger!
    RPC.list_lien_closed_days = rows
    TABLES.jobs_ledger = [...jobsLedger, { ...job('C', 'Cedar Hollow Clinic', 'Ann Lee'), status: 'billed', revenue: 900 }, ...(opts.jobs ?? [])]
    try {
      const { result } = renderHook(() => useLienDeskData(true, '2026-10-09', { light: opts.light ?? false, hideZzTestJobs: opts.hideZzTestJobs ?? false }))
      await waitFor(() => expect(result.current.data).not.toBeNull())
      return result.current.data!
    } finally {
      delete RPC.list_lien_closed_days
      TABLES.jobs_ledger = jobsLedger
    }
  }

  it('the closed day is an affidavit row after the windows rows, its job is read, and it stands in Missed', async () => {
    const data = await withClosed([closedDay('C')])
    expect(data.affidavitRows.map((r) => r.job_id)).toEqual(['Y', 'C'])
    expect(data.jobsById.C).toMatchObject({ job_name: 'Cedar Hollow Clinic' })
    const entry = data.affidavits.entries.find((e) => e.jobId === 'C')!
    expect(entry).toMatchObject({ pile: 'missed', daysLeft: -55, deadline: '2026-08-15', openBalance: 900 })
    expect(data.affidavits.counts.missed).toBe(1)
    // The job the windows reader lists reads as it did.
    expect(data.affidavits.entries.find((e) => e.jobId === 'Y')!.pile).not.toBe('missed')
  })

  it('the Dashboard’s light read carries it too, so its strip and the Board count the same papers', async () => {
    const data = await withClosed([closedDay('C')], { light: true })
    expect(data.affidavits.piles.missed.map((e) => e.jobId)).toEqual(['C'])
  })

  it('before the migration is pushed the reader is not there: the desk reads as before, with no closed day', async () => {
    RPC_REFUSED.list_lien_closed_days = { code: 'PGRST202', message: 'Could not find the function public.list_lien_closed_days without parameters in the schema cache' }
    try {
      const data = await withClosed([closedDay('C')])
      expect(data.affidavitRows.map((r) => r.job_id)).toEqual(['Y'])
      expect(data.affidavits.counts.missed).toBe(0)
      expect(data.rows.map((r) => r.job_id).sort()).toEqual(['A', 'Z'])
    } finally {
      delete RPC_REFUSED.list_lien_closed_days
    }
  })

  it('a job both readers name is listed once, by its windows row', async () => {
    const data = await withClosed([closedDay('Y'), closedDay('C')])
    expect(data.affidavitRows.map((r) => r.job_id)).toEqual(['Y', 'C'])
    expect(data.affidavitRows.find((r) => r.job_id === 'Y')).toMatchObject({ deadline: '2026-10-15', open_balance: 300 })
  })

  it('it leaves the way every job leaves the desk: a hidden ZZ test job, a job an in-kind deal pays, a job off the lien path', async () => {
    const zz = await withClosed([closedDay('C'), closedDay('T')], { hideZzTestJobs: true, jobs: [{ ...job('T', 'ZZ TEST closed day', 'Ann Lee'), status: 'billed' }] })
    expect(zz.affidavits.piles.missed.map((e) => e.jobId)).toEqual(['C'])
    const more = [{ ...job('K', 'Kiln Road', 'Ann Lee'), status: 'billed', in_kind_arrangement_id: 'deal-1' }, { ...job('P', 'Parrow Court', 'Ann Lee'), status: 'billed', lien_path_answer: 'off_path', lien_path_reason: 'No lien right here.' }]
    const off = await withClosed([closedDay('C'), closedDay('K'), closedDay('P')], { jobs: more })
    expect(off.affidavits.piles.missed.map((e) => e.jobId)).toEqual(['C'])
    expect(off.offPathJobs!.map((j) => j.jobId)).toEqual(['P'])
  })
})
