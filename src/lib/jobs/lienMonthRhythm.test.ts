import { describe, expect, it } from 'vitest'
import type { LienDeskEntry } from './lienDesk'
import type { LienAffidavitEntry } from './lienDeskAffidavits'
import type { CourtesyStatus } from './lienCourtesyNotice'
import { LIEN_MONTH_RULE, buildLienMonth, lienMonthRuleLines, lienMonthSpanWords, lienMonthWords, lienMonthZoneAt, lienMonthZoneHasRow, lienMonthZoneLine, lienMonthZonePress, lienMonthZoneSpan } from './lienMonthRhythm'

const notice = (over: Partial<LienDeskEntry> & { jobId: string }): LienDeskEntry => ({
  customerId: null,
  gcCustomerId: 'gc1',
  openBalance: 1000,
  hasOwner: true,
  propertyKind: 'non_residential',
  months: [{ key: '2026-08', approvedHours: 10, deadline: '2026-11-16', daysLeft: 9, noticed: false, fromCreation: false }],
  datedFromCreation: false,
  dueMonths: ['2026-08'],
  missedMonths: [],
  missedUnrecorded: [],
  earliestDeadline: '2026-11-16',
  daysLeft: 9,
  severity: 'amber',
  item: null,
  policy: 'ask',
  pile: 'to_draft',
  ...over,
})

const item = (over: Record<string, unknown>) => ({ id: 'i1', job_id: 'j', kind: 'notice_53_056', status: 'sent', sent_at: null, ...over }) as unknown as LienDeskEntry['item']

const affidavit = (over: Partial<LienAffidavitEntry> & { jobId: string }): LienAffidavitEntry => ({
  isSub: true,
  lastMonth: '2026-07',
  lastMonthFromCreation: false,
  deadline: '2026-11-16',
  daysLeft: 9,
  severity: 'amber',
  openBalance: 1000,
  customerId: null,
  gcCustomerId: 'gc1',
  propertyKind: 'non_residential',
  gates: [],
  ready: true,
  item: null,
  pile: 'ready',
  ...over,
})

const courtesy = (over: Partial<CourtesyStatus> = {}): CourtesyStatus => ({ state: 'due', day: 21, words: 'day 21 · nothing since the packet', reason: '', lastSentAt: null, waitingForAnswer: false, lienDay: '2026-11-16', records: [], ...over })

const titles: Record<string, string> = { a: 'Ridgeway Builders · 650', b: 'Caldwell Mechanical · 890', c: 'Hollis Point · 712', d: 'Marlow Row · 503', e: 'Dunmore Flats · 611' }
const jobTitle = (id: string) => titles[id] ?? id

describe('the rule (punch list #235, the owner’s days of 2026-11-07)', () => {
  it('cuts the month into five zones: 1 to 5, 6 to 9, 10 to 13, 14 to 15, 16 to the end', () => {
    expect(LIEN_MONTH_RULE).toEqual({ reminders: { from: 1, to: 5 }, notices: { from: 6, to: 9 }, liens: { from: 10, to: 13 }, catch_up: { from: 14, to: 15 }, quietFrom: 16 })
    expect([1, 5, 6, 9, 10, 13, 14, 15, 16, 31].map((d) => lienMonthZoneAt(d))).toEqual(['reminders', 'reminders', 'notices', 'notices', 'liens', 'liens', 'catch_up', 'catch_up', 'quiet', 'quiet'])
    expect(lienMonthZoneSpan('quiet', LIEN_MONTH_RULE, 30)).toEqual({ from: 16, to: 30 })
    expect(lienMonthSpanWords('reminders', { from: 1, to: 5 })).toBe('1 to 5')
    expect(lienMonthSpanWords('quiet', { from: 16, to: 30 })).toBe('16 to the end')
  })
  it('writes itself for § Rules, the days read from the rule', () => {
    const lines = lienMonthRuleLines()
    expect(lines).toHaveLength(6)
    expect(lines[0]).toBe('The lien month is the office’s rhythm, the owner’s choice: reminders on days 1 to 5, notices on days 6 to 9, liens on days 10 to 13, catch-up on the 14th and 15th, nothing scheduled from the 16th.')
    expect(lines[1]).toContain('never before day 7')
    expect(lines[2]).toContain('waits for its own month')
    expect(lines[4]).toContain('§ 53.055')
    expect(lienMonthRuleLines({ ...LIEN_MONTH_RULE, liens: { from: 10, to: 12 } })[0]).toContain('liens on days 10 to 12')
  })
})

describe('buildLienMonth — the five zones over the desk’s book', () => {
  const book = {
    notices: [
      notice({ jobId: 'a' }),
      notice({ jobId: 'b', pile: 'awaiting' }),
      notice({ jobId: 'c', pile: 'sent', item: item({ sent_at: '2026-11-07T16:00:00Z' }) }),
      // Due next month: in the quiet zone's queue, not this month's count (the owner's call: this month's deadline only).
      notice({ jobId: 'd', earliestDeadline: '2026-12-15' }),
      // Held: the leader's standing decision, on neither side.
      notice({ jobId: 'e', pile: 'held' }),
    ],
    affidavits: [affidavit({ jobId: 'a' }), affidavit({ jobId: 'b', pile: 'to_draft' }), affidavit({ jobId: 'd', deadline: '2026-12-15' })],
    courtesyByJob: {
      a: courtesy(),
      b: courtesy({ state: 'sent', lastSentAt: '2026-11-03T16:00:00Z' }),
      c: courtesy({ state: 'closed', reason: 'paid' }),
      d: courtesy({ lienDay: '2026-12-15' }),
      e: courtesy({ state: 'held', reason: 'homestead' }),
    },
    serveDue: [{ jobId: 'c' }],
    jobTitle,
  }

  it('in reminders week: the reminders zone is now, the rest ahead, today marked', () => {
    const m = buildLienMonth({ ...book, todayYmd: '2026-11-03' })
    expect(m.month).toBe('2026-11')
    expect(m.today).toBe(3)
    expect(m.daysInMonth).toBe(30)
    expect(m.zone).toBe('reminders')
    expect(m.zones.map((z) => [z.key, z.state, z.days])).toEqual([
      ['reminders', 'now', 5],
      ['notices', 'ahead', 4],
      ['liens', 'ahead', 4],
      ['catch_up', 'ahead', 2],
      ['quiet', 'ahead', 15],
    ])
    const [rem, not, lie, catchUp, quiet] = m.zones
    expect([rem!.left, rem!.done, rem!.slipped]).toEqual([1, 1, 0])
    expect(rem!.jobs.map((j) => [j.jobId, j.state, j.words])).toEqual([
      ['a', 'left', 'to send'],
      ['b', 'done', 'sent Nov 3'],
    ])
    expect(lienMonthZoneLine(rem!)).toEqual({ head: '1 to send · 1 sent', sub: '1 to send', tone: 'now' })
    expect(lienMonthZonePress(rem!)).toBe('Show 1 reminder')
    expect([not!.left, not!.done]).toEqual([2, 1])
    expect(lienMonthZoneLine(not!)).toEqual({ head: '2 coming', sub: '1 to draft, 1 to approve', tone: 'ahead' })
    expect(lienMonthZoneLine(lie!)).toEqual({ head: '2 coming', sub: '1 to draft, 1 to file', tone: 'ahead' })
    expect(lienMonthZoneLine(catchUp!)).toEqual({ head: 'nothing slipped yet', sub: '1 copy to mail', tone: 'ahead' })
    expect(quiet!.queue).toEqual({ reminders: 1, notices: 1, liens: 1 })
    expect(lienMonthZoneLine(quiet!)).toEqual({ head: '1 reminder · 1 notice · 1 lien', sub: 'for next month', tone: 'quiet' })
    expect(lienMonthZonePress(quiet!)).toBeNull()
    expect(lienMonthWords(m)).toBe('Day 3 of the lien month · Reminders (days 1 to 5) · 1 to send · 1 sent.')
  })

  it('in liens week: what reminders and notices left undone has slipped and is named in Catch-up', () => {
    const m = buildLienMonth({ ...book, todayYmd: '2026-11-11' })
    expect(m.zone).toBe('liens')
    const [rem, not, lie, catchUp] = m.zones
    expect(rem!.state).toBe('behind')
    expect([rem!.left, rem!.done, rem!.slipped]).toEqual([0, 1, 1])
    expect(lienMonthZoneLine(rem!)).toEqual({ head: '1 slipped · 1 sent', sub: 'Ridgeway Builders · 650', tone: 'slipped' })
    expect(lienMonthZonePress(rem!)).toBe('Show 1 reminder')
    expect(not!.state).toBe('behind')
    expect(not!.slipped).toBe(2)
    expect(lie!.state).toBe('now')
    expect(lienMonthZoneLine(lie!)).toEqual({ head: '2 to file · 0 filed', sub: '1 to draft, 1 to file', tone: 'now' })
    expect(lienMonthZonePress(lie!)).toBe('Show 2 liens')
    expect(catchUp!.state).toBe('ahead')
    expect([catchUp!.slipped, catchUp!.copies, catchUp!.left]).toEqual([3, 1, 4])
    expect(catchUp!.jobs.map((j) => j.jobId)).toEqual(['b', 'a', 'a'])
    expect(lienMonthZoneLine(catchUp!)).toEqual({ head: '3 slipped so far', sub: '1 copy to mail', tone: 'slipped' })
    expect(lienMonthZonePress(catchUp!)).toBe('Show 4 slips')
  })

  it('a clean month reads green behind and the quiet zone is now from the 16th', () => {
    const m = buildLienMonth({
      todayYmd: '2026-11-20',
      notices: [notice({ jobId: 'c', pile: 'sent', item: item({ sent_at: '2026-11-07T16:00:00Z' }) })],
      affidavits: [affidavit({ jobId: 'b', pile: 'filed', item: item({ sent_at: '2026-11-12T16:00:00Z' }) })],
      courtesyByJob: { b: courtesy({ state: 'sent', lastSentAt: '2026-11-03T16:00:00Z' }) },
      jobTitle,
    })
    expect(m.zone).toBe('quiet')
    const [rem, not, lie, catchUp, quiet] = m.zones
    expect(lienMonthZoneLine(rem!)).toEqual({ head: 'all 1 sent', sub: '', tone: 'done' })
    expect(lienMonthZoneLine(not!)).toEqual({ head: 'all 1 sent', sub: '', tone: 'done' })
    expect(lienMonthZoneLine(lie!)).toEqual({ head: 'all 1 filed', sub: '', tone: 'done' })
    expect(lie!.jobs[0]!.words).toBe('filed Nov 12')
    expect(lienMonthZoneLine(catchUp!)).toEqual({ head: 'nothing slipped', sub: 'the month went clean', tone: 'done' })
    expect(lienMonthZonePress(catchUp!)).toBeNull()
    expect(quiet!.state).toBe('now')
    expect(lienMonthZoneLine(quiet!)).toEqual({ head: 'nothing queuing yet', sub: 'for next month', tone: 'quiet' })
    expect(lienMonthZoneLine(buildLienMonth({ todayYmd: '2026-11-20', notices: [], affidavits: [], courtesyByJob: {}, jobTitle }).zones[0]!)).toEqual({ head: 'nothing to send', sub: '', tone: 'done' })
  })

  it('a drafting row that keeps the notice that went this month (v2.6624) counts that send as done beside what is left', () => {
    const m = buildLienMonth({ todayYmd: '2026-11-08', notices: [notice({ jobId: 'a', pile: 'to_draft', sentItem: item({ sent_at: '2026-11-06T16:00:00Z' }) })], affidavits: [], courtesyByJob: {}, jobTitle })
    const not = m.zones[1]!
    expect(not.jobs.map((j) => [j.state, j.words])).toEqual([
      ['left', 'to draft'],
      ['done', 'sent Nov 6'],
    ])
    expect(lienMonthZoneLine(not)).toEqual({ head: '1 to send · 1 sent', sub: '1 to draft', tone: 'now' })
  })

  it('a missed month whose deadline fell this month is a slip; a notice due a later month is nobody’s this month', () => {
    const m = buildLienMonth({
      todayYmd: '2026-11-17',
      notices: [
        notice({ jobId: 'a', pile: 'missed', missedMonths: ['2026-08'], dueMonths: [], earliestDeadline: null }),
        // A miss from a month ago stays with the Missed pile, not this month's bar.
        notice({ jobId: 'b', pile: 'missed', missedMonths: ['2026-07'], months: [{ key: '2026-07', approvedHours: 4, deadline: '2026-10-15', daysLeft: -33, noticed: false, fromCreation: false }], dueMonths: [], earliestDeadline: null }),
        notice({ jobId: 'd', earliestDeadline: '2027-01-15' }),
      ],
      affidavits: [affidavit({ jobId: 'a', pile: 'missed' })],
      courtesyByJob: {},
      jobTitle,
    })
    const [, not, lie, catchUp, quiet] = m.zones
    expect(not!.jobs.map((j) => [j.jobId, j.state, j.words])).toEqual([['a', 'slipped', 'missed']])
    expect(lie!.jobs.map((j) => [j.jobId, j.state])).toEqual([['a', 'slipped']])
    expect(catchUp!.state).toBe('behind')
    expect(lienMonthZoneLine(catchUp!)).toEqual({ head: '2 slipped', sub: 'Ridgeway Builders · 650', tone: 'slipped' })
    expect(quiet!.queue).toEqual({ reminders: 0, notices: 0, liens: 0 })
  })

  it('reminders: paused, held and closed notices are nobody’s to send; before day 7 is still coming', () => {
    const m = buildLienMonth({
      todayYmd: '2026-11-02',
      notices: [],
      affidavits: [],
      courtesyByJob: {
        a: courtesy({ state: 'paying', paying: { lastAmount: 100, lastPaidYmd: '2026-11-01', stillOwed: 900, promisedYmd: null, until: '2026-11-08' } as never }),
        b: courtesy({ state: 'waiting', day: 4 }),
        c: courtesy({ state: 'affidavit_week' }),
      },
      jobTitle,
    })
    const rem = m.zones[0]!
    expect(rem.jobs.map((j) => [j.jobId, j.words])).toEqual([
      ['b', 'before day 7'],
      ['c', 'to send'],
    ])
    expect(rem.breakdown).toBe('1 to send, 1 before day 7')
  })

  it('knows which Do now rows are a zone’s work', () => {
    const m = buildLienMonth({ ...book, todayYmd: '2026-11-11' })
    const [rem, not, lie, catchUp, quiet] = m.zones
    expect(lienMonthZoneHasRow(rem!, { kind: 'notice', jobId: 'a', action: 'courtesy' })).toBe(true)
    expect(lienMonthZoneHasRow(rem!, { kind: 'notice', jobId: 'b', action: 'courtesy' })).toBe(false)
    expect(lienMonthZoneHasRow(not!, { kind: 'notice', jobId: 'a', action: 'draft' })).toBe(true)
    expect(lienMonthZoneHasRow(not!, { kind: 'notice', jobId: 'a', action: 'courtesy' })).toBe(false)
    expect(lienMonthZoneHasRow(not!, { kind: 'notice', jobId: 'd', action: 'draft' })).toBe(false)
    expect(lienMonthZoneHasRow(lie!, { kind: 'affidavit', jobId: 'b', action: 'draft' })).toBe(true)
    expect(lienMonthZoneHasRow(lie!, { kind: 'notice', jobId: 'b', action: 'draft' })).toBe(false)
    expect(lienMonthZoneHasRow(catchUp!, { kind: 'notice', jobId: 'b', action: 'approve' })).toBe(true)
    expect(lienMonthZoneHasRow(catchUp!, { kind: 'affidavit', jobId: 'c', action: 'record_service' })).toBe(true)
    expect(lienMonthZoneHasRow(quiet!, { kind: 'notice', jobId: 'd', action: 'draft' })).toBe(false)
    expect(lienMonthZoneHasRow(not!, { kind: 'notice', jobId: null, action: 'send_run' })).toBe(false)
  })
})
