import { describe, expect, it } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../../../types/database'
import { loadBillDeskReads } from './loadBillDesk'

/**
 * v2.6807: the Bill desk's reads leave a ZZ test job out with its bills, its label and its ready days, for everyone
 * but a dev who shows them. The window's bills come back for every job, so the rule is applied here, after the read.
 */
const tables: Record<string, unknown[]> = {
  jobs_ledger_invoices: [
    { id: 'b1', job_id: 'real', amount: 4000, billed_at: '2026-11-03T15:00:00Z', sent_to_customer_at: '2026-11-03T15:00:00Z', sent_by_user_id: 'u1', status: 'billed' },
    { id: 'b2', job_id: 'zzJob', amount: 900, billed_at: '2026-11-04T15:00:00Z', sent_to_customer_at: null, sent_by_user_id: 'u1', status: 'billed' },
    { id: 'b3', job_id: 'zzNew', amount: 50, billed_at: '2026-11-05T15:00:00Z', sent_to_customer_at: null, sent_by_user_id: null, status: 'billed' },
  ],
  job_status_events: [
    { job_id: 'real', to_status: 'ready_to_bill', changed_at: '2026-11-01T15:00:00Z' },
    { job_id: 'zzJob', to_status: 'ready_to_bill', changed_at: '2026-11-02T15:00:00Z' },
    { job_id: 'zzNew', to_status: 'ready_to_bill', changed_at: '2026-11-02T15:00:00Z' },
  ],
  jobs_ledger: [
    { id: 'real', job_name: 'Hill Street remodel', customer_name: 'Ann Lee', hcp_number: '1024', click_number: null },
    { id: 'zzJob', job_name: 'ZZ TEST billed', customer_name: 'Ann Lee', hcp_number: '1041', click_number: null },
    // Made since the shared ids were read: its customer's name is the only thing that marks it.
    { id: 'zzNew', job_name: 'Walk through', customer_name: 'ZZ Test Customer', hcp_number: '1042', click_number: null },
  ],
  users: [{ id: 'u1', name: 'Taunya' }],
}
function fakeDb() {
  return {
    from(table: string) {
      const builder: unknown = new Proxy(
        {},
        {
          get(_t, prop) {
            if (prop === 'then') return (resolve: (v: unknown) => void) => resolve({ data: tables[table] ?? [], error: null })
            return () => builder
          },
        },
      )
      return builder
    },
  } as unknown as SupabaseClient<Database>
}
const args = { sinceYmd: '2026-10-01', pileJobIds: ['real'] }

describe('loadBillDeskReads and ZZ test jobs (v2.6807)', () => {
  it('leaves a ZZ job out by the shared ids and by its own names', async () => {
    const reads = await loadBillDeskReads(fakeDb(), { ...args, zzTestJobIds: new Set(['zzJob']) })
    expect(reads.invoices.map((i) => i.id)).toEqual(['b1'])
    expect([...reads.labels]).toEqual([['real', '1024 · Hill Street remodel']])
    expect([...reads.readyDaysByJob.keys()]).toEqual(['real'])
    expect(reads.invoices.map((i) => i.sentByName)).toEqual(['Taunya'])
  })

  it('keeps them for a dev who shows them', async () => {
    const reads = await loadBillDeskReads(fakeDb(), { ...args, zzTestJobIds: null })
    expect(reads.invoices.map((i) => i.id)).toEqual(['b1', 'b2', 'b3'])
    expect([...reads.labels.keys()]).toEqual(['real', 'zzJob', 'zzNew'])
    expect([...reads.readyDaysByJob.keys()]).toEqual(['real', 'zzJob', 'zzNew'])
  })
})
