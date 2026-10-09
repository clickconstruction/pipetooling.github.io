/**
 * `stamp_bid_priced_margin` (v2.5043) is the one write of a bid's priced margin. The SQL cannot run
 * here, so these pin its newest body to the kernel and the client: the margin arithmetic, the
 * freeze at send, the reasons `pricedMarginIo` reads, the columns it reads back, and that a stamp
 * writes no bid-history row. The function was run on a local Postgres before the PR.
 */
import { readdirSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { BID_PRICED_MARGIN_COLUMNS } from './pricedMarginIo'
import { pricedMarginPct } from './pricedMargin'

const MIGRATIONS = resolve(__dirname, '../../../supabase/migrations')
const files = readdirSync(MIGRATIONS).filter((f) => f.endsWith('.sql')).sort()
const newestDefining = (re: RegExp) => {
  const hits = files.filter((f) => re.test(readFileSync(resolve(MIGRATIONS, f), 'utf8')))
  return readFileSync(resolve(MIGRATIONS, hits[hits.length - 1]!), 'utf8')
}
const sql = newestDefining(/CREATE (OR REPLACE )?FUNCTION public\.stamp_bid_priced_margin\(/)
const body = sql.slice(sql.indexOf('AS $$'), sql.lastIndexOf('$$;'))

describe('stamp_bid_priced_margin (v2.5043)', () => {
  it('computes the margin as the kernel does', () => {
    expect(body).toContain('v_margin := round((v_revenue - v_cost) / v_revenue * 100, 2);')
    expect(body).toContain('v_revenue numeric := round(coalesce(p_revenue_usd, 0), 2);')
    expect(body).toContain('v_cost numeric := round(greatest(0, coalesce(p_cost_usd, 0)), 2);')
    expect(pricedMarginPct({ revenueUsd: 48_700, costUsd: 33_400, uncostedUsd: 0, rateSet: true })).toBe(Math.round(((48_700 - 33_400) / 48_700) * 100 * 100) / 100)
  })
  it('never writes a sent bid, and says why nothing was written', () => {
    expect(body).toContain('AND b.bid_date_sent IS NULL')
    for (const reason of ["'no_revenue'", "'sent'", "'refused'"]) expect(body).toContain(reason)
  })
  it('runs as the caller, so the bid’s own policies and fences decide', () => {
    expect(sql).toMatch(/stamp_bid_priced_margin[\s\S]*SECURITY INVOKER/)
    expect(sql).toContain("SET search_path = ''")
    expect(sql).toContain('REVOKE EXECUTE ON FUNCTION public.stamp_bid_priced_margin(uuid, uuid, numeric, numeric, numeric, boolean) FROM PUBLIC, anon;')
  })
  it('writes and adds every column the client reads back', () => {
    for (const col of BID_PRICED_MARGIN_COLUMNS.split(', ').filter((c) => c !== 'id')) {
      expect(sql).toContain(`ADD COLUMN IF NOT EXISTS ${col} `)
      expect(body).toContain(`${col} = `)
    }
  })
  it('a stamp writes no bid-history row: the capture trigger does not watch the priced columns', () => {
    const capture = newestDefining(/FUNCTION public\.bid_changes_bid_columns\(/)
    expect(capture).not.toMatch(/priced_/)
  })
})
