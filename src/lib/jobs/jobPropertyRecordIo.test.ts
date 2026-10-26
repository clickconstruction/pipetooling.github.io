import { beforeEach, describe, expect, it, vi } from 'vitest'

const db = vi.hoisted(() => ({
  rows: {} as Record<string, Array<Record<string, unknown>>>,
  /** Tables whose reads come back refused, as RLS refuses them. */
  denied: new Set<string>(),
  reads: [] as string[],
}))

vi.mock('../supabase', () => ({
  supabase: {
    from: (table: string) => {
      const keep: Array<(r: Record<string, unknown>) => boolean> = []
      const b: Record<string, unknown> = {}
      b.select = () => b
      b.eq = (col: string, v: unknown) => {
        keep.push((r) => r[col] === v)
        return b
      }
      b.maybeSingle = async () => {
        db.reads.push(table)
        if (db.denied.has(table)) return { data: null, error: { code: '42501', message: `permission denied for table ${table}` } }
        return { data: (db.rows[table] ?? []).find((r) => keep.every((k) => k(r))) ?? null, error: null }
      }
      return b
    },
  },
}))

import { readJobPropertyRecord } from './jobPropertyRecordIo'

const SITE = { id: 'site-891', customer_id: 'gc-burd', address: '11730 TX-29, Liberty Hill, TX 78642', property_kind: 'non_residential' }

beforeEach(() => {
  db.rows = { jobs_ledger: [{ id: 'job-891', customer_address_id: 'site-891' }], customer_addresses: [SITE] }
  db.denied = new Set()
  db.reads = []
})

describe('readJobPropertyRecord', () => {
  it('reads the link on the job’s own row, not the caller’s copy', async () => {
    expect(await readJobPropertyRecord('job-891', null)).toEqual({ link: 'site-891', record: SITE })
    expect(db.reads).toEqual(['jobs_ledger', 'customer_addresses'])
  })

  it('a job its own row leaves unlinked has no record, whatever the caller’s copy says', async () => {
    db.rows.jobs_ledger = [{ id: 'job-891', customer_address_id: null }]
    expect(await readJobPropertyRecord('job-891', 'site-891')).toEqual({ link: null, record: null })
    expect(db.reads).toEqual(['jobs_ledger'])
  })

  it('keeps the caller’s link when the job’s row cannot be read or is not there', async () => {
    db.denied.add('jobs_ledger')
    expect(await readJobPropertyRecord('job-891', 'site-891')).toEqual({ link: 'site-891', record: SITE })
    db.denied.clear()
    db.rows.jobs_ledger = []
    expect(await readJobPropertyRecord('job-891', 'site-891')).toEqual({ link: 'site-891', record: SITE })
  })

  it('a record that cannot be read is null, so the kind is unknown, and the link is kept', async () => {
    db.denied.add('customer_addresses')
    expect(await readJobPropertyRecord('job-891', null)).toEqual({ link: 'site-891', record: null })
  })
})
