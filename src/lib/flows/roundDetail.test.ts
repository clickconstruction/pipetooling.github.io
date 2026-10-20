import { describe, expect, it } from 'vitest'
import { boardStateFromRows } from '../gc/boardRows'
import { clinicBoardRows } from '../gc/boardTestRows'
import { ownerContractWorthOf } from '../gc/ownerBilling'
import type { ChangeOrder, GcProject, OwnerPayAppSent } from '../gc/types'
import { roundDetailFromProject } from './roundDetail'

const base = boardStateFromRows(clinicBoardRows()).projects[0]!
const co = (over: Partial<ChangeOrder>): ChangeOrder => ({ id: 'co-1', number: 1, description: 'exam 2 cabinets', reason: 'owner', schedule: 'none', packageId: null, cost: 1000, price: 1200, status: 'signed', sentOn: '2026-09-24', answeredOn: '2026-09-28', pctDone: 0, ...over }) as ChangeOrder
const app = (over: Partial<OwnerPayAppSent>): OwnerPayAppSent => ({ number: 4, periodTo: '2026-09-30', sentOn: '2026-09-28', doneToDate: {}, workToDate: 0, retainagePct: 10, retainage: 0, due: 118600, paidOn: null, certified: null, ...over })
const project: GcProject = {
  ...base,
  architect: 'Marsh & Vale Architects',
  changeOrders: [co({}), co({ id: 'co-2', number: 2, description: 'a sink in exam 3', price: 2600, status: 'sent', answeredOn: null, schedule: '+2 working days', sentOn: '2026-09-30' })],
  ownerBilling: { billed: 0, paid: 0, retainageHeld: 0, payApps: [app({ number: 3, paidOn: '2026-09-25', certified: 98000, certifiedOn: '2026-09-22' }), app({})] },
}
const CO_STEP = { facts: ['co_answered' as const] }
const PAY_STEP = { facts: ['payapp_paid' as const] }
const contract = Object.values(ownerContractWorthOf(project)).reduce((s, v) => s + v, 0)

describe('roundDetailFromProject', () => {
  it('fills a change order from its id, the sum after counting the signed ones before it, for the money team', () => {
    expect(roundDetailFromProject(project, CO_STEP, { key: 'co-2', name: 'CO 2 · a sink in exam 3' }, true)).toEqual({
      changeOrder: { what: 'a sink in exam 3', adds: 2600, days: '+2 working days', sumBefore: contract + 1200, sentOn: '2026-09-30', openedOn: null },
    })
  })

  it('leaves the money out for a reader who may not see it', () => {
    expect(roundDetailFromProject(project, CO_STEP, { key: 'co-2', name: 'CO 2' }, false).changeOrder).toMatchObject({ adds: null, sumBefore: null, what: 'a sink in exam 3' })
    expect(roundDetailFromProject(project, CO_STEP, { key: 'co-1', name: 'CO 1' }, true).changeOrder?.days).toBeNull()
  })

  it('fills a pay application by its number: with the architect, or certified and paid', () => {
    expect(roundDetailFromProject(project, PAY_STEP, { key: 'pa-4', name: 'Pay app 4' }, true).payApp).toEqual({
      covers: 'work through Sep 30',
      amount: 118600,
      certifiedBy: null,
      certifiedOn: null,
      withArchitect: { name: 'Marsh & Vale Architects', since: '2026-09-28' },
      paidOn: null,
      waivers: null,
      tradesPaidOn: null,
    })
    expect(roundDetailFromProject(project, PAY_STEP, { key: 'pa-3', name: 'Pay app 3' }, false).payApp).toMatchObject({ amount: null, certifiedBy: 'Marsh & Vale Architects', certifiedOn: '2026-09-22', withArchitect: null, paidOn: '2026-09-25' })
  })

  it('fills nothing for a round it cannot find, another step, or no project', () => {
    expect(roundDetailFromProject(project, CO_STEP, { key: 'co-9', name: 'CO 9' }, true)).toEqual({})
    expect(roundDetailFromProject(project, { facts: ['question_answered' as const] }, { key: 'q', name: 'Pond' }, true)).toEqual({})
    expect(roundDetailFromProject(undefined, CO_STEP, { key: 'co-1', name: 'CO 1' }, true)).toEqual({})
  })
})
