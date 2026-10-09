/**
 * The Monday money email (O7b): its weekly chains and their words (./moneyMondayEmail.ts), and the email the
 * gc-money-monday-email function sends, drawn by the shared renderer in the Money lens's own words.
 */
import { describe, expect, it } from 'vitest'
import { moneyMondayChainWords, moneyMondayChains, moneyMondayDaysWords, moneyMondayTimeWords, planMoneyMondayEdit, type MoneyMondayRequestRow } from './moneyMondayEmail'
import { chicagoWeekdayAndTime } from '../gcStatementStandingCopies'
import {
  gcMoneyMondayHeadline,
  gcMoneyMondayStatus,
  gcMoneyMondaySubject,
  renderGcMoneyMondayHtml,
  renderGcMoneyMondayText,
  type GcMoneyMondayBill,
  type GcMoneyMondayPayload,
} from '../../../supabase/functions/_shared/gcMoneyMondayEmail'

const row = (id: string, recipient: string, sendAt: string, weekly = true): MoneyMondayRequestRow => ({
  id,
  requested_by: 'me',
  recipient_user_id: recipient,
  send_at: sendAt,
  repeat_weekly: weekly,
})

describe('the Monday money email’s chains', () => {
  // 12:00 UTC in October is 7:00 AM Central.
  const rows = [
    row('a', 'me', '2026-10-12T12:00:00Z'),
    row('b', 'grace', '2026-10-12T12:00:00Z'),
    row('c', 'grace', '2026-10-15T12:00:00Z'),
    row('d', 'grace', '2026-10-13T12:00:00Z', false),
  ]

  it('groups each person’s weekly chains, and leaves a one-off out', () => {
    const chains = moneyMondayChains(rows)
    expect(chains.map((c) => [c.recipientUserId, c.weekdays, c.timeHm, c.allRowIds])).toEqual([
      ['me', [1], '07:00', ['a']],
      ['grace', [1, 4], '07:00', ['b', 'c']],
    ])
  })

  it('says each chain in a sentence', () => {
    const [mine, grace] = moneyMondayChains(rows)
    expect(moneyMondayChainWords(mine!, 'Robert', true)).toBe('You get it on Mon at 7:00 AM.')
    expect(moneyMondayChainWords(grace!, 'Grace', false)).toBe('Grace gets it on Mon and Thu at 7:00 AM.')
    expect(moneyMondayDaysWords([0, 3, 1])).toBe('Mon, Wed and Sun')
    expect([moneyMondayTimeWords('00:30'), moneyMondayTimeWords('12:05'), moneyMondayTimeWords('17:45'), moneyMondayTimeWords('soon')]).toEqual(['12:30 AM', '12:05 PM', '5:45 PM', 'soon'])
  })

  it('adds a weekday as a new chain at the next one, and stops a day by its rows', () => {
    const grace = moneyMondayChains(rows).find((c) => c.recipientUserId === 'grace')!
    const now = new Date('2026-10-09T15:00:00Z')
    const plan = planMoneyMondayEdit({ requestedBy: 'me', recipientUserId: 'grace', desiredWeekdays: [1, 3], desiredTimeHm: '07:00', current: grace }, now)
    if (!plan.ok) throw new Error(plan.error)
    expect(plan.cancelIds).toEqual(['c'])
    expect(plan.inserts.map((i) => [i.recipient_user_id, i.requested_by, i.repeat_weekly, chicagoWeekdayAndTime(i.send_at)])).toEqual([
      ['grace', 'me', true, { dow: 3, timeHm: '07:00' }],
    ])
    const none = planMoneyMondayEdit({ requestedBy: 'me', recipientUserId: 'grace', desiredWeekdays: [], desiredTimeHm: '07:00', current: grace }, now)
    expect(none.ok && none.cancelIds).toEqual(['b', 'c'])
  })
})

const bill = (over: Partial<GcMoneyMondayBill>): GcMoneyMondayBill => ({
  projectId: 'p',
  project: 'Stone Oak',
  customer: 'Cibolo Partners',
  architect: 'Lake Flato',
  number: 2,
  final: false,
  sentOn: '2026-09-01',
  certified: 25000,
  certifiedOn: '2026-09-03',
  open: 15000,
  dueOn: '2026-10-06',
  promised: true,
  daysLate: 6,
  missed: 1,
  waitingOnArchitect: false,
  ...over,
})

const payload: GcMoneyMondayPayload = {
  today: '2026-10-12',
  weekFrom: '2026-10-05',
  weekTo: '2026-10-11',
  bills: [
    bill({}),
    bill({ project: 'Fair Oaks D', customer: 'Fair Oaks ISD', number: 1, open: 36000, dueOn: '2026-11-22', promised: false, daysLate: 0, missed: 0 }),
    bill({ number: 3, certified: null, certifiedOn: null, open: 11000.4, dueOn: '2026-10-29', promised: false, daysLate: 0, missed: 0, waitingOnArchitect: true }),
  ],
  sent: [{ project: 'Stone Oak', number: 3, final: false, due: 11000.4, sentOn: '2026-10-07' }],
  certified: [{ project: 'Fair Oaks D', number: 1, final: false, certified: 36000, certifiedOn: '2026-10-08' }],
}

describe('the Monday money email', () => {
  it('says each bill the way Money’s Who owes us does', () => {
    expect(payload.bills.map((b) => gcMoneyMondayStatus(b))).toEqual([
      { section: 'late', words: 'late 6 days, past their promise' },
      { section: 'coming', words: 'expected Nov 22' },
      { section: 'architect', words: 'waiting on Lake Flato to certify' },
    ])
    expect(gcMoneyMondayStatus(bill({ daysLate: 1, promised: false })).words).toBe('late 1 day, past the day we expected')
    expect(gcMoneyMondayStatus(bill({ daysLate: 0, dueOn: null })).words).toBe('waiting')
    expect(gcMoneyMondayStatus(bill({ waitingOnArchitect: true, architect: ' ' })).words).toBe('waiting on the architect to certify')
  })

  it('leads with what customers owe us and how much is late', () => {
    expect(gcMoneyMondaySubject(payload)).toBe('Our GC money, Mon Oct 12')
    expect(gcMoneyMondayHeadline(payload)).toBe('Customers owe us $62,000 on 3 bills. $15,000 of it is late.')
    expect(gcMoneyMondayHeadline({ ...payload, bills: [payload.bills[1]!] })).toBe('Customers owe us $36,000 on 1 bill. None of it is late.')
    expect(gcMoneyMondayHeadline({ ...payload, bills: [] })).toBe('Nobody owes us right now.')
  })

  it('draws the sections, last week and Open Money, with no six weeks line', () => {
    const html = renderGcMoneyMondayHtml(payload, 'https://app.example/gc?view=money', 'Grace')
    for (const words of ['Late', 'Waiting on the architect', 'Coming in', 'missed a day before', 'Last week, Oct 5 to Oct 11', 'scheduled by Grace', 'href="https://app.example/gc?view=money"']) {
      expect(html).toContain(words)
    }
    expect(html.indexOf('Late')).toBeLessThan(html.indexOf('Waiting on the architect'))
    expect(html).not.toMatch(/six weeks|carrying the week/i)
    const text = renderGcMoneyMondayText(payload, 'https://app.example/gc?view=money')
    expect(text).toContain("We sent Stone Oak's pay application 3 for $11,000 on Wed Oct 7.")
    expect(text).toContain("The architect certified Fair Oaks D's pay application 1 for $36,000 on Thu Oct 8.")
    expect(text).toContain('Open Money: https://app.example/gc?view=money')
    expect(renderGcMoneyMondayText({ ...payload, sent: [], certified: [] }, 'x')).toContain('No pay application went out or came back certified.')
  })

  it('escapes what the office typed', () => {
    const html = renderGcMoneyMondayHtml({ ...payload, bills: [bill({ customer: '<b>Owner</b> & Co' })] }, 'x')
    expect(html).toContain('&lt;b&gt;Owner&lt;/b&gt; &amp; Co')
  })
})
