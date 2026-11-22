import { describe, expect, it } from 'vitest'
import { DRAW_PAY_RULE, drawClock, drawDueWords, ownerAppForDraw } from './drawPayClock'
import { plainWordsFailures } from '../plainWords'
import type { GcProject, OwnerBilling, OwnerPayAppSent } from './types'

const app = (number: number, sentOn: string, paidOn: string | null, final = false): OwnerPayAppSent =>
  ({ number, periodTo: sentOn, sentOn, doneToDate: {}, workToDate: 0, retainagePct: 10, retainage: 0, due: 1000, paidOn, ...(final ? { final: true } : {}) }) as OwnerPayAppSent

const job = (payApps: OwnerPayAppSent[] | undefined | null): GcProject =>
  ({ ownerBilling: payApps === null ? null : ({ ...(payApps ? { payApps } : {}) } as OwnerBilling) }) as GcProject

describe('ownerAppForDraw', () => {
  it('picks the first bill sent on or after the day the draw was approved', () => {
    const project = job([app(1, '2026-09-25', '2026-10-20'), app(2, '2026-10-26', null), app(3, '2026-11-25', null)])
    expect(ownerAppForDraw(project, '2026-10-22')?.number).toBe(2)
    expect(ownerAppForDraw(project, '2026-10-26')?.number).toBe(2)
    expect(ownerAppForDraw(project, '2026-10-27')?.number).toBe(3)
  })

  it('never rides on the final bill, which asks for retainage', () => {
    const project = job([app(4, '2026-12-01', '2026-12-20', true)])
    expect(ownerAppForDraw(project, '2026-11-28')).toBeNull()
  })

  it('finds none when no bill has gone since', () => {
    expect(ownerAppForDraw(job([app(1, '2026-09-25', '2026-10-20')]), '2026-10-01')).toBeNull()
  })
})

describe('drawClock', () => {
  const approved = { status: 'approved' as const, approvedOn: '2026-10-22' }

  it('is due ten days after the customer pays the bill it rode on', () => {
    const project = job([app(2, '2026-10-26', '2026-11-18')])
    expect(drawClock(project, approved)).toMatchObject({ payBy: '2026-11-28', waitsOn: null, fromApproval: false })
  })

  it('has no day while the customer has not paid, and says it waits on them', () => {
    const clock = drawClock(job([app(2, '2026-10-26', null)]), approved)
    expect(clock.payBy).toBeNull()
    expect(clock.waitsOn).toBe('customer')
    expect(clock.ownerApp?.number).toBe(2)
  })

  it('waits on our bill when none has gone since the approval', () => {
    expect(drawClock(job([]), approved)).toMatchObject({ payBy: null, waitsOn: 'ourBill', ownerApp: null })
  })

  it('does not count ten days from approval once bills are kept', () => {
    // The old rule made this draw due on Nov 1, before the customer had paid anything.
    expect(drawClock(job([app(2, '2026-10-26', null)]), approved).payBy).not.toBe('2026-11-01')
  })

  it('keeps the day from approval on a job whose bills are not kept one by one', () => {
    expect(drawClock(job(null), approved)).toMatchObject({ payBy: '2026-11-01', waitsOn: null, fromApproval: true })
    expect(drawClock(job(undefined), approved)).toMatchObject({ payBy: '2026-11-01', fromApproval: true })
  })

  it('reads nothing on a draw not approved yet', () => {
    expect(drawClock(job([app(2, '2026-10-26', '2026-11-18')]), { status: 'requested' })).toMatchObject({ payBy: null, waitsOn: null })
    expect(drawClock(job([app(2, '2026-10-26', '2026-11-18')]), { status: 'approved' })).toMatchObject({ payBy: null, waitsOn: null })
  })

  it('still reads a paid draw, so how late it was paid can be said', () => {
    const project = job([app(2, '2026-10-26', '2026-11-18')])
    expect(drawClock(project, { status: 'paid', approvedOn: '2026-10-22' }).payBy).toBe('2026-11-28')
  })
})

describe('the words', () => {
  it('say what an approved draw waits on, in plain words', () => {
    expect(drawDueWords('customer')).toBe('due 10 days after the customer pays us')
    expect(drawDueWords('ourBill')).toBe('due 10 days after the customer pays our next bill')
    for (const words of [DRAW_PAY_RULE, `It is ${drawDueWords('customer')}.`, `It is ${drawDueWords('ourBill')}.`]) expect(plainWordsFailures(words)).toEqual([])
  })
})
