import { describe, expect, expectTypeOf, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { CHANGE_ORDER_OFFICE_COLUMNS, changeOrderFromOfficeRow, withOfficeChangeOrders, type ChangeOrderOfficeRow } from './changeOrderOfficeRows'
import { initialGcState } from './schedule/testState'

const row = (over: Partial<ChangeOrderOfficeRow> = {}): ChangeOrderOfficeRow => ({
  id: 'co-1', project_id: 'fairoaksd', number: 1, description: 'Thicker slab at grid C', reason: 'plans', schedule_words: 'Two more days on the slab.',
  package_id: 'fconc', status: 'signed', sent_on: '2026-09-24', answered_on: '2026-09-26', days: 2, days_on_chart: null, ...over,
})

describe('the office’s view of a change order (the schedule’s PR 16b-ii)', () => {
  it('never carries cost, price or pct_done: the row type has exactly the twelve, and so does the io’s select', () => {
    type Keys = keyof ChangeOrderOfficeRow
    expectTypeOf<Keys>().toEqualTypeOf<'id' | 'project_id' | 'number' | 'description' | 'reason' | 'schedule_words' | 'package_id' | 'status' | 'sent_on' | 'answered_on' | 'days' | 'days_on_chart'>()
    expect(CHANGE_ORDER_OFFICE_COLUMNS.split(', ').sort()).toEqual(['answered_on', 'days', 'days_on_chart', 'description', 'id', 'number', 'package_id', 'project_id', 'reason', 'schedule_words', 'sent_on', 'status'])
    for (const money of ['cost', 'price', 'pct_done']) expect(CHANGE_ORDER_OFFICE_COLUMNS).not.toContain(money)
  })

  it('reads the view and never the money team’s table', () => {
    const io = readFileSync(new URL('./changeOrderOfficeIo.ts', import.meta.url), 'utf8')
    expect(io).toMatch(/from\('gc_change_orders_office'( as never)?\)/)
    expect(io).not.toMatch(/from\('gc_change_orders'[\s)]/)
  })

  it('becomes the kernels’ change order with its money hidden at 0', () => {
    expect(changeOrderFromOfficeRow(row())).toEqual({
      id: 'co-1', number: 1, description: 'Thicker slab at grid C', reason: 'plans', schedule: 'Two more days on the slab.', packageId: 'fconc',
      cost: 0, price: 0, pctDone: 0, status: 'signed', sentOn: '2026-09-24', answeredOn: '2026-09-26', days: 2,
    })
    expect(changeOrderFromOfficeRow(row({ days_on_chart: ['move-1'], days: 4 }))?.daysOnChart).toEqual(['move-1'])
    expect(changeOrderFromOfficeRow(row({ id: null }))).toBeNull()
    expect(() => changeOrderFromOfficeRow(row({ status: 'lost' }))).toThrow('A change order\'s status reads "lost", which the app does not know.')
  })

  it('lays each job’s change orders over it, oldest number first, and gives a job with none an empty list', () => {
    const s = withOfficeChangeOrders(initialGcState(), [row({ id: 'co-2', number: 2 }), row(), row({ id: 'co-9', project_id: 'nowhere', number: 9 })])
    expect(s.projects.find((p) => p.id === 'fairoaksd')!.changeOrders!.map((c) => c.number)).toEqual([1, 2])
    expect(s.projects.find((p) => p.id === 'stoneoak')!.changeOrders).toEqual([])
  })
})
