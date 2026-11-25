/**
 * The due day a Stripe bill is made with (punch list #343). The live walk of 2026-11-24 pressed at 7:24 PM Central on
 * a bill due that day, and the made bill read due the day after. Every case here reads the made instant back the way
 * the app's pages do (`stripeUnixToAppYmd`, the company's zone) and the way a page printing UTC would.
 */
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { STRIPE_BILL_DUE_MARGIN_MS, isStripeDueDateRefusal, lastSecondOfYmdInAppTzMs, stripeBillDue, stripeBillDueFallbackDays } from '../../../supabase/functions/_shared/stripeBillDueDate'
import { formatDueDate } from '../../../supabase/functions/_shared/stripeBillCopyEmail'
import { endOfYmdInAppTzMs, todayYmdInAppTz } from '../../utils/dateUtils'
import { stripeUnixToAppYmd } from '../stripeInvoiceFacts'
import { dueDateUnixFromYmd } from './localStripeBillPreview'

/** The old rule, as `create-stripe-invoice` held it until this fix: what Stripe then made of it is `now + days`. */
function oldDueYmd(dueYmd: string, nowMs: number): string {
  const ms = new Date(dueYmd + 'T12:00:00Z').getTime() - nowMs
  const days = Math.max(1, Math.ceil(ms / 86_400_000))
  return todayYmdInAppTz(new Date(nowMs + days * 86_400_000))
}

const utcYmd = (sec: number) => new Date(sec * 1000).toISOString().slice(0, 10)

/** The instant Stripe holds, for a rule that sends the day itself. */
function sentSeconds(dueYmd: string, nowMs: number): number {
  const due = stripeBillDue(dueYmd, nowMs)
  if (!('due_date' in due)) throw new Error(`expected a due day, got ${JSON.stringify(due)}`)
  return due.due_date
}

describe('stripeBillDue', () => {
  // 7:24 PM Central on Nov 24, 2026 (CST, UTC-6): the walk's own minute.
  const EVENING = Date.parse('2026-11-25T01:24:00Z')

  it('the walk: a bill due today, pressed at 7:24 PM Central, is due today', () => {
    expect(todayYmdInAppTz(new Date(EVENING))).toBe('2026-11-24')
    expect(oldDueYmd('2026-11-24', EVENING)).toBe('2026-11-25') // the fault
    const due = stripeBillDue('2026-11-24', EVENING)
    expect(due.rule).toBe('app_day_end')
    const sec = sentSeconds('2026-11-24', EVENING)
    expect(stripeUnixToAppYmd(sec)).toBe('2026-11-24')
    expect(sec * 1000).toBeGreaterThan(EVENING + STRIPE_BILL_DUE_MARGIN_MS)
    // 11:59:59 PM Central.
    expect(new Date(sec * 1000).toISOString()).toBe('2026-11-25T05:59:59.000Z')
  })

  it('a bill due today, pressed in the morning, is due today, in the company zone and in UTC alike', () => {
    const morning = Date.parse('2026-11-24T15:00:00Z') // 9 AM Central
    expect(oldDueYmd('2026-11-24', morning)).toBe('2026-11-25') // the fault held at any hour
    const due = stripeBillDue('2026-11-24', morning)
    expect(due.rule).toBe('utc_day_end')
    const sec = sentSeconds('2026-11-24', morning)
    expect(stripeUnixToAppYmd(sec)).toBe('2026-11-24')
    expect(utcYmd(sec)).toBe('2026-11-24')
  })

  it('a later due day reads as that day whatever the hour of the press, the small hours included', () => {
    const smallHours = Date.parse('2026-11-24T09:00:00Z') // 3 AM Central
    expect(oldDueYmd('2026-11-25', smallHours)).toBe('2026-11-26') // the old rule ran a day late before 6 AM Central
    for (const now of [smallHours, Date.parse('2026-11-24T15:00:00Z'), EVENING, Date.parse('2026-11-25T05:55:00Z')]) {
      for (const ymd of ['2026-11-25', '2026-11-26', '2026-12-24', '2027-03-14', '2027-11-07']) {
        if (ymd <= todayYmdInAppTz(new Date(now))) continue
        const sec = sentSeconds(ymd, now)
        expect(stripeUnixToAppYmd(sec)).toBe(ymd)
        expect(utcYmd(sec)).toBe(ymd)
      }
    }
  })

  it('every reader of the made bill tells the customer the day the window showed', () => {
    for (const now of [Date.parse('2026-11-24T15:00:00Z'), EVENING]) {
      const sec = sentSeconds('2026-11-24', now)
      // The window's face and the email's face before the bill exists read noon UTC of the day.
      const faceSec = dueDateUnixFromYmd('2026-11-24')!
      expect(formatDueDate(sec)).toBe(formatDueDate(faceSec)) // the bill email and each copy
      expect(formatDueDate(sec)).toBe('Nov 24, 2026')
      expect(stripeUnixToAppYmd(sec)).toBe(stripeUnixToAppYmd(faceSec)) // the made bill's panel and the split window
    }
  })

  it('summer: the same rule on daylight time', () => {
    const evening = Date.parse('2026-07-15T01:30:00Z') // 8:30 PM CDT on Jul 14
    const sec = sentSeconds('2026-07-14', evening)
    expect(stripeUnixToAppYmd(sec)).toBe('2026-07-14')
    expect(new Date(sec * 1000).toISOString()).toBe('2026-07-15T04:59:59.000Z') // 11:59:59 PM CDT
    const noon = Date.parse('2026-07-14T17:00:00Z')
    expect(stripeBillDue('2026-07-14', noon)).toEqual({ due_date: Date.parse('2026-07-14T23:59:59Z') / 1000, rule: 'utc_day_end' })
  })

  it('the last second of a day matches the app helper, across both clock changes', () => {
    for (const ymd of ['2026-11-24', '2026-07-14', '2026-03-08', '2026-11-01', '2027-03-14', '2027-11-07', '2026-12-31']) {
      expect(lastSecondOfYmdInAppTzMs(ymd)).toBe(endOfYmdInAppTzMs(ymd) - 999)
    }
    expect(Number.isNaN(lastSecondOfYmdInAppTzMs('nope'))).toBe(true)
  })

  it('a day that is over, or minutes from over, falls due one day from now as before', () => {
    // A recorded bill of last month turned into a Stripe bill: Stripe takes no past due day.
    expect(stripeBillDue('2026-10-20', EVENING)).toEqual({ days_until_due: 1, rule: 'day_is_over' })
    // 11:55 PM Central on the due day: inside the margin.
    expect(stripeBillDue('2026-11-24', Date.parse('2026-11-25T05:55:00Z'))).toEqual({ days_until_due: 1, rule: 'day_is_over' })
    // 11:45 PM Central: still ahead.
    expect(stripeBillDue('2026-11-24', Date.parse('2026-11-25T05:45:00Z')).rule).toBe('app_day_end')
    expect(stripeBillDue('not a day', EVENING)).toEqual({ days_until_due: 1, rule: 'day_is_over' })
    expect(stripeBillDue('2026-11-24', Number.NaN)).toEqual({ days_until_due: 1, rule: 'day_is_over' })
  })

  it('a refusal from Stripe falls back to a count of civil days in the company zone, never under 1', () => {
    expect(stripeBillDueFallbackDays('2026-11-24', EVENING)).toBe(1)
    expect(stripeBillDueFallbackDays('2026-11-26', EVENING)).toBe(2)
    expect(stripeBillDueFallbackDays('2026-11-25', Date.parse('2026-11-24T09:00:00Z'))).toBe(1) // 3 AM Central: the old rule said 2
    expect(stripeBillDueFallbackDays('2026-10-20', EVENING)).toBe(1)
    expect(stripeBillDueFallbackDays('nope', EVENING)).toBe(1)
    expect(isStripeDueDateRefusal({ type: 'StripeInvalidRequestError', param: 'due_date', message: 'Invalid timestamp' })).toBe(true)
    expect(isStripeDueDateRefusal(new Error('The due date must be in the future.'))).toBe(true)
    expect(isStripeDueDateRefusal({ param: 'number', message: 'Invoice number already taken' })).toBe(false)
    expect(isStripeDueDateRefusal(null)).toBe(false)
  })

  it('the function sends what the kernel gives, one of a day or a count, and makes the bill on a count if Stripe refuses the day', () => {
    const fn = readFileSync('supabase/functions/create-stripe-invoice/index.ts', 'utf8')
    expect(fn).toContain("from '../_shared/stripeBillDueDate.ts'")
    expect(fn).toContain('stripeBillDue(due_date.trim(), Date.now())')
    expect(fn).toContain("createInvoiceDue('due_date' in due ? { due_date: due.due_date } : { days_until_due: due.days_until_due })")
    expect(fn).toContain('isStripeDueDateRefusal(e)')
    expect(fn).toContain('createInvoiceDue({ days_until_due: days })')
    expect(fn).not.toMatch(/function daysUntilDue/)
    expect(fn).not.toMatch(/Math\.max\(1, Math\.ceil/)
  })
})
