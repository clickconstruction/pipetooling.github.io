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
    await loadCollectScorecardReads(summer.db, { sinceYmd: '2026-10-26', jobIds: ['j1'] })
    expect(gteOn(summer.reads, 'job_lien_filings')).toEqual(['created_at', '2026-10-26T05:00:00.000Z'])
    expect(gteOn(summer.reads, 'jobs_ledger_payments')).toEqual(['paid_on', '2026-10-26'])
    const winter = fakeDb({})
    await loadCollectScorecardReads(winter.db, { sinceYmd: '2026-12-07', jobIds: ['j1'] })
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
    const reads = await loadCollectScorecardReads(db, { sinceYmd: '2026-10-26', jobIds: ['j1'] })
    expect(reads.notices).toEqual({ drafted: 2, signed: 1, mailed: 1, affidavitsFiled: 0 })
  })
})
