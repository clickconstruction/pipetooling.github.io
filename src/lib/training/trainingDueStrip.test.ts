import { describe, expect, it } from 'vitest'
import { dueCounts, dueSplit, dueVerdict, personDueStrips, trainingDueStrip } from './trainingDueStrip'
import type { TrainingPass, TrainingPolicy } from './trainingState'

const osha: TrainingPolicy = {
  slug: 'osha-30-refresher',
  title: 'OSHA 30 refresher',
  on: true,
  requiredRoles: ['helpers', 'subcontractor'],
  goodForMonths: 12,
  dueSoonDays: 30,
  retakeFrom: null,
  offered: false,
}
const TODAY = '2026-10-30'
const pass = (passedOn: string, contentVersion = '1a2b3c4d', slug = osha.slug): TrainingPass => ({ slug, passedOn, contentVersion })

describe('trainingDueStrip', () => {
  it('is null when the course is off or the role need not take it', () => {
    expect(trainingDueStrip({ ...osha, on: false }, [pass('2026-03-03')], 'helpers', TODAY)).toBeNull()
    expect(trainingDueStrip(osha, [pass('2026-03-03')], 'assistant', TODAY)).toBeNull()
  })

  it('current: today sits before the shaded window, the version named at the start, the due day at the end', () => {
    const s = trainingDueStrip(osha, [pass('2026-03-03')], 'helpers', TODAY)!
    expect(s).toMatchObject({ state: 'current', passedOn: '2026-03-03', dueOn: '2027-03-03', daysToDue: 124, version: '1a2b3c4d', overrun: false })
    // 241 of 365 days gone; the 30-day window starts at 335/365.
    expect(s.todayPct).toBe(66)
    expect(s.windowPct).toBe(91.8)
    expect(s.chip).toEqual({ tone: 'green', label: 'current' })
    expect(s.startLabel).toEqual({ head: 'passed', sub: 'Mar 3 · version 1a2b3c4d' })
    expect(s.endLabel).toEqual({ head: 'due Mar 3, 2027', sub: 'in 124 days' })
    expect(s.words).toBe('OSHA 30 refresher: passed Mar 3 on version 1a2b3c4d, good until Mar 3, 2027, 124 days from today. The last 30 days before it are shaded: current.')
  })

  it('due soon: inside the window and not past the day, the chip names the days, the tick inside the shade', () => {
    const s = trainingDueStrip(osha, [pass('2025-11-03')], 'helpers', TODAY)!
    expect(s).toMatchObject({ state: 'due-soon', dueOn: '2026-11-03', daysToDue: 4, overrun: false })
    expect(s.todayPct).toBeGreaterThan(s.windowPct)
    expect(s.todayPct).toBeLessThan(100)
    expect(s.chip).toEqual({ tone: 'amber', label: 'due soon · 4 days' })
    expect(s.endLabel).toEqual({ head: 'due Nov 3', sub: 'in 4 days' })
    expect(s.words).toBe('OSHA 30 refresher: passed Nov 3, 2025 on version 1a2b3c4d, good until Nov 3. Today is 4 days before, inside the last 30 days: due soon.')
    const today = trainingDueStrip(osha, [pass('2025-10-30')], 'helpers', TODAY)!
    expect(today.chip).toEqual({ tone: 'amber', label: 'due today' })
    expect(today.endLabel).toEqual({ head: 'due Oct 30', sub: 'today' })
  })

  it('lapsed: past the day, the strip is full, the tick at the end and the chip says how long ago', () => {
    const s = trainingDueStrip(osha, [pass('2025-10-03')], 'helpers', TODAY)!
    expect(s).toMatchObject({ state: 'lapsed', dueOn: '2026-10-03', daysToDue: -27, todayPct: 100, overrun: true })
    expect(s.chip).toEqual({ tone: 'red', label: 'lapsed · 27 days' })
    expect(s.endLabel).toEqual({ head: 'was due Oct 3', sub: '27 days ago' })
    expect(s.words).toBe('OSHA 30 refresher: passed Oct 3, 2025 on version 1a2b3c4d, good until Oct 3. That was 27 days ago: lapsed.')
  })

  it('a newer version by itself changes nothing: the newest pass counts whatever its version, and names it', () => {
    const s = trainingDueStrip(osha, [pass('2026-01-10', 'aaaa1111'), pass('2025-06-01', 'bbbb2222')], 'helpers', TODAY)!
    expect(s).toMatchObject({ state: 'current', passedOn: '2026-01-10', version: 'aaaa1111' })
  })

  it('superseded: a retake day voids the old pass, and the strip runs from that pass to the cut as its own case', () => {
    const policy = { ...osha, retakeFrom: '2026-10-01' }
    const s = trainingDueStrip(policy, [pass('2025-11-03', 'aaaa1111')], 'helpers', TODAY)!
    expect(s).toMatchObject({ state: 'superseded', passedOn: '2025-11-03', version: 'aaaa1111', dueOn: '2026-10-01', daysToDue: null, retakeFrom: '2026-10-01', todayPct: 100, windowPct: 100, overrun: true })
    expect(s.chip).toEqual({ tone: 'red', label: 'older version · take it again' })
    expect(s.endLabel).toEqual({ head: 'counts for nothing from Oct 1', sub: 'everyone takes it again' })
    expect(s.words).toBe('OSHA 30 refresher: passed Nov 3, 2025 on version aaaa1111. A dev asked everyone to take it again from Oct 1, so that pass counts for nothing. Take it again.')
    // A pass on or after the retake day counts again, whatever its version.
    const again = trainingDueStrip(policy, [pass('2025-11-03', 'aaaa1111'), pass('2026-10-20', 'aaaa1111')], 'helpers', TODAY)!
    expect(again).toMatchObject({ state: 'current', passedOn: '2026-10-20', retakeFrom: '2026-10-01' })
  })

  it('not done: no pass at all, no strip, the chip alone', () => {
    const s = trainingDueStrip(osha, [pass('2026-03-03', 'x', 'other')], 'helpers', TODAY)!
    expect(s).toMatchObject({ state: 'not-done', passedOn: null, todayPct: null, startLabel: null, endLabel: null, words: 'OSHA 30 refresher: not done.' })
    expect(s.chip).toEqual({ tone: 'red', label: 'not done' })
  })

  it('orders worst first and gives the verdict with the split', () => {
    const intro: TrainingPolicy = { ...osha, slug: 'intro', title: 'Intro to plumbing' }
    const elec: TrainingPolicy = { ...osha, slug: 'elec', title: 'Intro to electrical' }
    const strips = personDueStrips([osha, intro, elec], [pass('2025-11-03'), pass('2025-10-03', 'x', 'intro')], 'helpers', TODAY)
    expect(strips.map((s) => [s.slug, s.state])).toEqual([
      ['elec', 'not-done'],
      ['intro', 'lapsed'],
      ['osha-30-refresher', 'due-soon'],
    ])
    expect(dueVerdict(strips)).toEqual({ colour: 'red', line: '1 course to do' })
    expect(dueVerdict(strips.slice(1))).toEqual({ colour: 'red', line: '1 course lapsed' })
    expect(dueVerdict(strips.slice(2))).toEqual({ colour: 'amber', line: '1 course due soon' })
    expect(dueVerdict([trainingDueStrip(osha, [pass('2026-03-03')], 'helpers', TODAY)!])).toEqual({ colour: 'green', line: 'You are caught up' })
    expect(dueVerdict([])).toBeNull()
  })

  it('splits a SQL standing by the day and counts the four states', () => {
    expect(dueSplit({ colour: 'amber', daysToDue: 4 }, 30)).toBe('due-soon')
    expect(dueSplit({ colour: 'amber', daysToDue: -12 }, 30)).toBe('lapsed')
    expect(dueSplit({ colour: 'green', daysToDue: 139 }, 30)).toBe('current')
    expect(dueSplit({ colour: 'red', daysToDue: null }, 30)).toBe('not-done')
    expect(dueCounts(['current', 'current', 'due-soon', 'lapsed', 'not-done', 'superseded'])).toEqual({ current: 2, dueSoon: 1, lapsed: 1, notDone: 2 })
  })
})
