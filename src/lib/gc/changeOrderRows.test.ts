/** A change order's row read back as the kernels read it (./changeOrderRows.ts). */
import { describe, expect, it } from 'vitest'
import { changeOrderFromRow, changeOrdersFromRows, withChangeRequests, type ChangeOrderRow, type ChangeRequestRow } from './changeOrderRows'
import { changeOrderScheduleWords, contractDaysAdded, signedChangeOrders } from './ownerBilling'
import { openChangeRequests } from './portal'
import { initialGcState } from './schedule/testState'
import { changeRequestFromRow } from './tradePortalState'
import type { GcProject } from './types'

const row = (over: Partial<ChangeOrderRow>): ChangeOrderRow => ({
  id: 'co-row-1',
  project_id: 'ef8905d1-039a-4cbc-9d69-9468cfea50e0',
  number: 1,
  description: 'Add a coffee bar cabinet, per the customer',
  reason: 'owner',
  schedule_words: '+3 days',
  package_id: 'pkg-concrete',
  cost: 1000,
  price: 1100,
  status: 'draft',
  sent_on: null,
  answered_on: null,
  answered_how: null,
  pct_done: 0,
  days: 3,
  days_on_chart: null,
  plan_set_id: null,
  created_by: null,
  created_at: '2026-10-08T15:00:00Z',
  ...over,
})

describe('a change order from its row', () => {
  it('reads every field the kernels read, and leaves daysOnChart off an ordinary one', () => {
    expect(changeOrderFromRow(row({}))).toEqual({
      id: 'co-row-1',
      number: 1,
      description: 'Add a coffee bar cabinet, per the customer',
      reason: 'owner',
      schedule: '+3 days',
      packageId: 'pkg-concrete',
      cost: 1000,
      price: 1100,
      status: 'draft',
      sentOn: null,
      answeredOn: null,
      pctDone: 0,
      days: 3,
    })
  })

  it('names a time extension’s moves, and reads money that comes back as text', () => {
    const co = changeOrderFromRow(row({ cost: '0' as unknown as number, price: '0' as unknown as number, days_on_chart: ['move-1', 'move-2'] }))
    expect([co.cost, co.price, co.daysOnChart]).toEqual([0, 0, ['move-1', 'move-2']])
  })

  it('reads an answer pressed in their portal and a decline’s reason, trimmed (O7c)', () => {
    const portal = changeOrderFromRow({ ...row({ status: 'declined', sent_on: '2026-10-08', answered_on: '2026-10-09', answered_how: 'portal' }), declined_note: ' Over our budget this year ' } as ChangeOrderRow)
    expect([portal.answeredInPortal, portal.declinedNote]).toEqual([true, 'Over our budget this year'])
    const office = changeOrderFromRow({ ...row({ status: 'signed', sent_on: '2026-10-08', answered_on: '2026-10-09', answered_how: 'office' }), declined_note: '' } as ChangeOrderRow)
    expect(['answeredInPortal' in office, 'declinedNote' in office]).toEqual([false, false])
  })

  it('refuses a status or a reason the app does not know', () => {
    expect(() => changeOrderFromRow(row({ status: 'maybe' }))).toThrow('status reads "maybe"')
    expect(() => changeOrderFromRow(row({ reason: 'whim' }))).toThrow('reason reads "whim"')
  })

  it('orders a project’s change orders by number, and the kernels count the signed ones’ days', () => {
    const orders = changeOrdersFromRows([
      row({ id: 'b', number: 2, status: 'signed', sent_on: '2026-10-08', answered_on: '2026-10-09', answered_how: 'office', days: 2, schedule_words: '+2 days' }),
      row({ id: 'a', number: 1, status: 'signed', sent_on: '2026-10-08', answered_on: '2026-10-09', answered_how: 'office' }),
      row({ id: 'c', number: 3, status: 'declined', sent_on: '2026-10-08', answered_on: '2026-10-09', answered_how: 'office', days: 9 }),
    ])
    expect(orders.map((co) => co.number)).toEqual([1, 2, 3])
    const project = { changeOrders: orders } as GcProject
    expect(signedChangeOrders(project).map((co) => co.id)).toEqual(['a', 'b'])
    expect(contractDaysAdded(project)).toBe(5)
    expect(changeOrderScheduleWords(orders[2]!)).toBe('adds 9 days to the job')
  })
})

/** A trade's ask as `gc_trade_change_requests` holds it (P4a). */
const askRow = (over: Partial<ChangeRequestRow>): ChangeRequestRow => ({
  id: 'cr-row-1',
  project_id: 'fairoaksd',
  package_id: 'fsite',
  company_id: 'tricounty',
  sow_id: 'sow-fsite',
  asked_on: '2026-09-30',
  description: 'Rock at the north footings, about 390 cubic yards to break out and haul off',
  reason: 'field',
  amount: 14820,
  days: 2,
  file_url: null,
  change_order_id: null,
  turned_down_on: null,
  turned_down_note: null,
  created_at: '2026-09-30T14:00:00Z',
  ...over,
})

describe('a trade\u2019s ask from its row (O3b, one mapper with the portal)', () => {
  it('reads the same request from the office\u2019s table row and the portal\u2019s slice row', () => {
    const fromTable = changeRequestFromRow(askRow({}))
    // The portal's slice carries the same columns, money as text from PostgREST included.
    const fromSlice = changeRequestFromRow({ ...askRow({}), amount: '14820', days: 2 })
    expect(fromTable).toEqual({
      id: 'cr-row-1',
      packageId: 'fsite',
      partnerId: 'tricounty',
      askedOn: '2026-09-30',
      description: 'Rock at the north footings, about 390 cubic yards to break out and haul off',
      reason: 'field',
      amount: 14820,
      days: 2,
      file: null,
      changeOrderId: null,
      turnedDown: null,
    })
    expect(fromSlice).toEqual(fromTable)
  })

  it('maps a row from another company to that company, the office\u2019s case (Helper 13)', () => {
    expect(changeRequestFromRow(askRow({ company_id: 'ironhorse' })).partnerId).toBe('ironhorse')
  })

  it('reads its answer: the change order made of it, or the day it was turned down and why', () => {
    expect(changeRequestFromRow(askRow({ change_order_id: 'co-4' })).changeOrderId).toBe('co-4')
    expect(changeRequestFromRow(askRow({ turned_down_on: '2026-10-07', turned_down_note: 'It was in the geotech report.' })).turnedDown).toEqual({
      on: '2026-10-07',
      note: 'It was in the geotech report.',
    })
  })

  it('lays each project\u2019s asks over the board, oldest first, and the open ones are what the window lists', () => {
    const state = withChangeRequests(initialGcState(), [
      askRow({ id: 'cr-b', asked_on: '2026-10-02', description: 'A second drive lane' }),
      askRow({ id: 'cr-a' }),
      askRow({ id: 'cr-c', turned_down_on: '2026-10-03', turned_down_note: 'In your scope.' }),
      askRow({ id: 'cr-x', project_id: 'stoneoak' }),
    ])
    const fairOaks = state.projects.find((p) => p.id === 'fairoaksd')!
    expect(fairOaks.changeRequests?.map((r) => r.id)).toEqual(['cr-a', 'cr-c', 'cr-b'])
    expect(openChangeRequests(fairOaks).map((r) => r.id)).toEqual(['cr-a', 'cr-b'])
    expect(state.projects.find((p) => p.id === 'stoneoak')?.changeRequests?.map((r) => r.id)).toEqual(['cr-x'])
    expect(state.projects.find((p) => p.id === 'helotes')?.changeRequests).toEqual([])
  })
})
