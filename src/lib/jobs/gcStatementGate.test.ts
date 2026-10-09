/**
 * A GC statement never goes out unchecked (v2.5022; the owner's call of 2026-10-09). The kernel both
 * send functions hold a statement with, over the certification's shape, and the reads around it. The
 * cases are the shapes prod held in the week of 2026-10-05: a board row keyed by its job where the
 * payload keys it by its one bill, a snapshot's float noise, a bill sent after the check, a GC paid in
 * full since, a job gone to Collections.
 */
import { describe, expect, it } from 'vitest'
import {
  GC_STATEMENT_UNCHECKED_WORDS,
  gcBulkHeldLines,
  gcBulkHeldSummary,
  gcCertWeekStartYmd,
  gcStatementGate,
  gcStatementRefusedNote,
  type GcStatementCertIn,
} from '../../../supabase/functions/_shared/gcStatementGate'
import { readGcStatementGate, readGcStatementHolds } from '../../../supabase/functions/_shared/gcStatementGateIo'
import { todayYmdInAppTz } from '../../../supabase/functions/_shared/appTimeZone'
import { gcReviewWeekStartYmd } from './gcReviewCertification'

const cert = (rows: Array<{ key: string; jobId: string; remaining: number }>, at = '2026-10-07T16:00:04Z'): GcStatementCertIn => ({
  certified_at: at,
  total: rows.reduce((t, r) => t + r.remaining, 0),
  snapshot: { rows, total: rows.reduce((t, r) => t + r.remaining, 0), jobCount: new Set(rows.map((r) => r.jobId)).size },
})

describe('gcCertWeekStartYmd', () => {
  it('is the Monday of the week, Sunday belonging to the week before', () => {
    expect(['2026-10-05', '2026-10-07', '2026-10-09', '2026-10-11'].map(gcCertWeekStartYmd)).toEqual(['2026-10-05', '2026-10-05', '2026-10-05', '2026-10-05'])
    expect(gcCertWeekStartYmd('2026-10-12')).toBe('2026-10-12')
    expect(gcCertWeekStartYmd('2026-03-01')).toBe('2026-02-23')
  })

  it('names the same week as GC Review, around midnight in Chicago', () => {
    for (const iso of ['2026-10-12T04:59:00Z', '2026-10-12T05:01:00Z', '2026-10-09T02:00:00Z', '2026-11-02T05:30:00Z', '2026-03-09T04:30:00Z']) {
      const at = new Date(iso)
      expect(gcCertWeekStartYmd(todayYmdInAppTz(at))).toBe(gcReviewWeekStartYmd(at))
    }
  })
})

describe('gcStatementGate', () => {
  it('no check this week: held, in the worklist row’s words', () => {
    const gate = gcStatementGate([{ jobId: 'j1', remaining: 1828.71 }], [])
    expect(gate).toEqual({ ok: false, why: 'not_checked', words: GC_STATEMENT_UNCHECKED_WORDS, note: 'not checked this week' })
    expect(GC_STATEMENT_UNCHECKED_WORDS).toBe('Check the bills first — a statement never goes out unchecked')
  })

  it('Knight’s shape: the board keys a job with one bill by the job, the payload by the bill, and they match job by job', () => {
    const certified = cert([
      { key: 'job-0baef727', jobId: 'job-0baef727', remaining: 1828.71 },
      { key: 'bill-5987671b', jobId: 'job-f067e117', remaining: 3635.92 },
      { key: 'bill-484965f9', jobId: 'job-f067e117', remaining: 588.5200000000004 },
      { key: 'bill-58359f49', jobId: 'job-fa901e87', remaining: 53.629999999999995 },
    ])
    const live = [
      { jobId: 'job-0baef727', remaining: 1828.71 },
      { jobId: 'job-f067e117', remaining: 3635.92 },
      { jobId: 'job-f067e117', remaining: '588.52' },
      { jobId: 'job-fa901e87', remaining: 53.63 },
    ]
    expect(gcStatementGate(live, [certified])).toEqual({ ok: true, why: 'checked' })
  })

  it('Done Right’s shape: a bill on another job sent two hours after the check holds it', () => {
    const certified = cert([{ key: 'job-sheppard', jobId: 'job-sheppard', remaining: 250 }], '2026-10-08T17:43:55Z')
    const live = [
      { jobId: 'job-sheppard', remaining: 250 },
      { jobId: 'job-mccluskey', remaining: 250 },
    ]
    const gate = gcStatementGate(live, [certified])
    expect(gate).toMatchObject({ ok: false, why: 'changed', note: 'changed since it was checked' })
  })

  it('a payment on a checked job holds it, a cent apart', () => {
    const certified = cert([{ key: 'b1', jobId: 'j1', remaining: 4421.26 }])
    expect(gcStatementGate([{ jobId: 'j1', remaining: 4421.25 }], [certified]).ok).toBe(false)
  })

  it('Michael Holub’s shape: paid in full since the check, there is nothing to check', () => {
    const certified = cert([{ key: 'j-holub', jobId: 'j-holub', remaining: 6600 }])
    expect(gcStatementGate([], [certified])).toEqual({ ok: true, why: 'nothing_to_check' })
    expect(gcStatementGate([{ jobId: 'j-holub', remaining: 0 }], [])).toEqual({ ok: true, why: 'nothing_to_check' })
  })

  it('the latest check of the week stands: a re-check after a change frees it, a stale one does not', () => {
    const before = cert([{ key: 'b1', jobId: 'j1', remaining: 500 }], '2026-10-05T18:00:00Z')
    const after = cert([{ key: 'b1', jobId: 'j1', remaining: 250 }], '2026-10-08T19:00:00Z')
    const live = [{ jobId: 'j1', remaining: 250 }]
    expect(gcStatementGate(live, [after, before]).ok).toBe(true)
    expect(gcStatementGate(live, [before]).ok).toBe(false)
  })

  it('a job listed at nothing on one side and missing on the other is no change', () => {
    const certified = cert([
      { key: 'b1', jobId: 'j1', remaining: 900 },
      { key: 'b2', jobId: 'j2', remaining: 0 },
    ])
    expect(gcStatementGate([{ jobId: 'j1', remaining: 900 }], [certified]).ok).toBe(true)
  })

  it('a snapshot that cannot be read job by job falls back to the certified total', () => {
    const noRows: GcStatementCertIn = { certified_at: '2026-10-07T16:00:00Z', total: '26000.00', snapshot: null }
    expect(gcStatementGate([{ jobId: 'j1', remaining: 26000 }], [noRows]).ok).toBe(true)
    expect(gcStatementGate([{ jobId: 'j1', remaining: 25000 }], [noRows]).ok).toBe(false)
    const noJobIds: GcStatementCertIn = { certified_at: '2026-10-07T16:00:00Z', total: 900, snapshot: { rows: [{ key: 'b1', remaining: 900 }], total: 900 } }
    expect(gcStatementGate([{ jobId: 'j1', remaining: 900 }], [noJobIds]).ok).toBe(true)
  })

  it('the bulk doors’ summary and the whole report’s lines count and name the held GCs by why', () => {
    expect(gcBulkHeldSummary('sent', 3, ['not_checked', 'not_checked'])).toBe('3 sent · 2 held: not checked this week')
    expect(gcBulkHeldSummary('printed', 4, ['changed', 'not_checked'])).toBe('4 printed · 1 held: not checked this week · 1 held: changed since it was checked')
    expect(gcBulkHeldSummary('sent', 5, [])).toBe('5 sent')
    expect(gcBulkHeldLines([
      { name: 'TF Harper', why: 'not_checked' },
      { name: 'Done Right Foundation', why: 'changed' },
      { name: 'Loberg Contracting', why: 'not_checked' },
    ])).toEqual(['Held, not checked this week: TF Harper, Loberg Contracting', 'Held, changed since it was checked: Done Right Foundation'])
    expect(gcBulkHeldLines([])).toEqual([])
  })

  it('the dispatch’s note names the words and why', () => {
    const gate = gcStatementGate([{ jobId: 'j1', remaining: 10 }], [])
    if (gate.ok) throw new Error('expected a hold')
    expect(gcStatementRefusedNote(gate)).toBe('refused: Check the bills first — a statement never goes out unchecked (not checked this week)')
  })
})

/** A stand-in for the service client: records each read and answers from `answers`. */
function fakeAdmin(answers: { certs?: unknown[]; certErr?: string; payload?: unknown; rpcErr?: string; totals?: unknown[]; totalsErr?: string }) {
  const reads: Array<{ table: string; steps: Array<[string, unknown[]]> }> = []
  const rpcs: Array<{ name: string; args: unknown }> = []
  return {
    reads,
    rpcs,
    from(table: string) {
      const steps: Array<[string, unknown[]]> = []
      reads.push({ table, steps })
      const query: unknown = new Proxy(
        {},
        {
          get(_t, prop) {
            if (prop === 'then') {
              return (resolve: (v: unknown) => void) =>
                resolve(
                  table === 'gc_review_certifications'
                    ? { data: answers.certs ?? [], error: answers.certErr ? { message: answers.certErr } : null }
                    : { data: answers.totals ?? [], error: answers.totalsErr ? { message: answers.totalsErr } : null },
                )
            }
            return (...args: unknown[]) => {
              steps.push([String(prop), args])
              return query
            }
          },
        },
      )
      return query
    },
    async rpc(name: string, args: unknown) {
      rpcs.push({ name, args })
      return { data: answers.payload ?? null, error: answers.rpcErr ? { message: answers.rpcErr } : null }
    },
  }
}

const ON_FRIDAY = new Date('2026-10-09T15:00:00Z')

const payloadRow = (over: Record<string, unknown>) => ({
  display_number: '651',
  job_name: 'Palomino Trail',
  job_address: null,
  customer_name: 'Cust',
  ref_date: '2026-09-01',
  ref_is_estimate: false,
  age_days: 38,
  in_collections: false,
  ...over,
})

describe('readGcStatementGate — the dispatch hands in the group it built', () => {
  it('reads this week’s checks for the GC, and leaves the group’s Collections rows out', async () => {
    const admin = fakeAdmin({ certs: [cert([{ key: 'job-a', jobId: 'job-a', remaining: 1200 }])] })
    const rows = [
      payloadRow({ job_id: 'job-a', row_key: 'bill-a', remaining: 1200 }),
      payloadRow({ job_id: 'job-heron', row_key: 'bill-heron', remaining: 4050, in_collections: true }),
    ] as never[]
    expect(await readGcStatementGate(admin, 'gc-1', { rows, now: ON_FRIDAY })).toEqual({ ok: true, why: 'checked' })
    expect(admin.reads.map((r) => r.table)).toEqual(['gc_review_certifications'])
    expect(admin.reads[0]!.steps.filter(([m]) => m === 'eq')).toEqual([
      ['eq', ['gc_customer_id', 'gc-1']],
      ['eq', ['week_start', '2026-10-05']],
    ])
    expect(admin.rpcs).toEqual([])
  })

  it('Heron’s shape: a GC whose only bill went to Collections has nothing to check', async () => {
    const admin = fakeAdmin({ certs: [] })
    const rows = [payloadRow({ job_id: 'job-heron', row_key: 'bill-heron', remaining: 4050, in_collections: true })] as never[]
    expect(await readGcStatementGate(admin, 'gc-heron', { rows, now: ON_FRIDAY })).toEqual({ ok: true, why: 'nothing_to_check' })
  })

  it('a read that fails throws, so the attempt is tried again rather than sent', async () => {
    const admin = fakeAdmin({ certErr: 'timeout' })
    await expect(readGcStatementGate(admin, 'gc-1', { rows: [], now: ON_FRIDAY })).rejects.toThrow('gc_review_certifications: timeout')
  })
})

describe('readGcStatementHolds — the whole report, every GC section in one read', () => {
  it('holds the sections the week’s checks do not stand behind; the no-GC bucket is never held', async () => {
    const admin = fakeAdmin({ certs: [{ gc_customer_id: 'gc-knight', ...cert([{ key: 'job-k', jobId: 'job-k', remaining: 900 }]) }] })
    const group = (id: string | null, rows: unknown[]) => ({ entity_id: id, entity_name: id ?? 'Not billed to a GC', is_no_entity: id == null, job_count: 1, subtotal: 0, oldest_age_days: null, rows })
    const holds = await readGcStatementHolds(admin, [
      group('gc-knight', [payloadRow({ job_id: 'job-k', row_key: 'b-k', remaining: 900 })]),
      group('gc-harper', [payloadRow({ job_id: 'job-h', row_key: 'b-h', remaining: 3000 })]),
      group(null, [payloadRow({ job_id: 'job-n', row_key: 'b-n', remaining: 50 })]),
    ] as never[], { now: ON_FRIDAY })
    expect([...holds.entries()].map(([id, g]) => [id, g.ok ? g.why : g.why])).toEqual([
      ['gc-knight', 'checked'],
      ['gc-harper', 'not_checked'],
    ])
    expect(admin.reads[0]!.steps.filter(([m]) => m === 'in' || m === 'eq')).toEqual([
      ['in', ['gc_customer_id', ['gc-knight', 'gc-harper']]],
      ['eq', ['week_start', '2026-10-05']],
    ])
  })
})

describe('readGcStatementGate — send-gc-statement-email has it build the group', () => {
  // One job, $1,000: two sent bills and $300 put on the job with no bill picked. The RPC nets each bill by
  // its linked money only; the rule puts the $300 on the older bill, as the board the check was made on did.
  const payload = {
    generated_at: '2026-10-09T15:00:00Z',
    group_by: 'gc',
    include_collections: false,
    grand_total: 1000,
    groups: [
      {
        entity_id: 'gc-1',
        entity_name: 'Knight Contracting',
        is_no_entity: false,
        job_count: 1,
        subtotal: 1000,
        oldest_age_days: 38,
        rows: [
          payloadRow({ job_id: 'job-1', row_key: 'b-old', invoice_id: 'b-old', invoice_amount: 600, remaining: 600, job_bills: [{ id: 'b-old', amount: 600, status: 'billed', sequence_order: 0, billed_at: '2026-09-01T00:00:00Z' }, { id: 'b-new', amount: 400, status: 'billed', sequence_order: 1, billed_at: '2026-09-15T00:00:00Z' }], job_payments: [{ id: 'p1', invoice_id: null, amount: 300, paid_on: '2026-09-20' }] }),
          payloadRow({ job_id: 'job-1', row_key: 'b-new', invoice_id: 'b-new', invoice_amount: 400, remaining: 400, job_bills: [{ id: 'b-old', amount: 600, status: 'billed', sequence_order: 0, billed_at: '2026-09-01T00:00:00Z' }, { id: 'b-new', amount: 400, status: 'billed', sequence_order: 1, billed_at: '2026-09-15T00:00:00Z' }], job_payments: [{ id: 'p1', invoice_id: null, amount: 300, paid_on: '2026-09-20' }] }),
        ],
      },
    ],
  }
  const checked = cert([
    { key: 'b-old', jobId: 'job-1', remaining: 300 },
    { key: 'b-new', jobId: 'job-1', remaining: 400 },
  ])

  it('reads the GC’s statement outside Collections, each job’s total beside it, and nets it by the one rule', async () => {
    const admin = fakeAdmin({ certs: [checked], payload: structuredClone(payload), totals: [{ id: 'job-1', revenue: 1000 }] })
    expect(await readGcStatementGate(admin, 'gc-1', { now: ON_FRIDAY })).toEqual({ ok: true, why: 'checked' })
    expect(admin.rpcs).toEqual([{ name: 'get_gc_statement_email_payload', args: { p_group_by: 'gc', p_entity_id: 'gc-1', p_include_collections: false } }])
    expect(admin.reads.map((r) => r.table)).toEqual(['gc_review_certifications', 'jobs_ledger'])
    expect(admin.reads[1]!.steps).toContainEqual(['in', ['id', ['job-1']]])
  })

  it('without the job’s total the rule cannot place the $300, and the statement reads as changed', async () => {
    const admin = fakeAdmin({ certs: [checked], payload: structuredClone(payload), totals: [] })
    expect((await readGcStatementGate(admin, 'gc-1', { now: ON_FRIDAY })).ok).toBe(false)
  })

  it('a failed payload or totals read throws: nothing goes out on a gate that could not look', async () => {
    await expect(readGcStatementGate(fakeAdmin({ certs: [checked], rpcErr: 'boom' }), 'gc-1', { now: ON_FRIDAY })).rejects.toThrow('payload rpc: boom')
    await expect(readGcStatementGate(fakeAdmin({ certs: [checked], payload: structuredClone(payload), totalsErr: 'gone' }), 'gc-1', { now: ON_FRIDAY })).rejects.toThrow('jobs_ledger totals: gone')
  })
})
