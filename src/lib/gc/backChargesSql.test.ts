/**
 * The portal's two records in SQL (P4a, `to-dos/gc-mode/mockups/portal-p4.md` on spike/gc-mode): the
 * migration's numbers and lists are the kernels' own, so a change to one copy that the other does not
 * make fails here. The verbs themselves run in the bed `supabase/tests/gc_back_charges` (GitHub, the
 * whole schema).
 */
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { BACK_CHARGE_ANSWER_DAYS, PORTAL_CHANGE_WHY } from './portal'
import type { BackCharge } from './types'

const DIR = join(process.cwd(), 'supabase', 'migrations')
const migration = (suffix: string) => readFileSync(join(DIR, readdirSync(DIR).find((f) => f.endsWith(suffix))!), 'utf8')
const SQL = migration('_gc_back_charges_change_requests.sql')
const OWNER_BILLING = migration('_gc_owner_billing_tables.sql')

/** The words of a CHECK's `IN (…)` list, sorted. */
const checkList = (sql: string, name: string) => {
  const m = sql.match(new RegExp(`${name} CHECK \\(\\w+ IN \\(([^)]*)\\)\\)`))
  return [...(m?.[1] ?? '').matchAll(/'(\w+)'/g)].map((x) => x[1]!).sort()
}

/** Every status a charge can have, so the type and the list cannot part. */
const BACK_CHARGE_STATUSES = { open: true, agreed: true, disputed: true, kept: true, dropped: true } satisfies Record<BackCharge['status'], true>

describe('P4a: the tables hold the kernels’ rules', () => {
  it('a charge’s answer day is BACK_CHARGE_ANSWER_DAYS after it was sent', () => {
    const days = SQL.match(/answer_by date NOT NULL GENERATED ALWAYS AS \(sent_on \+ (\d+)\) STORED/)?.[1]
    expect(days).toBe(String(BACK_CHARGE_ANSWER_DAYS))
  })

  it('a charge’s statuses are BackCharge’s', () => {
    expect(checkList(SQL, 'gc_back_charges_status_known')).toEqual(Object.keys(BACK_CHARGE_STATUSES).sort())
  })

  it('a request’s reasons are the three the portal offers, and a change order’s', () => {
    const reasons = checkList(SQL, 'gc_trade_change_requests_reason_known')
    expect(reasons).toEqual(PORTAL_CHANGE_WHY.map((w) => w.reason).sort())
    expect(reasons).toEqual(checkList(OWNER_BILLING, 'gc_change_orders_reason_known'))
  })
})
