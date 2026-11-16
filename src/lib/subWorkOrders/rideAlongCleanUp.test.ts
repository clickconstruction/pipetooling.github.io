import { describe, expect, it } from 'vitest'
import type { NeedsWorkOrderRosterPerson } from './rosterSub'
import { buildSheetPartiesLookup, sheetParties } from './sheetParties'
import { rideAlongCleanUp, rideAlongOfferWords, rideAlongOutcomeWords, rideAlongPlan, rideAlongRowWords, type RideAlongSheetInput } from './rideAlongCleanUp'

// Made-up people and sheets.
const ROSTER: NeedsWorkOrderRosterPerson[] = [
  { id: 'harlan', name: 'Harlan Mechanical', kind: 'sub', accountRole: 'subcontractor' },
  { id: 'marlow', name: 'Marlow Tile', kind: 'sub', accountRole: 'subcontractor' },
  { id: 'dana', name: 'Dana Whitlock', kind: 'sub', accountRole: 'superintendent' },
  { id: 'owen', name: 'Owen Farris', kind: 'helper', accountRole: 'helpers' },
  { id: 'priya', name: 'Priya Anand', kind: 'master_technician', accountRole: 'master_technician' },
]
const lookup = buildSheetPartiesLookup(ROSTER)
const byIds = (...ids: string[]) => sheetParties({ assigned_to_name: null }, ids.map((id) => ({ personId: id, personName: null })), lookup)
const byWords = (names: string) => sheetParties({ assigned_to_name: names }, undefined, lookup)
const sheet = (id: string, parties: RideAlongSheetInput['parties'], total: number, open: number, day = '2026-09-10'): RideAlongSheetInput => ({ id, label: `#20${id.length}1 ${id}`, day, parties, total, open })

const SHEETS: RideAlongSheetInput[] = [
  sheet('paid', byIds('harlan', 'dana', 'priya'), 500, 0, '2026-08-25'),
  sheet('open', byIds('marlow', 'dana', 'owen', 'priya'), 2150, 2150, '2026-09-17'),
  sheet('alone', byIds('harlan'), 900, 900),
  sheet('bonus', byIds('dana'), 450, 450),
  sheet('teammates', byIds('dana', 'owen'), 300, 300),
  sheet('two-subs', byIds('harlan', 'marlow', 'dana'), 1200, 1200, '2026-09-12'),
  sheet('unknown-sub', byWords('Ridgeline Coring LLC | Dana Whitlock'), 700, 700, '2026-09-11'),
]

describe('rideAlongCleanUp — which sheets carry a teammate beside a sub', () => {
  const c = rideAlongCleanUp(SHEETS)
  it('lists a sheet with one sub and teammates, oldest first, and keeps the sub', () => {
    expect(c.ready.map((r) => r.sheetId)).toEqual(['paid', 'open'])
    expect(c.ready[0]).toMatchObject({ sub: { id: 'harlan', name: 'Harlan Mechanical' }, takeOff: ['Dana Whitlock', 'Priya Anand'], nextAssignedToName: 'Harlan Mechanical', total: 500, open: 0 })
    expect(rideAlongRowWords(c.ready[0]!)).toBe('Harlan Mechanical keeps it. Dana Whitlock and Priya Anand come off.')
    expect(rideAlongRowWords({ ...c.ready[0]!, takeOff: ['Dana Whitlock'] })).toBe('Harlan Mechanical keeps it. Dana Whitlock comes off.')
  })
  it('leaves alone a sheet with one name, a teammate’s own sheet and a sheet of teammates only', () => {
    const all = [...c.ready.map((r) => r.sheetId), ...c.held.map((h) => h.sheetId)]
    for (const id of ['alone', 'bonus', 'teammates']) expect(all).not.toContain(id)
  })
  it('holds a sheet with two subs for the band’s window, with the reason', () => {
    expect(c.held.find((h) => h.sheetId === 'two-subs')).toMatchObject({ why: 'It names two subs. Say whose it is first.', door: 'whose' })
  })
  it('holds a sheet whose sub the roster cannot find: the save would leave it tied to nobody', () => {
    expect(c.held.find((h) => h.sheetId === 'unknown-sub')).toMatchObject({ why: 'Ridgeline Coring LLC has no roster row, so the sheet cannot be tied to them. Fix the name on the sheet first.', door: 'sheet' })
  })
  it('offers itself in one line, and says nothing when there is nothing to clean', () => {
    expect(rideAlongOfferWords(c)).toBe("4 subs' sheets also name a teammate. The teammate is not paid from them.")
    expect(rideAlongOfferWords(rideAlongCleanUp([SHEETS[0]!]))).toBe("1 sub's sheet also names a teammate. The teammate is not paid from it.")
    expect(rideAlongOfferWords(rideAlongCleanUp([SHEETS[2]!]))).toBe('')
  })
})

describe('rideAlongPlan — the press says what it does, and a hold never stops the rest', () => {
  const c = rideAlongCleanUp(SHEETS)
  it('acts on the ticked ready sheets and names the held ones on the button', () => {
    const p = rideAlongPlan(c, new Set(['paid', 'open', 'two-subs']))
    expect(p.rows.map((r) => r.sheetId)).toEqual(['paid', 'open'])
    expect(p.words).toMatchObject({ button: 'Take teammates off 2 sheets · 2 need a look first ▸', dead: false })
    expect(p.teammates).toEqual(['Dana Whitlock', 'Priya Anand', 'Owen Farris'])
    expect(p.effect).toBe('The 2 sheets stay with their two subs. Dana Whitlock, Priya Anand and Owen Farris are no longer named on them, so they leave those people’s own lists.')
  })
  it('shows that no money moves', () => {
    expect(rideAlongPlan(c, new Set(['paid', 'open'])).sumWords).toBe('No amount, payment or date changes. $2,150.00 is open on them before, and $2,150.00 after.')
  })
  it('says what moves in reviews: the teammates’ equal shares of each sheet’s cost go to the sub', () => {
    // 'paid' is 500 under three names: two thirds sit on the teammates. 'open' is 2,150 under four: three quarters.
    const p = rideAlongPlan(c, new Set(['paid', 'open']))
    expect(p.reviewMoved).toBe(1945.83)
    expect(p.reviewWords).toBe("People → Review and the Team Summary split a sheet's cost evenly between its names. After this each sheet's whole cost is its sub's, so $1,945.83 of sheet cost leaves the teammates' panels.")
    expect(rideAlongPlan(c, new Set()).reviewWords).toBe('')
  })
  it('one sheet reads in the singular', () => {
    const p = rideAlongPlan(rideAlongCleanUp([SHEETS[0]!]), new Set(['paid']))
    expect(p.words).toEqual({ button: 'Take teammates off 1 sheet', foot: null, dead: false })
    expect(p.effect).toBe("The sheet stays Harlan Mechanical's. Dana Whitlock and Priya Anand are no longer named on it, so it leaves those people’s own lists.")
  })
  it('is dead with nothing ticked', () => {
    const p = rideAlongPlan(c, new Set())
    expect(p.words.dead).toBe(true)
    expect(p.effect).toBe('')
  })
  it('names what took and what did not after the run', () => {
    expect(rideAlongOutcomeWords(8, 0)).toMatchObject({ line: 'Changed 8 sheets.', head: null, tone: 'success' })
    expect(rideAlongOutcomeWords(7, 1)).toMatchObject({ line: 'Changed 7 sheets. 1 did not change.', tone: 'warning' })
  })
})
