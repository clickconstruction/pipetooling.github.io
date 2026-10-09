/**
 * Every rewrite of a job's revenue from its line items adds the riders (v2.5091): the job's hazmat fees and every
 * returned check fee on its bills. Each raised the revenue when it went on, and a rewrite that forgets one writes
 * it away while the bill keeps it. The client's sum is `jobFormRiderFeesDollars`; the database's is
 * `job_rider_fees`, migration 20261010023000. The SQL cannot run here (its PGlite check is in the migration's
 * doc), so these pin each function's newest body. A later restatement copied from an older file would drop the
 * riders again, and it fails here.
 */
import { readdirSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const MIGRATIONS = resolve(__dirname, '../../../supabase/migrations')
const migrationFiles = readdirSync(MIGRATIONS).filter((f) => f.endsWith('.sql')).sort()
const migrationSql = new Map(migrationFiles.map((f) => [f, readFileSync(resolve(MIGRATIONS, f), 'utf8')]))

const CREATE = /CREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION\s+"?public"?\."?(\w+)"?\s*\(/gi

/** Each function's newest body: from its last CREATE to the dollar tag that closes it. */
const newestBodies = (() => {
  const out = new Map<string, { file: string; body: string }>()
  for (const file of migrationFiles) {
    const sql = migrationSql.get(file)!
    for (const m of sql.matchAll(CREATE)) {
      const start = m.index!
      const tag = /\bAS\s+(\$\w*\$)/i.exec(sql.slice(start))
      if (!tag) continue
      const open = start + tag.index + tag[0].length
      const close = sql.indexOf(tag[1]!, open)
      out.set(m[1]!.toLowerCase(), { file, body: sql.slice(start, close < 0 ? undefined : close + tag[1]!.length) })
    }
  }
  return out
})()

/** A function that sets the revenue to a figure it worked out, and touches the job's line items. */
const rewritesRevenueFromLines = (body: string): boolean => /jobs_ledger_fixtures/i.test(body) && /\bset\s+revenue\s*=\s*v_\w+/i.test(body)

/** The rewriters that add the riders. */
const KEEP_THE_RIDERS = ['add_collect_payment_fixture_from_job_book', 'apply_job_discount', 'record_job_tip_from_deposit']
/** Rewriters with no rider to keep, and why. */
const NO_RIDER_YET: Record<string, string> = {
  create_job_from_estimate: 'it sums the lines of a job it has just made, which has no bill and no hazmat fee yet',
}

describe('every rewrite of the revenue from the line items keeps the riders (v2.5091)', () => {
  it('finds the rewriters this test knows, and no other', () => {
    const found = [...newestBodies].filter(([, v]) => rewritesRevenueFromLines(v.body)).map(([name]) => name).sort()
    expect(found).toEqual([...KEEP_THE_RIDERS, ...Object.keys(NO_RIDER_YET)].sort())
  })

  it.each(KEEP_THE_RIDERS)('%s adds job_rider_fees to the lines it sums', (name) => {
    const { file, body } = newestBodies.get(name)!
    expect(file, `${name}'s newest body is the one that adds the riders`).toBe('20261010023000_revenue_keeps_check_fee.sql')
    expect(body).toMatch(/\+\s*public\.job_rider_fees\(p_job_id\)/)
    // The riders come from the helper alone, so a hazmat fee is never counted twice.
    expect(body).not.toMatch(/job_hazmat_incidents/)
  })

  it('job_rider_fees counts the un-voided hazmat fees and every fee line that names its case', () => {
    const { body } = newestBodies.get('job_rider_fees')!
    expect(body).toMatch(/FROM public\.job_hazmat_incidents h\s+WHERE h\.job_id = p_job_id AND h\.voided_at IS NULL/)
    expect(body).toMatch(/jsonb_typeof\(l->'case_id'\) = 'string' AND btrim\(l->>'case_id'\) <> ''/)
    expect(body).toMatch(/FROM public\.jobs_ledger_invoices i/)
    expect(body).toMatch(/WHERE i\.job_id = p_job_id/)
  })

  it('job_rider_fees counts a GC card fee too, and the GC billing job\'s revenue adds the riders (v2.5113)', () => {
    const riders = newestBodies.get('job_rider_fees')!
    expect(riders.body).toMatch(/jsonb_typeof\(l->'card_bill'\) = 'string' AND btrim\(l->>'card_bill'\) <> ''/)
    const revenue = newestBodies.get('gc_owner_billing_revenue')!
    expect(revenue.body).toMatch(/public\.job_rider_fees\(g\.billing_job_id\)/)
    // The card fee goes on its bill as the rider job_rider_fees reads.
    const finish = newestBodies.get('gc_card_bill_finish')!
    expect(finish.body).toMatch(/'card_bill', p_invoice_id/)
  })

  it('the returned check fee still raises the revenue with its bill, so the riders have something to keep', () => {
    const { body } = newestBodies.get('add_ar_return_case_fee')!
    expect(body).toMatch(/SET revenue = coalesce\(revenue, 0\) \+ v_fee/)
    expect(body).toMatch(/'case_id', p_case_id/)
  })
})
