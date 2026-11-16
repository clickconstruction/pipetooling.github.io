import { describe, expect, it } from 'vitest'
import { lienDeskBatches } from './gcOnNotice'
import { buildLienLeaderSignCard, LIEN_LEADER_KICKER, lienDeskEntryInRun } from './lienLeaderSignCard'
import { leaderEntry as entry, leaderInput as input, leaderMonth as month, leaderNine, leaderTonight as tonight } from '../../test/lienLeaderFixtures'

describe('buildLienLeaderSignCard — the title says the deadline', () => {
  it('is null with nothing waiting', () => {
    expect(buildLienLeaderSignCard(input([]))).toBeNull()
    expect(buildLienLeaderSignCard(input([entry('j891', { pile: 'ready' })]))).toBeNull()
  })

  it('reads the desk of 2026-11-16: one to sign today, two with no window, the money summed, the wait named', () => {
    const card = buildLienLeaderSignCard(input(tonight()))!
    expect(card.kicker).toBe(LIEN_LEADER_KICKER)
    expect(card.title).toBe('Sign 1 lien notice today')
    expect(card.tone).toBe('red')
    expect(card.count).toBe(3)
    expect(card.figure).toBe('$6,529')
    expect(card.detail).toBe('2 more with no open window · $6,529 on 3 jobs · they have waited on you since Oct 7, 40 days')
    expect(card.line.filter((s) => s.strong).map((s) => s.text)).toEqual(['$6,529', 'Oct 7'])
    expect(card.phoneLines.map((l) => l.map((s) => s.text).join(''))).toEqual(['2 more with no open window · $6,529 on 3 jobs', 'Waiting on you since Oct 7, 40 days'])
    expect(card.rows.map((r) => r.label)).toEqual(['891 · ZZ Test Car Wash', '804 · ZZ Test Auto Parts', '922 · ZZ Test House'])
    expect(card.more).toBeNull()
  })

  it('says today for every notice with a window that closes today, and the rest by their last day', () => {
    const card = buildLienLeaderSignCard(
      input([
        entry('j891', { months: [month('2026-08', '2026-11-16')] }),
        entry('j372', { months: [month('2026-09', '2026-11-16')] }),
        entry('j804', { months: [month('2026-09', '2026-12-15')] }),
      ]),
    )!
    expect(card.title).toBe('Sign 2 lien notices today')
    expect(card.detail.startsWith('1 more by Dec 15 · ')).toBe(true)
  })

  it('names the day when the soonest window is inside the week', () => {
    const tomorrow = buildLienLeaderSignCard(input([entry('j891', { months: [month('2026-08', '2026-11-17')] }), entry('j804', { months: [month('2026-09', '2026-12-15')] })]))!
    expect(tomorrow.title).toBe('Sign 1 lien notice by tomorrow')
    expect(tomorrow.tone).toBe('red')
    const thursday = buildLienLeaderSignCard(input([entry('j891', { months: [month('2026-08', '2026-11-19')] }), entry('j372', { months: [month('2026-08', '2026-11-19')] })]))!
    expect(thursday.title).toBe('Sign 2 lien notices by Thursday, Nov 19')
    const week = buildLienLeaderSignCard(input([entry('j891', { months: [month('2026-08', '2026-11-23')] })]))!
    expect(week.title).toBe('Sign 1 lien notice by Monday, Nov 23')
    expect(week.tone).toBe('red')
  })

  it('past a week it counts them, sits blue and names the soonest day in the line', () => {
    const card = buildLienLeaderSignCard(input([entry('j891', { months: [month('2026-09', '2026-12-15')] }), entry('j804', { months: [month('2026-10', '2027-01-15')] })]))!
    expect(card.title).toBe('2 lien notices wait on your signature')
    expect(card.tone).toBe('blue')
    expect(card.detail.startsWith('The soonest window closes Dec 15 · ')).toBe(true)
    const one = buildLienLeaderSignCard(input([entry('j891', { months: [month('2026-09', '2026-11-24')] })]))!
    expect(one.title).toBe('1 lien notice waits on your signature')
    expect(one.tone).toBe('blue')
  })

  it('never calls a notice today when its only window already closed: it waits, red, and its row says which month closed', () => {
    const card = buildLienLeaderSignCard(input([entry('j891', { months: [month('2026-07', '2026-10-15')] })]))!
    expect(card.title).toBe('1 lien notice waits on your signature')
    expect(card.tone).toBe('red')
    expect(card.rows[0]!.chips).toEqual([{ key: 'closed-2026-07', tone: 'red', text: 'July closed Oct 15, not sent' }])
    // Beside one that closes today it is counted apart, in the line.
    const two = buildLienLeaderSignCard(input([entry('j891', { months: [month('2026-07', '2026-10-15')] }), entry('j372', { months: [month('2026-08', '2026-11-16')] })]))!
    expect(two.title).toBe('Sign 1 lien notice today')
    expect(two.detail.startsWith('1 more with a window already closed · ')).toBe(true)
  })
})

describe('buildLienLeaderSignCard — the wait', () => {
  it('reads by the oldest when the notices were sent on different days', () => {
    const card = buildLienLeaderSignCard(input([entry('j891', { submitted: '2026-10-07T21:13:00+00:00' }), entry('j804', { submitted: '2026-11-10T15:00:00+00:00' })]))!
    expect(card.detail.endsWith(' · the oldest has waited on you 40 days')).toBe(true)
    expect(card.phoneLines[1]!.map((s) => s.text).join('')).toBe('The oldest has waited on you 40 days')
  })
  it('says one day, today, and nothing when no day was kept', () => {
    expect(buildLienLeaderSignCard(input([entry('j891', { submitted: '2026-11-15T18:00:00+00:00' })]))!.detail.endsWith('it has waited on you since Nov 15, 1 day')).toBe(true)
    expect(buildLienLeaderSignCard(input([entry('j891', { submitted: '2026-11-16T18:00:00+00:00' })]))!.detail.endsWith('it was sent to you today')).toBe(true)
    const none = buildLienLeaderSignCard(input([entry('j891', { submitted: null })]))!
    expect(none.detail).toBe('$1,000 on 1 job')
    expect(none.phoneLines).toHaveLength(1)
  })
})

describe('buildLienLeaderSignCard — the rows', () => {
  it('chips: closes today, tomorrow, days left, a closed month, and nothing claimed', () => {
    const card = buildLienLeaderSignCard(input(tonight()))!
    const [first, second, third] = card.rows
    expect(first!.chips.map((c) => [c.tone, c.text])).toEqual([
      ['red', 'August closes today'],
      ['red', 'July closed Oct 15, not sent'],
    ])
    expect(first!.monthNamed).toBe(true)
    // The desk holds no window for this one: its months, and no day.
    expect(second!.chips).toEqual([])
    expect(second!.monthsWords).toBe('Jul + Aug + Sep')
    expect(second!.monthNamed).toBe(false)
    expect(third!.chips.map((c) => [c.tone, c.text])).toEqual([['amber', 'nothing claimed, ask the office']])
    expect(third!.claimWords).toBe('$0')

    const days = buildLienLeaderSignCard(input([entry('j891', { months: [month('2026-08', '2026-11-17')] }), entry('j804', { months: [month('2026-09', '2026-11-20')] }), entry('j372', { months: [month('2026-09', '2026-12-15')] })]))!
    expect(days.rows.map((r) => r.chips.map((c) => [c.tone, c.text]))).toEqual([[['red', 'August closes tomorrow']], [['red', '4 days']], [['gray', '29 days']]])
    expect(days.rows.map((r) => r.monthNamed)).toEqual([true, false, false])
  })

  it('a month a sent notice already covers is not a window on this one', () => {
    const card = buildLienLeaderSignCard(input([entry('j891', { months: [month('2026-07', '2026-10-15', { noticed: true }), month('2026-09', '2026-12-15')], itemMonths: ['2026-07', '2026-09'] })]))!
    expect(card.rows[0]!.chips.map((c) => c.text)).toEqual(['29 days'])
    expect(card.tone).toBe('blue')
  })

  it('the first row signs, the others open, and each press lands on its notice on the awaiting pile', () => {
    const card = buildLienLeaderSignCard(input(tonight()))!
    expect(card.rows.map((r) => r.pressLabel)).toEqual(['Open 891 to sign ▸', 'Open 804 ›', 'Open 922 ›'])
    expect(card.rows.map((r) => r.primary)).toEqual([true, false, false])
    expect(card.rows[0]!.href).toBe('/lien-desk?tab=notices&job=j891&pile=awaiting')
    expect(card.rows[0]!.pressTitle).toBe('Open the notice for 891 ZZ Test Car Wash on the Lien desk')
    expect(card.rows[0]!.gcName).toBe('ZZ Test GC 891')
  })

  it('the most pressing first: inside the week, then a closed window, then a later one, then no window; the bigger claim breaks a tie', () => {
    const card = buildLienLeaderSignCard(
      input([
        entry('none', { openBalance: 9000 }),
        entry('later', { months: [month('2026-09', '2026-12-15')] }),
        entry('closed', { months: [month('2026-07', '2026-10-15')] }),
        entry('soonSmall', { openBalance: 10, months: [month('2026-08', '2026-11-18')] }),
        entry('soonBig', { openBalance: 500, months: [month('2026-08', '2026-11-18')] }),
      ]),
    )!
    expect(card.rows.map((r) => r.jobId)).toEqual(['soonBig', 'soonSmall', 'closed'])
    expect(card.more).toEqual({ count: 2, label: '2 more wait on you ›', href: '/lien-desk?tab=notices&pile=awaiting' })
  })

  it('past three it draws three and one line for the rest', () => {
    const nine = leaderNine()
    const card = buildLienLeaderSignCard(input(nine))!
    expect(card.title).toBe('Sign 2 lien notices today')
    expect(card.count).toBe(9)
    expect(card.rows).toHaveLength(3)
    expect(card.more?.label).toBe('6 more wait on you ›')
    expect(card.detail.startsWith('7 more by Dec 15 · $4,500 on 9 jobs')).toBe(true)
    const four = buildLienLeaderSignCard(input(nine.slice(0, 4)))!
    expect(four.more?.label).toBe('1 more waits on you ›')
  })
})

describe('buildLienLeaderSignCard — the money and the notices it counts', () => {
  it('claims what the pane claims: the open balance less a claim set by hand', () => {
    const card = buildLienLeaderSignCard(input([entry('j891', { openBalance: 2976.34 })], { claimCorrection: () => ({ amountOff: 976.34 }) as never }))!
    expect(card.rows[0]!.claimWords).toBe('$2,000')
    expect(card.figure).toBe('$2,000')
  })

  it('leaves a notice in a run the office prepared to the run’s own card, as the batches count it', () => {
    const inRun = entry('j804', { fields: { notice: { claimAmount: '10.00' }, batchReason: 'The GC went quiet' } })
    const alone = entry('j891')
    expect(lienDeskEntryInRun(inRun)).toBe(true)
    expect(lienDeskEntryInRun(alone)).toBe(false)
    expect(lienDeskEntryInRun({ ...inRun, gcCustomerId: null })).toBe(false)
    const card = buildLienLeaderSignCard(input([inRun, alone]))!
    expect(card.count).toBe(1)
    expect(card.rows.map((r) => r.jobId)).toEqual(['j891'])
    // The same notices the batch card counts, so no notice is on both cards or on neither.
    const awaiting = [inRun, alone]
    expect(lienDeskBatches({ piles: { awaiting } } as never).reduce((s, b) => s + b.jobs, 0)).toBe(awaiting.filter(lienDeskEntryInRun).length)
    expect(buildLienLeaderSignCard(input([inRun]))).toBeNull()
  })
})
