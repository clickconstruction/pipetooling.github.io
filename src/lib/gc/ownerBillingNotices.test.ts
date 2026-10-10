/**
 * GC mode, Owner Billing's O10a: the office's notices read bill day on the server. `get_gc_office_notices_due()` names
 * the 25th itself, so it is held here to the client's `OWNER_BILL_DAY` (`nextOwnerBillDay`): the day the notice counts
 * back from is the day Bill the customer drafts for.
 */
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { nextOwnerBillDay, OWNER_BILL_DAY } from './ownerBilling'

/** The newest migration that defines the office notices' payload. */
function payloadSql(): string {
  const dir = join(process.cwd(), 'supabase', 'migrations')
  const sql = readdirSync(dir)
    .filter((f) => f.endsWith('.sql'))
    .sort()
    .reverse()
    .map((f) => readFileSync(join(dir, f), 'utf8'))
    .find((s) => s.includes('FUNCTION public.get_gc_office_notices_due('))
  if (!sql) throw new Error('no migration defines get_gc_office_notices_due')
  return sql
}

describe('the office notices’ bill day (O10a)', () => {
  it('is the client’s bill day, in each of the three places the payload names it', () => {
    const sql = payloadSql()
    const days = [...sql.matchAll(/EXTRACT\(DAY FROM t\.d\) <= (\d+)|EXTRACT\(MONTH FROM t\.d\)::int, (\d+)\)/g)].map((m) => Number(m[1] ?? m[2]))
    expect(days).toEqual([OWNER_BILL_DAY, OWNER_BILL_DAY, OWNER_BILL_DAY])
  })

  it('counts back from the same day nextOwnerBillDay gives', () => {
    expect(nextOwnerBillDay('2026-10-23')).toBe('2026-10-25')
    expect(nextOwnerBillDay('2026-10-25')).toBe('2026-10-25')
    expect(nextOwnerBillDay('2026-10-26')).toBe('2026-11-25')
    expect(nextOwnerBillDay('2026-12-26')).toBe('2027-01-25')
  })
})
