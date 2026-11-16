import { describe, expect, it } from 'vitest'
import type { NeedsWorkOrderRosterPerson } from './rosterSub'
import { buildSheetPartiesLookup } from './sheetParties'
import { crewStepLine, crewStepTitle, jobTeamOfferWords, nextCrewPick, sameLinesOnOtherSheets, SHEET_ONE_NAME, SHEET_PRETICKS_JOB_TEAM, whoseSheetPlan } from './sheetCrewWords'

// Made-up people.
const ROSTER: NeedsWorkOrderRosterPerson[] = [
  { id: 'ridgeline', name: 'Ridgeline Coring LLC', kind: 'sub', accountRole: null },
  { id: 'marlow', name: 'Marlow Tile', kind: 'sub', accountRole: 'subcontractor' },
  { id: 'dana', name: 'Dana Whitlock', kind: 'sub', accountRole: 'superintendent' },
  { id: 'owen', name: 'Owen Farris', kind: 'helper', accountRole: 'helpers' },
]
const lookup = buildSheetPartiesLookup(ROSTER)

describe('crewStepLine — what the Crew step says', () => {
  it('says nothing until someone is picked', () => {
    expect(crewStepLine([], lookup)).toBeNull()
  })
  it('one sub: the sheet is theirs', () => {
    expect(crewStepLine(['Marlow Tile'], lookup)).toMatchObject({ tone: 'info', head: "This is Marlow Tile's sheet.", extraSubs: [] })
  })
  it('a sub and teammates: a warning, since a sheet names only the one person it pays', () => {
    const l = crewStepLine(['Marlow Tile', 'Owen Farris', 'Dana Whitlock'], lookup)!
    expect(l.tone).toBe('warn')
    expect(l.body).toBe('Owen Farris and Dana Whitlock are named on it and not paid from it. A sheet names only the one person it pays. To pay a teammate, give them a sheet of their own.')
    expect(l.extraSubs).toEqual([])
    // One press takes them off, and the sheet stays the sub's.
    expect(l.rideAlongs).toEqual(['Owen Farris', 'Dana Whitlock'])
  })
  it('a second sub: warns, does not block, and names who would get a sheet of their own', () => {
    const l = crewStepLine(['Ridgeline Coring LLC', 'Marlow Tile', 'Owen Farris'], lookup)!
    expect(l).toMatchObject({ tone: 'warn', head: 'Two subs on one sheet.', extraSubs: ['Marlow Tile'] })
    expect(l.body).toContain("on nobody's Balance due")
  })
  it('one teammate and no sub: owed to nobody today, owed to them under the bonus rule', () => {
    expect(crewStepLine(['Dana Whitlock'], lookup, 'payroll')).toMatchObject({ head: 'No sub on this sheet.', body: 'It names Dana Whitlock and is owed to nobody. Its money is in no Balance due.' })
    expect(crewStepLine(['Dana Whitlock'], lookup, 'owed')).toMatchObject({ tone: 'info', head: 'No sub on this sheet. It is owed to Dana Whitlock as sub labor.' })
  })
  it('the rule with nothing said is Taunya\'s pick: one teammate and no sub is owed to them', () => {
    expect(crewStepLine(['Dana Whitlock'], lookup)).toMatchObject({ head: 'No sub on this sheet. It is owed to Dana Whitlock as sub labor.', rideAlongs: [] })
  })
  it('two teammates and no sub under the bonus rule: a sheet each', () => {
    expect(crewStepLine(['Dana Whitlock', 'Owen Farris'], lookup, 'owed')).toMatchObject({ tone: 'warn', head: '2 teammates and no sub.' })
  })
})

describe('sameLinesOnOtherSheets — one piece of work on two sheets', () => {
  const others = [
    { id: 'a', labor_rate: null, items: [{ fixture: 'Top-out', count: 1, hrs_per_unit: 0, direct_labor_amount: 1800 }] },
    { id: 'b', labor_rate: 50, items: [{ fixture: 'Rough-in', count: 2, hrs_per_unit: 4 }] },
  ]
  it('flags the same words and the same amount', () => {
    const w = sameLinesOnOtherSheets([{ label: 'top-out ', amount: 1800 }, { label: 'Rough-in', amount: 400 }, { label: 'Trim', amount: 1800 }], others)
    expect(w.map((x) => [x.label, x.sheetIds])).toEqual([['top-out', ['a']], ['Rough-in', ['b']]])
    expect(w[0]!.words).toBe('top-out · $1,800.00 is already on another sheet for this job. Check that one piece of work is not entered twice.')
  })
  it('says nothing for the same words at another amount, or an empty line', () => {
    expect(sameLinesOnOtherSheets([{ label: 'Top-out', amount: 900 }, { label: '', amount: 1800 }, { label: 'Top-out', amount: 0 }], others)).toEqual([])
  })
})

describe('whoseSheetPlan — what a choice adds to each balance, before it is saved', () => {
  const names = ['Ridgeline Coring LLC', 'Marlow Tile']
  it('one sub: the whole open amount, once, and nothing to the other', () => {
    const p = whoseSheetPlan(names, 800, 1, { kind: 'one', personId: 'marlow', name: 'Marlow Tile' })
    expect(p.adds).toEqual([{ name: 'Marlow Tile', amount: 800 }, { name: 'Ridgeline Coring LLC', amount: 0 }])
    expect(p.sumsToOpen).toBe(true)
    expect(p.removes).toEqual(['Ridgeline Coring LLC'])
    expect(p.confirmLabel).toBe("Make 1 sheet Marlow Tile's")
    expect(p.words).toBe("Marlow Tile's Balance due gains $800.00. Ridgeline Coring LLC comes off the sheet and gains nothing.")
  })
  it('leave it: nothing changes and there is no press', () => {
    const p = whoseSheetPlan(names, 800, 1, { kind: 'leave' })
    expect(p).toMatchObject({ adds: [], confirmLabel: null })
    expect(p.words).toContain("stays on nobody's row")
  })
  it('a split is drawn and held: no press until the split is decided', () => {
    expect(whoseSheetPlan(names, 800, 1, { kind: 'split' }).confirmLabel).toBeNull()
  })
  it('a name the roster did not know, linked to one sub', () => {
    const p = whoseSheetPlan(['Harlan Mech'], 2500, 2, { kind: 'one', personId: 'harlan', name: 'Harlan Mechanical' })
    expect(p.adds[0]).toEqual({ name: 'Harlan Mechanical', amount: 2500 })
    expect(p.confirmLabel).toBe("Make 2 sheets Harlan Mechanical's")
  })
})

describe('jobTeamOfferWords — a picked job offers its team and ticks nobody', () => {
  it('the old fill is off', () => {
    expect(SHEET_PRETICKS_JOB_TEAM).toBe(false)
  })
  it('nobody ticked: offers the whole team and asks for the one person the sheet pays', () => {
    expect(jobTeamOfferWords(['Marlow Tile', 'Dana Whitlock', 'Owen Farris'], [])).toEqual({ words: "On this job's team. Tick the one person this sheet pays.", offer: ['Marlow Tile', 'Dana Whitlock', 'Owen Farris'] })
  })
  it('one ticked, under one name: the offer goes quiet', () => {
    expect(jobTeamOfferWords(['Marlow Tile', 'Dana Whitlock'], ['Marlow Tile']).words).toBe('')
  })
  it('one ticked, the old step: the rest are named as not on the sheet', () => {
    expect(jobTeamOfferWords(['Marlow Tile', 'Dana Whitlock'], ['Marlow Tile'], false)).toEqual({ words: "Also on this job's team, not on this sheet.", offer: ['Dana Whitlock'] })
  })
  it('says nothing when the job has no team, or all of it is ticked', () => {
    expect(jobTeamOfferWords([], []).words).toBe('')
    expect(jobTeamOfferWords(['Marlow Tile'], ['Marlow Tile']).words).toBe('')
  })
})

describe('nextCrewPick — the people step is one pick (Taunya: "Only one name")', () => {
  it('the switch is on and the step is called Paid to', () => {
    expect(SHEET_ONE_NAME).toBe(true)
    expect(crewStepTitle()).toBe('Paid to')
    expect(crewStepTitle(false)).toBe('Crew')
  })
  it('the first name is ticked', () => {
    expect(nextCrewPick([], 'Marlow Tile')).toEqual(['Marlow Tile'])
  })
  it('a second name takes the place of the first', () => {
    expect(nextCrewPick(['Marlow Tile'], 'Dana Whitlock')).toEqual(['Dana Whitlock'])
  })
  it('pressing the ticked name takes it off', () => {
    expect(nextCrewPick(['Marlow Tile'], 'Marlow Tile')).toEqual([])
  })
  it('an old sheet with several names: pressing one of them takes only that one off', () => {
    expect(nextCrewPick(['Marlow Tile', 'Dana Whitlock', 'Owen Farris'], 'Dana Whitlock')).toEqual(['Marlow Tile', 'Owen Farris'])
  })
  it('an old sheet with several names: pressing a new name makes the sheet that person’s', () => {
    expect(nextCrewPick(['Marlow Tile', 'Dana Whitlock'], 'Harlan Mechanical')).toEqual(['Harlan Mechanical'])
  })
  it('the old step adds names', () => {
    expect(nextCrewPick(['Marlow Tile'], 'Dana Whitlock', false)).toEqual(['Marlow Tile', 'Dana Whitlock'])
  })
})
