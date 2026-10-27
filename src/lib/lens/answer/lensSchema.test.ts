import schema from 'virtual:lens-schema'
import { describe, expect, it } from 'vitest'
import { lensSchemaFromDatabaseTs } from '../../../../scripts/lens/lensSchema'
import type { LensRelation } from './lensSchemaTypes'

const SNIPPET = `
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]
export type Database = {
  public: {
    Tables: {
      jobs: {
        Row: { id: string; customer_id: string | null; name: string }
        Insert: { id?: string }
        Update: { id?: string }
        Relationships: [
          { foreignKeyName: "jobs_customer_id_fkey"; columns: ["customer_id"]; isOneToOne: false; referencedRelation: "customers"; referencedColumns: ["id"] },
        ]
      }
      customers: { Row: { id: string; name: string }; Insert: {}; Update: {}; Relationships: [] }
    }
    Views: { open_jobs: { Row: { id: string | null }; Relationships: [] } }
    Functions: {
      list_jobs: { Args: { p: string }; Returns: { id: string }[] }
      job_count: { Args: never; Returns: number }
      maybe_name: { Args: never; Returns: string | null }
      board: { Args: never; Returns: Json }
      touch: { Args: never; Returns: undefined }
      over: { Args: { a: string }; Returns: Json } | { Args: { b: string }; Returns: { id: string }[] }
    }
  }
}
`

describe('the lens schema map', () => {
  it('reads columns, foreign keys, views and what each RPC returns', () => {
    const s = lensSchemaFromDatabaseTs(SNIPPET)
    expect(s.tables.jobs).toEqual({ columns: ['id', 'customer_id', 'name'], rel: [{ fk: 'jobs_customer_id_fkey', columns: ['customer_id'], ref: 'customers', refColumns: ['id'], one: false }] })
    expect(s.tables.open_jobs).toEqual({ view: true, columns: ['id'], rel: [] })
    expect(s.rpcs).toEqual({ list_jobs: 'set', job_count: 'scalar', maybe_name: 'scalar', board: 'json', touch: 'void', over: 'set' })
  })

  it('is read from the real types when the lens is built', () => {
    expect(schema.tables.users?.columns).toContain('role')
    expect(schema.tables.jobs_ledger?.rel.some((r: LensRelation) => r.ref === 'customers' && r.columns.includes('customer_id'))).toBe(true)
    expect(schema.rpcs._schedule_total_block_counts).toBe('set')
    expect(schema.rpcs._ar_payer_key).toBe('scalar')
    expect(schema.rpcs._pay_staff_bulk_insert_user_time_off_row).toBe('json')
    expect(schema.rpcs._replace_mercury_transaction_invoice_links).toBe('void')
  })
})
