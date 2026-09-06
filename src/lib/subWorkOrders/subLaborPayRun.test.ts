import { describe, expect, it } from 'vitest'
import { buildSubLaborPayRun, nextPayRunDayLabel, nextPayRunYmd, payRunFilterMatches, sheetPayWhen, type PayRunSheet, type SheetPayWhenInput } from './subLaborPayRun'

const TODAY = '2026-09-05' // a Saturday

function pw(over: Partial<SheetPayWhenInput>) {
  return sheetPayWhen({ stage: 'customer_pay', payableAfter: null, payHoldReason: null, bills: { out: 1, paid: 0 }, gap: false, crew: false, balance: 1000, unpriced: false, todayYmd: TODAY, ...over })
}

describe('sheetPayWhen', () => {
  it('ready when the customer paid, or when the payable-after date has arrived', () => {
    expect(pw({ bills: { out: 2, paid: 2 } })).toMatchObject({ kind: 'ready', detail: 'customer paid · 2 of 2 bills', rank: 0 })
    expect(pw({ payableAfter: '2026-09-04' })).toMatchObject({ kind: 'ready', detail: 'payable after 2026-09-04 · date reached' })
    expect(pw({ payableAfter: TODAY })).toMatchObject({ kind: 'ready' })
  })
  it('queued when the payable-after date is ahead; waiting otherwise, with the bill fact', () => {
    expect(pw({ payableAfter: '2026-09-11' })).toMatchObject({ kind: 'queued', label: 'Queued · 09/11', detail: 'payable after 2026-09-11 · customer still owes', tone: 'blue', rank: 1 })
    expect(pw({ bills: { out: 2, paid: 1 } })).toMatchObject({ kind: 'wait', detail: 'bill 2 of 2 open', tone: 'amber' })
    expect(pw({ bills: { out: 0, paid: 0 } })).toMatchObject({ kind: 'wait', detail: 'nothing billed yet' })
    expect(pw({ bills: null })).toMatchObject({ kind: 'wait', detail: 'no job bill to read' })
  })
  it('the earlier rules win: unpriced, paid, crew, hold, gap, then the stage', () => {
    expect(pw({ unpriced: true, balance: 0 })).toMatchObject({ kind: 'unpriced' })
    expect(pw({ balance: 0 })).toMatchObject({ kind: 'paid', detail: 'balance is $0' })
    expect(pw({ balance: -20 })).toMatchObject({ kind: 'paid', detail: 'over by $20.00' })
    expect(pw({ crew: true, bills: { out: 1, paid: 1 } })).toMatchObject({ kind: 'crew', label: 'Payroll' })
    expect(pw({ payHoldReason: 'waiting on lien release', bills: { out: 1, paid: 1 } })).toMatchObject({ kind: 'hold', detail: 'waiting on lien release' })
    expect(pw({ gap: true, stage: 'working', balance: 40000 })).toMatchObject({ kind: 'gap', label: 'Not payable', detail: 'nothing signed · $40,000.00 on a handshake' })
    expect(pw({ stage: 'working' })).toMatchObject({ kind: 'work', label: 'After inspection', detail: 'sub has not said "done"' })
    expect(pw({ stage: 'walkthrough' })).toMatchObject({ kind: 'walk', detail: 'inspection pending' })
  })
  it('filters', () => {
    expect(payRunFilterMatches('due', pw({}))).toBe(true)
    expect(payRunFilterMatches('due', pw({ balance: 0 }))).toBe(false)
    expect(payRunFilterMatches('paid', pw({ balance: 0 }))).toBe(true)
    expect(payRunFilterMatches('wait', pw({}))).toBe(true)
    expect(payRunFilterMatches('ready', pw({}))).toBe(false)
    expect(payRunFilterMatches('crew', pw({ crew: true }))).toBe(true)
  })
})

describe('pay-run day', () => {
  it('finds the next pay-run date on or after today and labels it', () => {
    expect(nextPayRunYmd('friday', TODAY)).toBe('2026-09-11')
    expect(nextPayRunYmd('Friday', '2026-09-11')).toBe('2026-09-11')
    expect(nextPayRunYmd('monday', TODAY)).toBe('2026-09-07')
    expect(nextPayRunYmd(null, TODAY)).toBeNull()
    expect(nextPayRunYmd('someday', TODAY)).toBeNull()
    expect(nextPayRunDayLabel('friday', TODAY)).toBe('Fri Sep 11')
  })
})

describe('buildSubLaborPayRun', () => {
  const sheet = (over: Partial<PayRunSheet> & { kind?: Parameters<typeof pw>[0] }): PayRunSheet => {
    const { kind, ...rest } = over
    return { id: 's', subKey: 'id:behar', subName: 'Behar Kraja', personId: 'behar', teammates: [], crew: false, balance: 1000, payWhen: pw({ balance: over.balance ?? 1000, ...(kind ?? {}) }), ...rest }
  }
  const run = buildSubLaborPayRun(
    [
      sheet({ id: 'a', balance: 1500, teammates: ['Malachi', 'Abraham'], kind: { bills: { out: 1, paid: 1 } } }),
      sheet({ id: 'b', balance: 200, teammates: ['Malachi', 'Trace'], kind: { bills: { out: 2, paid: 1 } } }),
      sheet({ id: 'c', balance: 150, teammates: ['Abraham', 'Bryan'], kind: { stage: 'working' } }),
      sheet({ id: 'd', subKey: 'id:texas', subName: 'Texas R & A Electrical LLC', personId: 'texas', balance: 40000, kind: { stage: 'working', gap: true } }),
      sheet({ id: 'e', subKey: 'id:taunya', subName: 'Misses Taunya TESTING', balance: 1000, teammates: ['Abraham'], kind: { payableAfter: '2026-09-11' } }),
      sheet({ id: 'f', subKey: 'malachi | abraham', subName: 'Malachi | Abraham', personId: null, balance: 600, crew: true, kind: { crew: true, stage: 'working' } }),
      sheet({ id: 'g', subKey: 'id:air', subName: 'Airfordable', balance: 0, kind: { balance: 0 } }),
    ],
    { payRunDay: 'friday', todayYmd: TODAY },
  )
  it('tiles answer Friday: owed, ready, queued for the day, blocked with reasons', () => {
    expect(run.tiles).toEqual({
      owed: 42850,
      owedSubs: 3,
      owedSheets: 5,
      ready: 1500,
      readySheets: 1,
      queued: 1000,
      queuedSheets: 1,
      queuedDayLabel: 'Fri Sep 11',
      blocked: 40350,
      blockedReasons: ['$40,000.00 with no agreement', '$200.00 waiting on customer', '$150.00 still in work'],
    })
  })
  it('one row per sub, biggest owed first, crew last, with segments, the ready sheets and the sentence', () => {
    expect(run.subs.map((s) => [s.name, s.owed, s.sheetCount])).toEqual([
      ['Texas R & A Electrical LLC', 40000, 1],
      ['Behar Kraja', 1850, 3],
      ['Misses Taunya TESTING', 1000, 1],
      ['Airfordable', 0, 0],
      ['Malachi | Abraham', 0, 1],
    ])
    const behar = run.subs[1]!
    expect(behar.personId).toBe('behar')
    expect(behar.teammates).toEqual(['Malachi', 'Abraham', 'Trace', 'Bryan'])
    expect(behar.segments).toEqual({ ready: 1500, queued: 0, wait: 200, work: 150, hold: 0, gap: 0 })
    expect(behar.readySheetIds).toEqual(['a'])
    expect(behar.action).toEqual({ kind: 'pay', amount: 1500, sheets: 1 })
    expect(behar.whyNot).toBe('$1,500.00 ready · $200.00 waiting on customer · $150.00 still in work')
    expect(run.subs[0]).toMatchObject({ action: { kind: 'draft' }, whyNot: 'No agreement · nothing signed' })
    expect(run.subs[2]).toMatchObject({ action: { kind: 'note', text: 'Pays Fri Sep 11' }, whyNot: 'Queued for Fri Sep 11' })
    expect(run.subs[3]).toMatchObject({ action: { kind: 'note', text: 'Paid up' }, whyNot: 'Paid up' })
    expect(run.subs[4]).toMatchObject({ crew: true, owed: 0, action: { kind: 'note', text: 'Payroll' } })
  })
  it('counts feed the filter chips', () => {
    expect(run.counts).toEqual({ due: 6, ready: 1, queued: 1, wait: 1, gap: 1, crew: 1, paid: 1 })
  })
})
