import { describe, expect, it } from 'vitest'
import { buildHeadline, cashLight, netPositionLight } from './headline'
import { buildMondaySheet, mondaySheetHtml, mondaySheetSubject, mondaySheetText } from './mondaySheet'
import { buildThisWeek } from './thisWeek'
import { buildVectorGrid } from './vectorDays'
import type { VectorSession } from './vectors'

const TODAY = '2026-10-10'
const s = (workDate: string, hours: number, pending = false): VectorSession => ({ userId: 'u1', workDate, hours, jobId: 'j1', onBid: false, officeJob: false, approved: !pending, pending })
function headline(sessions: VectorSession[]) {
  const common = { zoom: 'weeks' as const, anchorYmd: TODAY, todayYmd: TODAY, people: [{ userId: 'u1', name: 'Abraham', role: 'helpers', archived: false }], wages: [{ userId: 'u1', fieldWage: 40, officeWage: null, isSalary: false }], sessions, ratePerHourByJob: new Map([['j1', 100]]) }
  return buildHeadline({ recorded: buildVectorGrid({ ...common, mode: 'recorded' }), approved: buildVectorGrid({ ...common, mode: 'approved' }) })
}

const input = () => ({
  todayLabel: 'Fri Oct 10',
  weekLabel: 'Oct 4–10',
  headline: headline([s('2026-10-06', 10), s('2026-10-07', 10, true), s('2026-09-22', 10)]),
  net: netPositionLight({ deltaUsd: -37_400, todayUsd: 114_000, startLabel: 'Aug 15', paperProfitUsd: 54_600, billingLagUsd: 98_100 }),
  cash: cashLight({ lowestUsd: 15_400, lowestLabel: 'Oct 12', floorUsd: 5000, clearsFloor: true, daysUnderFloor: 0, typedLabel: null, typedDaysAgo: null, synced: true }),
  netRows: [{ label: 'Earned, not invoiced', value: '+$98.1k' }],
  cashRows: [{ label: 'Oct 24 · receipts assumed', value: '+$227k' }],
  moves: buildThisWeek({ unbilledUsd: 228_000, unbilledCount: 14, lateReceipts: { count: 48, usd: 227_536 }, pendingClosedHours: 585, pendingClosedSessions: 104, payrollWeeklyEstUsd: 7448, noContractJobs: [{ id: 'a', label: '912' }], assumedHalfJobs: 6, assumedHalfEarnedUsd: 20_341, fieldEarnedPerHour: 169, contributionMargin: 0.27, overheadPerDayUsd: 348, bidsDue: [], dayLabel: (y) => y }),
  people: ['Malachi · 40h · +$5.6k', 'Abraham · 40h · +$4.1k'],
})

describe('buildMondaySheet', () => {
  it('reads the three tiles from the lights and the headline, and keeps five moves', () => {
    const sheet = buildMondaySheet(input())
    expect(sheet.weekLine).toBe('the week of Oct 4–10, read Fri Oct 10')
    expect(sheet.contribution).toMatchObject({ tone: 'green', lead: '≈ +$1.2k', sub: '20h recorded · +$600 on the 10h approved · 10h waiting' })
    expect(sheet.contribution.verdict).toMatch(/^Green: Contribution ran \$600 to \$600 a week/)
    expect(sheet.net).toMatchObject({ tone: 'red', lead: 'down $37.4k since Aug 15' })
    expect(sheet.net.verdict).toBe('Red: Paper profit over the same weeks is +$54.6k. $98.1k is earned but not invoiced. Bill it to see it.')
    expect(sheet.cash).toMatchObject({ tone: 'green', lead: 'lowest point $15.4k on Oct 12' })
    expect(sheet.moves).toHaveLength(5)
    expect(sheet.moves.map((m) => m.key)).toEqual(['bill', 'chase', 'approve', 'price', 'pct'])
  })
  it('renders the mail: html with the three tiles and the moves, text with the same, a subject that reads the three leads', () => {
    const sheet = buildMondaySheet(input())
    const html = mondaySheetHtml(sheet, 'https://example.test/bridge')
    expect(html).toContain('Contribution per week')
    expect(html).toContain('≈ +$1.2k')
    expect(html).toContain('Bill the finished work')
    expect(html).toContain('Malachi · 40h · +$5.6k')
    expect(html).toContain('href="https://example.test/bridge"')
    expect(html).not.toContain('<script')
    const text = mondaySheetText(sheet, 'https://example.test/bridge')
    expect(text).toContain('Contribution per week: ≈ +$1.2k')
    expect(text).toContain('1. Bill the finished work')
    expect(mondaySheetSubject(sheet)).toBe('The Bridge, the week of Oct 4–10: contribution ≈ +$1.2k, net down $37.4k since Aug 15, cash lowest point $15.4k on Oct 12')
  })
  it('escapes what it prints', () => {
    const sheet = buildMondaySheet({ ...input(), people: ['<b>x</b> & co'] })
    expect(mondaySheetHtml(sheet, 'u')).toContain('&lt;b&gt;x&lt;/b&gt; &amp; co')
  })
})
