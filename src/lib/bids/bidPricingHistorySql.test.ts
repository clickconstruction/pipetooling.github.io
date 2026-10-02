/**
 * `bid_pricing_history` (the Pricing win/loss strip's read) prices a past bid the way
 * `computeBidCostBreakdown` prices the bid on screen, materials aside (v2.4372). The SQL cannot
 * run here, so these pin its newest body to the kernel: the labor-row rule, no estimator time,
 * and a distance read that matches parseFloat. A kernel change that fails here changes the RPC too.
 */
import { readdirSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { computeBidCostBreakdown } from './bidTotalCostBreakdown'
import { LABOR_FOOTAGE_UNIT, laborRowMultiplier } from './laborRowHours'

const MIGRATIONS = resolve(__dirname, '../../../supabase/migrations')
const newestBody = (() => {
  const files = readdirSync(MIGRATIONS)
    .filter((f) => f.endsWith('.sql'))
    .sort()
    .filter((f) => /CREATE (OR REPLACE )?FUNCTION public\.bid_pricing_history\(/.test(readFileSync(resolve(MIGRATIONS, f), 'utf8')))
  const sql = readFileSync(resolve(MIGRATIONS, files[files.length - 1]!), 'utf8')
  return sql.slice(sql.indexOf('AS $$'), sql.lastIndexOf('$$;'))
})()

const row = (r: Partial<Parameters<typeof laborRowMultiplier>[0]>) => ({
  count: 4, is_fixed: false, kind: 'fixture', unit: 'each', rough_in_hrs_per_unit: 1, top_out_hrs_per_unit: 1, trim_set_hrs_per_unit: 1, ...r,
})

describe('bid_pricing_history reads a past bid like the Workbench (v2.4372)', () => {
  it('adds no estimator time (v2.3294)', () => {
    expect(newestBody).not.toMatch(/estimator_cost/)
  })

  it.each([
    ["WHEN r.kind = 'sub' THEN 0", row({ kind: 'sub' }), 0],
    ["WHEN r.is_fixed OR r.kind = 'task' THEN 1", row({ kind: 'task' }), 1],
    ["WHEN r.is_fixed OR r.kind = 'task' THEN 1", row({ is_fixed: true }), 1],
    [`WHEN r.unit = 'per_100ft' THEN r.count / ${LABOR_FOOTAGE_UNIT}.0`, row({ unit: 'per_100ft', count: 250 }), 2.5],
    ['ELSE r.count', row({}), 4],
  ])('labor rows: %s', (sqlBranch, r, multiplier) => {
    expect(laborRowMultiplier(r)).toBe(multiplier)
    expect(newestBody).toContain(sqlBranch)
  })

  it.each(['96', '96.4 mi', ' 30', '1,158.5', 'about 12', '-5', '+.5', '5.', '.', '', '1e3', '12east', '1.2.3', '12-15'])(
    'distance %j reads as the Workbench reads it',
    (text) => {
      const pattern = /distance_from_office FROM '([^']+)'/.exec(newestBody)?.[1]
      expect(pattern).toBeDefined()
      const sql = Number(new RegExp(pattern!).exec(text)?.[1] ?? 0)
      const kernel = computeBidCostBreakdown({
        materialTotalRoughIn: 0, materialTotalTopOut: 0, materialTotalTrimSet: 0, laborRate: 0, laborRows: [],
        distanceFromOffice: text, costEstimate: {}, countRowsLength: 0,
      }).distance
      expect(sql).toBe(kernel)
    },
  )
})
