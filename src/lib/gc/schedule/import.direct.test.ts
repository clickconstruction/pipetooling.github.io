/**
 * Main's own tests for drawing the schedule from another company's file (G-137; the schedule's PR
 * 1b): what a file holds in a sentence, two names that are one, when an import is refused, and the
 * words about what it left out, run through the kernels on the test data. The spike's own cases:
 * Helotes Dental Office, in buyout, its first draft drawn from Mon Oct 5, and the lines Studio
 * Ocotillo's file for it does not name.
 */
import { describe, expect, it } from 'vitest'
import { plainWordsFailures } from '../../plainWords'
import { addDays } from '../building'
import type { GcProject, GcState } from '../types'
import { scheduleDraft } from './draft'
import type { ImportFileRow } from './import'
import { importHoldsWords, importLines, importRefusal, notInWords, notPlacedWords, sameName } from './import'
import { moveRecord, planMove } from './moves'
import { initialGcState } from './testState'
import { whatIfCopy } from './whatIf'

const job = (s: GcState, id: string) => s.projects.find((p) => p.id === id)!
/** Helotes Dental Office with its first draft drawn from Mon Oct 5, before Start. */
function drawn(): GcProject {
  const p = job(initialGcState(), 'helotes')
  return { ...p, schedule: scheduleDraft(p, '2026-10-05') }
}
/** A row of theirs: an activity, or a date to meet. */
const row = (key: string, date = false): ImportFileRow => ({ key, name: `Activity ${key}`, groups: [], start: '2026-10-05', finish: date ? '2026-10-05' : '2026-10-09', date, after: [], notBefore: null, mustFinishBy: null, kind: null, trade: null, company: null, underADay: false })
/** The lines the file does not name, the spike's case, from Helotes' own lines. */
function notNamed() {
  const lines = importLines(drawn())
  return ['Panels and feeders', 'Lighting', 'Low voltage rough', 'Split systems', 'Controls', 'Top out', 'Operatory cabinets', 'Break room'].map((label) => lines.find((l) => l.label === label)!)
}

describe('what a file holds, and two names that are one', () => {
  it('counts the activities, the waits between them and the dates', () => {
    const rows = [...Array.from({ length: 13 }, (_, i) => row(`a${i}`)), ...Array.from({ length: 4 }, (_, i) => row(`d${i}`, true))]
    expect(importHoldsWords({ format: 'project', title: 'Helotes Dental Office', rows, waits: 14, unread: [] })).toBe('What it holds: 13 activities, 14 waits between them and 4 dates.')
    expect(importHoldsWords({ format: 'spreadsheet', title: null, rows: [row('a1')], waits: 0, unread: [] })).toBe('What it holds: 1 activity.')
  })

  it('reads two names as one when only their case and marks differ', () => {
    expect(sameName('Rough-in inspection', 'rough in INSPECTION')).toBe(true)
    expect(sameName('Panels & feeders', 'Panels and feeders')).toBe(false)
  })
})

describe('when an import is refused', () => {
  it('is refused while bidding, on a lost job, past Start, after a walk or a move, and while a what-if copy is open', () => {
    const s = initialGcState()
    const helo = drawn()
    const schedule = helo.schedule!
    // A job with no schedule, or a first draft nobody walked or moved, takes one.
    expect([importRefusal(job(s, 'helotes')), importRefusal(helo)]).toEqual([null, null])
    expect(importRefusal(job(s, 'boerne'))).toBe('While we bid, the rough schedule is the one to draw.')
    expect(importRefusal({ ...job(s, 'helotes'), lostOn: '2026-09-30' })).toBe('This job was lost.')
    expect(importRefusal(job(s, 'fairoaksd'))).toBe('This job started Wed Jul 1. A new set of plans is the way to change its schedule now.')
    expect(importRefusal({ ...helo, schedule: { ...schedule, walks: [{ id: 'w1', on: '2026-10-01', by: 'Robert Douglas', kept: [], moveIds: [], skipped: 0 }] } })).toBe('The schedule was walked. Its record stays as it is.')
    // A move saved with its reason, before Start.
    const framing = schedule.activities.find((a) => importLines(helo).find((l) => l.lineId === a.lineId)?.label === 'Framing')!
    const plan = planMove(helo, framing.lineId, addDays(framing.start, 2), addDays(framing.finish, 2))!
    const move = moveRecord(schedule, framing.lineId, plan, { reason: 'crew', note: 'The framers start Wednesday.', by: 'Robert Douglas' }, s.today)
    expect(importRefusal({ ...helo, schedule: { ...schedule, activities: plan.activities, moves: [move] } })).toBe('The schedule has moves with their reasons. They stay as they are.')
    expect(importRefusal({ ...helo, whatIf: whatIfCopy(helo, 'Robert Douglas', s.today)! })).toBe('A what-if copy is open. Keep it or throw it away first.')
  })
})

describe('the words about what it left out', () => {
  it('says how many of theirs are not placed', () => {
    expect([notPlacedWords(0), notPlacedWords(1), notPlacedWords(3)]).toEqual([null, '1 of theirs is not placed. It stays out unless you pick a place.', '3 of theirs are not placed. They stay out unless you pick a place.'])
  })

  it('names our lines the file leaves out, trade by trade, and what runs into their final inspection', () => {
    expect(notInWords({ notIn: notNamed(), inspectionsNotIn: ['Rough-in inspection'], pastFinal: ['Lighting', 'Controls'] })).toEqual([
      'Electrical: Panels and feeders, Lighting and Low voltage rough.',
      'HVAC: Split systems and Controls.',
      'Plumbing: Top out.',
      'Millwork: Operatory cabinets and Break room.',
      "The first draft's rough-in inspection is not in it either. It is drawn after the work it waits on.",
      'Lighting and Controls run into their final inspection. Look at them before Start.',
    ])
    expect(notInWords({ notIn: [], inspectionsNotIn: [], pastFinal: ['Lighting'] })).toEqual(['Lighting runs into their final inspection. Look at it before Start.'])
  })

  it('says every sentence in plain words', () => {
    const s = initialGcState()
    const lines = [
      importHoldsWords({ format: 'project', title: null, rows: [row('a1'), row('d1', true)], waits: 1, unread: [] }),
      notPlacedWords(1) ?? '',
      notPlacedWords(3) ?? '',
      ...notInWords({ notIn: notNamed(), inspectionsNotIn: ['Rough-in inspection'], pastFinal: ['Lighting', 'Controls'] }),
      ...[job(s, 'boerne'), job(s, 'fairoaksd'), { ...job(s, 'helotes'), lostOn: '2026-09-30' }].map((p) => importRefusal(p) ?? ''),
    ]
    for (const l of lines) expect(plainWordsFailures(l)).toEqual([])
  })
})
