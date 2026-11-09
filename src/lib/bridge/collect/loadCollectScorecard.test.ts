import { describe, expect, it } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../../../types/database'
import { loadCollectScorecardReads } from './loadCollectScorecard'

/**
 * The Collect desk's Friday reads (v2.5858), on the company calendar since v2.5950: the call's day starts at midnight
 * Central, so a paper drafted, signed or filed the evening before the call (after 7 PM Central, already the call's
 * day in UTC) is not counted as since the call.
 */
type Step = { method: string; args: unknown[] }
function fakeDb(rows: Record<string, unknown[]>) {
  const reads: Array<{ table: string; steps: Step[] }> = []
  const db = {
    from(table: string) {
      const steps: Step[] = []
      reads.push({ table, steps })
      const builder: unknown = new Proxy(
        {},
        {
          get(_t, prop) {
            if (prop === 'then') return (resolve: (v: unknown) => void) => resolve({ data: rows[table] ?? [], error: null })
            return (...args: unknown[]) => {
              steps.push({ method: String(prop), args })
              return builder
            }
          },
        },
      )
      return builder
    },
  }
  return { db: db as unknown as SupabaseClient<Database>, reads }
}
const gteOn = (reads: Array<{ table: string; steps: Step[] }>, table: string) => reads.find((r) => r.table === table)?.steps.find((s) => s.method === 'gte')?.args

describe('loadCollectScorecardReads on the company calendar (v2.5950)', () => {
  it('reads the filings from midnight Central on the call day, in summer time and in winter time', async () => {
    const summer = fakeDb({})
    await loadCollectScorecardReads(summer.db, { sinceYmd: '2026-10-26', jobIds: ['j1'], zzTestJobIds: null })
    expect(gteOn(summer.reads, 'job_lien_filings')).toEqual(['created_at', '2026-10-26T05:00:00.000Z'])
    expect(gteOn(summer.reads, 'jobs_ledger_payments')).toEqual(['paid_on', '2026-10-26'])
    const winter = fakeDb({})
    await loadCollectScorecardReads(winter.db, { sinceYmd: '2026-12-07', jobIds: ['j1'], zzTestJobIds: null })
    expect(gteOn(winter.reads, 'job_lien_filings')).toEqual(['created_at', '2026-12-07T06:00:00.000Z'])
  })

  it('counts a notice drafted, signed or mailed since midnight Central, and not the evening before', async () => {
    const { db } = fakeDb({
      job_lien_desk_items: [
        // 9 PM Central on Oct 25, the evening before the call: already Oct 26 in UTC.
        { job_id: 'j1', kind: 'notice', drafted_at: '2026-10-26T02:00:00+00:00', approved_at: '2026-10-26T02:30:00+00:00', sent_at: null },
        // 9 AM Central on the call's day.
        { job_id: 'j1', kind: 'notice', drafted_at: '2026-10-26T14:00:00+00:00', approved_at: '2026-10-26T15:00:00+00:00', sent_at: '2026-10-27T16:00:00+00:00' },
        // Midnight Central to the second, as Postgres stamps it.
        { job_id: 'j1', kind: 'notice', drafted_at: '2026-10-26T05:00:00+00:00', approved_at: null, sent_at: null },
      ],
    })
    const reads = await loadCollectScorecardReads(db, { sinceYmd: '2026-10-26', jobIds: ['j1'], zzTestJobIds: null })
    expect(reads.notices).toEqual({ drafted: 2, signed: 1, mailed: 1, affidavitsFiled: 0 })
  })
})

describe('loadCollectScorecardReads: a payment on a ZZ test job is no payer\'s (v2.6813)', () => {
  const job = (id: string, jobName: string, customerName: string, payer: string) => ({ id, job_name: jobName, customer_name: customerName, bill_to_party: 'customer', customer_id: `c-${id}`, gc_customer_id: null, customer: { name: payer }, gc: null })
  const rows = {
    jobs_ledger_payments: [
      { job_id: 'real', amount: 4_000, paid_on: '2026-10-27' },
      { job_id: 'zzById', amount: 75, paid_on: '2026-10-27' },
      { job_id: 'zzByName', amount: 1, paid_on: '2026-10-28' },
    ],
    jobs_ledger: [job('real', 'Elm', 'Ann Lee', 'Ann Lee'), job('zzById', 'Renamed since', 'Ann Lee', 'Ann Lee'), job('zzByName', 'ZZ Test bio walk', 'Robert Test', 'Robert Test')],
  }

  it('leaves by the shared ids, or by the names its job carries', async () => {
    const { db } = fakeDb(rows)
    const reads = await loadCollectScorecardReads(db, { sinceYmd: '2026-10-26', jobIds: [], zzTestJobIds: new Set(['zzById']) })
    expect(reads.payments).toEqual([{ payerId: 'c-real', payerName: 'Ann Lee', usd: 4_000, paidOn: '2026-10-27' }])
  })

  it('keeps every payment for a dev who shows them', async () => {
    const { db } = fakeDb(rows)
    const reads = await loadCollectScorecardReads(db, { sinceYmd: '2026-10-26', jobIds: [], zzTestJobIds: null })
    expect(reads.payments.map((p) => p.usd)).toEqual([4_000, 75, 1])
  })
})
