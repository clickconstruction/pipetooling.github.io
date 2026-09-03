import { describe, expect, it } from 'vitest'
import { buildCategoryTagLookups, type CategoryTagRow } from './banking/categoryTags'
import { costLineTags, sumTagChargesByJob } from './mercuryTagSplit'

const fuel: CategoryTagRow = { id: 't-fuel', name: 'Fuel & gas', icon: '⛽', color: 'amber', sort_order: 0, default_key: 'fuel_vehicle', show_as_cost_line: true, hide_from_picker: false }
const permits: CategoryTagRow = { id: 't-gov', name: 'Government', icon: '🏛', color: 'gray', sort_order: 40, default_key: 'government', show_as_cost_line: true, hide_from_picker: false }
const retail: CategoryTagRow = { id: 't-retail', name: 'Retail & supply', icon: '🛒', color: 'blue', sort_order: 10, default_key: 'retail_supply', show_as_cost_line: false, hide_from_picker: false }
const lookups = buildCategoryTagLookups([retail, permits, fuel], [
  { tag_id: 't-fuel', bank_category: 'FuelAndGas', label_id: null },
  { tag_id: 't-fuel', bank_category: null, label_id: 'lbl-fuel' },
  { tag_id: 't-gov', bank_category: 'GovernmentServices', label_id: null },
  { tag_id: 't-retail', bank_category: 'Retail', label_id: null },
  { tag_id: 't-retail', bank_category: null, label_id: 'lbl-cogs' },
])

describe('costLineTags', () => {
  it('returns only cost-line tags in manager order', () => {
    expect(costLineTags(lookups).map((t) => t.id)).toEqual(['t-fuel', 't-gov'])
  })
})

describe('sumTagChargesByJob', () => {
  it('files each charge under its label’s tag, else its bank category’s tag, and keeps only cost-line tags', () => {
    const rows = [
      { job_id: 'a', amount: -50, mercury_transaction_id: 't1' }, // label fuel, bank retail → fuel
      { job_id: 'a', amount: -20.5, mercury_transaction_id: 't2' }, // unlabelled, bank fuel → fuel
      { job_id: 'a', amount: -125, mercury_transaction_id: 't3' }, // label cogs → retail (not a cost line)
      { job_id: 'a', amount: -58, mercury_transaction_id: 't4' }, // unlabelled, bank government → permits line
      { job_id: 'b', amount: '-9', mercury_transaction_id: 't5' }, // label cogs, bank fuel → retail (label wins)
      { job_id: 'b', amount: -9, mercury_transaction_id: 't6' }, // unlabelled, bank Other → no tag
      { job_id: 'c', amount: -30, mercury_transaction_id: null },
    ]
    const labels = new Map([['t1', 'lbl-fuel'], ['t3', 'lbl-cogs'], ['t5', 'lbl-cogs']])
    const cats = new Map<string, unknown>([['t1', 'Retail'], ['t2', 'FuelAndGas'], ['t3', 'Retail'], ['t4', { name: 'GovernmentServices' }], ['t5', 'FuelAndGas'], ['t6', 'Other']])
    const out = sumTagChargesByJob(rows, labels, cats, lookups)
    expect(out.get('a')?.get('t-fuel')).toBeCloseTo(70.5)
    expect(out.get('a')?.get('t-gov')).toBe(58)
    expect(out.get('a')?.has('t-retail')).toBe(false)
    expect(out.has('b')).toBe(false)
    expect(out.has('c')).toBe(false)
  })
})
