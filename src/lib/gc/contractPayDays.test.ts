/**
 * The contract's days to pay (O5d): a bill falls due by the customer's own days to pay first, then by the contract's
 * when they have never paid us, and a promise they gave still comes first. So a first-time customer's bill can go
 * late, and Remind them to pay shows. The forecast takes the same days for the bills not sent yet (O6b-1).
 */
import { describe, expect, it } from 'vitest'
import { addDays } from './building'
import { expectedBills } from './cashForecast'
import { ownerExpectPaidOn, ownerPayApp, ownerPayDaysWords, ownerPayDue } from './ownerBilling'
import { payReminderStep } from './ownerBillingRemind'
import { initialGcState } from './schedule/testState'
import type { GcState, OwnerPayAppSent } from './types'

/** Fair Oaks D, its last bill certified as asked on Sep 20 and open; its customer's own days and the contract's as given. The state's today is Oct 2. */
function job(payDays: number | null, ownerPayDays: number | null | undefined, over: Partial<OwnerPayAppSent> = {}) {
  const s = initialGcState()
  const p = s.projects.find((x) => x.id === 'fairoaksd')!
  const apps = p.ownerBilling!.payApps!
  const app: OwnerPayAppSent = { ...apps[apps.length - 1]!, certified: apps[apps.length - 1]!.due, certifiedOn: '2026-09-20', paidOn: null, payments: [], promises: [], ...over }
  const project = { ...p, ownerPayDays, ownerBilling: { ...p.ownerBilling!, payApps: [...apps.slice(0, -1), app] } }
  const state: GcState = {
    ...s,
    customers: s.customers.map((c) => (c.id === p.customerId ? { ...c, payDays } : c)),
    projects: s.projects.map((x) => (x.id === p.id ? project : x)),
  }
  return { state, project, app }
}

describe('when a bill falls due', () => {
  it('counts the customer\'s own days to pay first', () => {
    const { state, project, app } = job(20, 30)
    expect(ownerExpectPaidOn(state, project, app)).toBe('2026-10-10')
  })

  it('counts the contract\'s days from the certificate while they have never paid us', () => {
    const { state, project, app } = job(null, 30)
    expect(ownerExpectPaidOn(state, project, app)).toBe('2026-10-20')
  })

  it('knows no day with neither', () => {
    for (const days of [null, undefined]) {
      const { state, project, app } = job(null, days)
      expect(ownerExpectPaidOn(state, project, app)).toBeNull()
    }
  })

  it('still puts a promise first', () => {
    const { state, project, app } = job(null, 30, { promises: [{ by: '2026-09-25', madeOn: '2026-09-21', note: 'Check is cut', who: 'office' }] })
    expect(ownerPayDue(state, project, app)).toMatchObject({ on: '2026-09-25', promised: true })
  })

  it('lets a first-time customer\'s bill go late by the contract\'s days, so the reminder shows', () => {
    const late = job(null, 5)
    expect(ownerPayDue(late.state, late.project, late.app)).toMatchObject({ on: '2026-09-25', promised: false, daysLate: 7 })
    expect(payReminderStep(late.state, late.project, late.app.number)?.history).toBe('Due Sep 25, 7 days late. This is the first reminder.')
    const untyped = job(null, null)
    expect(payReminderStep(untyped.state, untyped.project, untyped.app.number)).toBeNull()
  })

  it('says the contract\'s days in the terms, or asks for them', () => {
    expect([ownerPayDaysWords(30), ownerPayDaysWords(1), ownerPayDaysWords(null), ownerPayDaysWords(undefined)]).toEqual([
      'They pay within 30 days of the certificate, by the contract.',
      'They pay within 1 day of the certificate, by the contract.',
      'Type the contract\'s days to pay so a first bill can go late.',
      'Type the contract\'s days to pay so a first bill can go late.',
    ])
  })
})

describe('when the forecast expects the next bill paid (O6b-1)', () => {
  it('counts the customer\'s own days, then the contract\'s, then none', () => {
    for (const [payDays, contract, plus] of [[20, 30, 20], [null, 30, 30], [null, null, null]] as const) {
      const { state, project } = job(payDays, contract)
      const draft = ownerPayApp(state, project)
      expect(draft.expectPaidOn).toBe(plus === null ? null : addDays(draft.billOn, plus))
    }
  })

  it('puts a first-time customer\'s next bill in the weeks ahead by the contract\'s days', () => {
    const { state, project } = job(null, 30)
    const draft = ownerPayApp(state, project)
    expect(expectedBills(state, project, 'reported').map((m) => m.on)).toEqual([addDays(draft.billOn, 30)])
    const none = job(null, null)
    expect(expectedBills(none.state, none.project, 'reported').map((m) => m.on)).toEqual([null])
  })
})
