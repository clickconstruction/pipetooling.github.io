import { describe, expect, it } from 'vitest'
import {
  countingPass,
  courseStanding,
  personStandings,
  standingCounts,
  standingPress,
  standingWords,
  trainingChip,
  trainingVerdict,
  worstColour,
  ymdAddMonths,
  ymdDiffDays,
  ymdWords,
  type TrainingPass,
  type TrainingPolicy,
} from './trainingState'

const osha: TrainingPolicy = {
  slug: 'osha-30-refresher',
  title: 'OSHA 30 refresher',
  on: true,
  requiredRoles: ['helpers', 'subcontractor', 'primary', 'master_technician', 'superintendent'],
  goodForMonths: 12,
  dueSoonDays: 30,
  retakeFrom: null,
}

const TODAY = '2026-10-15'

describe('days', () => {
  it('adds months by the calendar and clamps the day', () => {
    expect(ymdAddMonths('2025-10-03', 12)).toBe('2026-10-03')
    expect(ymdAddMonths('2026-01-31', 1)).toBe('2026-02-28')
    expect(ymdAddMonths('2026-11-15', 3)).toBe('2027-02-15')
    expect(ymdAddMonths('2026-03-03', 0)).toBe('2026-03-03')
  })
  it('diffs calendar days with no time zone and prints a day in words', () => {
    expect(ymdDiffDays('2026-10-15', '2026-10-03')).toBe(-12)
    expect(ymdDiffDays('2026-10-15', '2026-11-07')).toBe(23)
    expect(ymdWords('2026-03-03')).toBe('Mar 3, 2026')
    expect(ymdWords('2026-03-03', '2026-10-15')).toBe('Mar 3')
    expect(ymdWords('2027-03-03', '2026-10-15')).toBe('Mar 3, 2027')
  })
})

describe('courseStanding', () => {
  it('is null when the course is off or the role need not take it', () => {
    expect(courseStanding({ ...osha, on: false }, [], 'helpers', TODAY)).toBeNull()
    expect(courseStanding(osha, [], 'assistant', TODAY)).toBeNull()
    expect(courseStanding(osha, [], null, TODAY)).toBeNull()
  })
  it('red with no pass, green inside the window, amber from 30 days before, amber once lapsed', () => {
    expect(courseStanding(osha, [], 'helpers', TODAY)).toMatchObject({ colour: 'red', passedOn: null, dueOn: null, daysToDue: null })
    const green = courseStanding(osha, [{ slug: osha.slug, passedOn: '2026-03-03', contentVersion: 'a' }], 'helpers', TODAY)!
    expect(green).toMatchObject({ colour: 'green', passedOn: '2026-03-03', dueOn: '2027-03-03', daysToDue: 139 })
    const soon = courseStanding(osha, [{ slug: osha.slug, passedOn: '2025-11-07', contentVersion: 'a' }], 'helpers', TODAY)!
    expect(soon).toMatchObject({ colour: 'amber', dueOn: '2026-11-07', daysToDue: 23 })
    const edge = courseStanding(osha, [{ slug: osha.slug, passedOn: '2025-11-14', contentVersion: 'a' }], 'helpers', TODAY)!
    expect(edge).toMatchObject({ colour: 'amber', daysToDue: 30 })
    const justGreen = courseStanding(osha, [{ slug: osha.slug, passedOn: '2025-11-15', contentVersion: 'a' }], 'helpers', TODAY)!
    expect(justGreen).toMatchObject({ colour: 'green', daysToDue: 31 })
    const lapsed = courseStanding(osha, [{ slug: osha.slug, passedOn: '2025-10-03', contentVersion: 'a' }], 'helpers', TODAY)!
    expect(lapsed).toMatchObject({ colour: 'amber', dueOn: '2026-10-03', daysToDue: -12 })
  })
  it('the newest pass counts, a pass before retakeFrom does not, another course’s pass never does', () => {
    const passes: TrainingPass[] = [
      { slug: osha.slug, passedOn: '2025-01-01', contentVersion: 'a' },
      { slug: osha.slug, passedOn: '2026-06-01', contentVersion: 'b' },
      { slug: 'other', passedOn: '2026-10-01', contentVersion: 'c' },
    ]
    expect(countingPass(osha, passes)?.passedOn).toBe('2026-06-01')
    expect(countingPass({ ...osha, retakeFrom: '2026-07-01' }, passes)).toBeNull()
    expect(courseStanding({ ...osha, retakeFrom: '2026-07-01' }, passes, 'helpers', TODAY)?.colour).toBe('red')
    expect(courseStanding({ ...osha, retakeFrom: '2026-06-01' }, passes, 'helpers', TODAY)?.colour).toBe('green')
  })
  it('a window of 0 months turns everyone amber at once', () => {
    const s = courseStanding({ ...osha, goodForMonths: 0 }, [{ slug: osha.slug, passedOn: '2026-10-10', contentVersion: 'a' }], 'helpers', TODAY)!
    expect(s.colour).toBe('amber')
    expect(s.daysToDue).toBe(-5)
  })
})

describe('the words', () => {
  it('verdict, press and the line under the course', () => {
    const red = courseStanding(osha, [], 'helpers', TODAY)!
    const lapsed = courseStanding(osha, [{ slug: osha.slug, passedOn: '2025-10-03', contentVersion: 'a' }], 'helpers', TODAY)!
    const soon = courseStanding(osha, [{ slug: osha.slug, passedOn: '2025-11-07', contentVersion: 'a' }], 'helpers', TODAY)!
    const green = courseStanding(osha, [{ slug: osha.slug, passedOn: '2026-03-03', contentVersion: 'a' }], 'helpers', TODAY)!
    expect(trainingVerdict([red])).toEqual({ colour: 'red', line: '1 course to do' })
    expect(trainingVerdict([red, red])).toEqual({ colour: 'red', line: '2 courses to do' })
    expect(trainingVerdict([lapsed, green])).toEqual({ colour: 'amber', line: '1 course to take again' })
    expect(trainingVerdict([green])).toEqual({ colour: 'green', line: 'You are caught up' })
    expect(trainingVerdict([])).toBeNull()
    expect(standingWords(red, TODAY)).toBe('')
    expect(standingWords(lapsed, TODAY)).toBe('Done Oct 3, 2025 · was due Oct 3, 12 days ago')
    expect(standingWords(soon, TODAY)).toBe('Done Nov 7, 2025 · due again Nov 7, in 23 days')
    expect(standingWords(green, TODAY)).toBe('Done Mar 3 · due again Mar 3, 2027')
    expect(standingPress(red, false)).toBe('Start')
    expect(standingPress(red, true)).toBe('Continue')
    expect(standingPress(lapsed, true)).toBe('Take it again')
    expect(standingPress(green, true)).toBe('Read it again')
  })
  it('the People chip: red training due beats amber training lapsed; green shows nothing', () => {
    const red = courseStanding(osha, [], 'helpers', TODAY)!
    const lapsed = courseStanding(osha, [{ slug: osha.slug, passedOn: '2025-10-03', contentVersion: 'a' }], 'helpers', TODAY)!
    const green = courseStanding(osha, [{ slug: osha.slug, passedOn: '2026-03-03', contentVersion: 'a' }], 'helpers', TODAY)!
    expect(trainingChip([red, lapsed])).toEqual({ tone: 'red', label: 'training due', long: 'OSHA 30 refresher not done' })
    expect(trainingChip([lapsed])).toEqual({ tone: 'amber', label: 'training lapsed', long: 'OSHA 30 refresher lapsed Oct 3, 2026' })
    expect(trainingChip([green])).toBeNull()
    expect(trainingChip([])).toBeNull()
  })
  it('personStandings sorts worst first and standingCounts sums the office view', () => {
    const second: TrainingPolicy = { ...osha, slug: 'trench-tailgate', title: 'Trench tailgate' }
    const passes: TrainingPass[] = [{ slug: 'trench-tailgate', passedOn: '2026-09-01', contentVersion: 'a' }]
    const standings = personStandings([second, osha], passes, 'helpers', TODAY)
    expect(standings.map((s) => [s.slug, s.colour])).toEqual([
      ['osha-30-refresher', 'red'],
      ['trench-tailgate', 'green'],
    ])
    expect(worstColour(standings)).toBe('red')
    expect(standingCounts([standings[0] ?? null, standings[1] ?? null, null, courseStanding(osha, [{ slug: osha.slug, passedOn: '2025-10-03', contentVersion: 'a' }], 'helpers', TODAY)])).toEqual({ current: 1, lapsed: 1, notDone: 1 })
  })
})
