import { describe, expect, it } from 'vitest'
import { buildCrewDays, crewDaysByWeek, jobChargeRuleFrom, jobChargeRuleWords, mondayOf, type CrewSessionInput } from './crewDays'
import { parseCrewShape, type RateCard } from './rateCard'

const OWNER: RateCard = { rates: { master_helper: 285, two_techs: 285, tech_alone: 185, helper_alone: 75 }, extraPerson: null, materialsMarkupPct: null }

const s = (userId: string, name: string, standing: CrewSessionInput['standing'], workDate: string, hours: number, imported = false): CrewSessionInput => ({ userId, name, standing, workDate, hours, imported })

describe('crew-days (punch list #254)', () => {
  it('prices two techs out together as one crew: eight crew-hours at $285, never sixteen person-hours', () => {
    const r = buildCrewDays([s('a', 'Ainsley', 'tech', '2026-04-20', 8), s('p', 'Piper', 'tech', '2026-04-20', 8)], OWNER)
    expect(r.days).toHaveLength(1)
    const d = r.days[0]!
    expect(d.crewHours).toBe(8)
    expect(d.personHours).toBe(16)
    expect(d.shape).toBe('two_techs')
    expect(d.rate).toBe(285)
    expect(d.charged).toBe(2280)
    expect(d.who).toBe('Ainsley, Piper')
    expect(d.shapeWords).toBe('two techs')
    expect(r.totals).toMatchObject({ days: 1, crewHours: 8, personHours: 16, charged: 2280, unpriced: 0 })
  })

  it("takes the longest day of anyone charged as the crew's hours, and adds a person's two sessions on one day first", () => {
    const r = buildCrewDays([s('z', 'Zed', 'tech', '2026-04-20', 5), s('z', 'Zed', 'tech', '2026-04-20', 4.93), s('t', 'Toby', 'master', '2026-04-20', 9)], OWNER)
    const d = r.days[0]!
    expect(d.people.map((p) => [p.name, p.hours])).toEqual([['Zed', 9.93], ['Toby', 9]])
    expect(d.crewHours).toBe(9.93)
    expect(d.shape).toBe('master_helper')
    expect(d.charged).toBe(2830.05)
  })

  it('leaves a person who is not charged out of the crew and prices the rest; a day with nobody charged is named, not priced', () => {
    const r = buildCrewDays([s('o', 'Office', 'none', '2026-04-21', 8), s('a', 'Ainsley', 'tech', '2026-04-21', 6), s('o', 'Office', 'none', '2026-04-22', 8)], OWNER)
    expect(r.days[0]).toMatchObject({ crewHours: 6, shape: 'tech_alone', rate: 185, charged: 1110, why: null })
    expect(r.days[1]).toMatchObject({ crewHours: 0, shape: null, charged: null, why: 'Nobody out that day is charged to a customer.' })
    expect(r.totals.unpriced).toBe(1)
  })

  it("prices a day whose row is missing from the card as unpriced, with the row named, and the job's rule overrides it", () => {
    const alone = [s('t', 'Toby', 'master', '2026-02-10', 8, true)]
    const byCard = buildCrewDays(alone, OWNER)
    expect(byCard.days[0]).toMatchObject({ shape: 'master_alone', charged: null, why: 'The rate card has no rate for master alone.', imported: true })
    const byRule = buildCrewDays(alone, OWNER, { kind: 'shape', shape: 'master_helper' })
    expect(byRule.days[0]).toMatchObject({ pricedShape: 'master_helper', rate: 285, charged: 2280, shapeWords: 'master with a helper · the job’s rule', why: null })
    expect(byRule.totals.importedDays).toBe(1)
    const flat = buildCrewDays(alone, OWNER, { kind: 'flat', rate: 300 })
    expect(flat.days[0]).toMatchObject({ rate: 300, charged: 2400, shapeWords: 'master alone · the job’s flat rate' })
  })

  it('names a crew of three with no extra-person rate, and prices it once the card has one', () => {
    const three = [s('t', 'Toby', 'master', '2026-05-12', 8), s('j', 'Jordan', 'helper', '2026-05-12', 8), s('z', 'Zed', 'tech', '2026-05-12', 8)]
    expect(buildCrewDays(three, OWNER).days[0]).toMatchObject({ extra: 1, charged: null, shapeWords: 'master with a helper and 1 more' })
    expect(buildCrewDays(three, { ...OWNER, extraPerson: 60 }).days[0]).toMatchObject({ rate: 345, charged: 2760 })
  })

  it("applies the office's adjustments: a day set to another shape prices there and says so, a day left off is dropped and counted", () => {
    const days = [s('z', 'Zed', 'tech', '2026-04-25', 9.44), s('t', 'Toby', 'master', '2026-04-26', 8), s('t', 'Toby', 'master', '2026-04-27', 8)]
    const r = buildCrewDays(days, OWNER, { kind: 'shape', shape: 'master_helper' }, { dayShape: new Map([['2026-04-25', 'tech_alone']]), dayOff: new Set(['2026-04-26']) })
    expect(r.days.map((d) => [d.workDate, d.pricedShape, d.rate, d.charged, d.shapeWords, d.adjusted])).toEqual([
      ['2026-04-25', 'tech_alone', 185, 1746.4, 'a tech alone · adjusted', true],
      ['2026-04-27', 'master_helper', 285, 2280, 'master with a helper · the job’s rule', false],
    ])
    expect(r.totals).toMatchObject({ days: 2, charged: 4026.4, daysLeftOff: 1, daysAdjusted: 1 })
  })

  it('rolls days into weeks for the paper, Monday first, with everyone out that week once', () => {
    const r = buildCrewDays([
      s('t', 'Toby', 'master', '2026-04-20', 9), s('z', 'Zed', 'tech', '2026-04-20', 9.93),
      s('t', 'Toby', 'master', '2026-04-22', 8),
      s('t', 'Toby', 'master', '2026-04-27', 8), s('j', 'Jordan', 'helper', '2026-04-27', 8),
    ], OWNER)
    const weeks = crewDaysByWeek(r.days)
    expect(weeks.map((w) => [w.weekStart, w.days, w.crewHours, w.charged, w.who])).toEqual([
      ['2026-04-20', 2, 17.93, 2830.05, 'Zed, Toby'],
      ['2026-04-27', 1, 8, 2280, 'Jordan, Toby'],
    ])
    expect(weeks[0]!.shapeWords).toBe('master with a helper · master alone')
    expect(weeks[0]!.unpriced).toBe(1)
    expect(mondayOf('2026-04-25')).toBe('2026-04-20')
    expect(mondayOf('2026-04-20')).toBe('2026-04-20')
    expect(mondayOf('2026-11-01')).toBe('2026-10-26')
  })

  it("reads a job's rule from its columns and words it, falling back to the crew on each day", () => {
    expect(jobChargeRuleFrom({ charge_rule: 'shape', charge_shape: 'master_helper' }, parseCrewShape)).toEqual({ kind: 'shape', shape: 'master_helper' })
    expect(jobChargeRuleFrom({ charge_rule: 'flat', hourly_charge_rate: '300' }, parseCrewShape)).toEqual({ kind: 'flat', rate: 300 })
    expect(jobChargeRuleFrom({ charge_rule: 'flat', hourly_charge_rate: null }, parseCrewShape)).toEqual({ kind: 'crew' })
    expect(jobChargeRuleFrom({ charge_rule: 'shape', charge_shape: 'nope' }, parseCrewShape)).toEqual({ kind: 'crew' })
    expect(jobChargeRuleWords({ kind: 'crew' })).toBe('the crew on each day')
    expect(jobChargeRuleWords({ kind: 'shape', shape: 'master_helper' })).toBe('master with a helper throughout')
    expect(jobChargeRuleWords({ kind: 'flat', rate: 300 })).toBe('a flat $300.00 an hour')
  })
})

describe('who counts as nobody (punch list #254, the live pass)', () => {
  it('names the people out on days that priced at nothing because nobody was charged, most such days first', async () => {
    const { unchargedWords } = await import('./crewDays')
    const r = buildCrewDays(
      [
        s('t', 'Toby', 'none', '2026-01-20', 8),
        s('t', 'Toby', 'none', '2026-01-21', 8),
        s('j', 'Jordan', 'none', '2026-01-21', 8),
        s('t', 'Toby', 'none', '2026-01-22', 8),
        s('t', 'Toby', 'master', '2026-01-23', 8),
        s('o', 'Office', 'none', '2026-01-23', 4),
        s('a', 'Ainsley', 'tech', '2026-01-26', 8),
        s('o', 'Office', 'none', '2026-01-26', 2),
      ].map((x) => (x.workDate === '2026-01-23' && x.userId === 't' ? { ...x, userId: 't2' } : x)),
      OWNER,
    )
    expect(r.totals.unpriced).toBe(4)
    expect(r.totals.uncharged).toEqual([
      { userId: 't', name: 'Toby', days: 3 },
      { userId: 'j', name: 'Jordan', days: 1 },
    ])
    expect(unchargedWords(r.totals.uncharged)).toBe('Toby and Jordan count as nobody on the rate card yet.')
    expect(unchargedWords([{ name: 'Toby' }])).toBe('Toby counts as nobody on the rate card yet.')
    expect(unchargedWords([{ name: 'A' }, { name: 'B' }, { name: 'C' }, { name: 'D' }, { name: 'E' }])).toBe('A, B, C and 2 more count as nobody on the rate card yet.')
    expect(unchargedWords([])).toBeNull()
  })
})
