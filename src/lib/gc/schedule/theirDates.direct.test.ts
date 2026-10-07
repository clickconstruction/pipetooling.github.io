/**
 * Main's own tests for their dates to meet, onto a running job (G-145; the schedule's PR 1b): when
 * they are refused, each beside ours with the difference and its note, what taking them writes, and
 * the log's line, run through the kernels on the test data. The spike's own cases: Cibolo Creek
 * Partners' master schedule for Fair Oaks D, today Fri Oct 2. Its dates are the ones G-137's reader
 * finds in the spike's sample file, given here as the reading: Notice to proceed passed, Slab poured
 * ours met, Dry-in 7 days later, the rough-in inspection 3 days later, substantial completion 7 days
 * earlier, and a new Grand opening.
 */
import { describe, expect, it } from 'vitest'
import { plainWordsFailures } from '../../plainWords'
import type { GcState } from '../types'
import type { ImportFileRow, ScheduleFileReading } from './import'
import { initialGcState } from './testState'
import type { TheirDate } from './theirDates'
import { differenceWords, rowNotes, theirDates, theirDatesLogWords, theirDatesRefusal, withTheirDates } from './theirDates'
import { whatIfCopy } from './whatIf'

const ID = 'fairoaksd'
const job = (s: GcState, id = ID) => s.projects.find((p) => p.id === id)!
const FROM = 'Cibolo Creek Partners'
const FILE = 'cibolo-master.xml'

const row = (key: string, name: string, start: string, finish: string, date: boolean): ImportFileRow => ({ key, name, groups: [], start, finish, date, after: [], notBefore: null, mustFinishBy: null, kind: null, trade: null, company: null, underADay: false })
/** Their file as G-137's reader reads it: their six dates, and nine activities passed over. */
const READING: ScheduleFileReading = {
  format: 'project',
  title: 'Fair Oaks Shops, Building D',
  rows: [
    row('1', 'Notice to proceed', '2026-07-01', '2026-07-01', true),
    ...Array.from({ length: 9 }, (_, i) => row(`a${i}`, `Their activity ${i + 1}`, '2026-07-06', '2026-07-10', false)),
    row('2', 'Slab poured', '2026-08-28', '2026-08-28', true),
    row('3', 'Dry-in', '2026-10-02', '2026-10-02', true),
    row('4', 'Rough-in inspection', '2026-10-16', '2026-10-16', true),
    row('5', 'Substantial completion', '2026-12-04', '2026-12-04', true),
    row('6', 'Grand opening', '2027-01-15', '2027-01-15', true),
  ],
  waits: 0,
  unread: [],
}
/** What the window sends untouched: every row that starts ticked, to the one of ours it starts on. */
const startTicked = (s: GcState): TheirDate[] =>
  theirDates(s, job(s), READING)
    .rows.filter((r) => r.ticked)
    .map((r) => ({ name: r.name, on: r.on, ours: r.ours }))

describe('their dates beside ours', () => {
  it('comes in on a job being built with no what-if copy open', () => {
    const s = initialGcState()
    expect(theirDatesRefusal(job(s))).toBeNull()
    expect(theirDatesRefusal(job(s, 'helotes'))).toBe('Their dates come in on a job being built.')
    expect(theirDatesRefusal({ ...job(s), lostOn: '2026-09-30' })).toBe('Their dates come in on a job being built.')
    expect(theirDatesRefusal({ ...job(s), whatIf: whatIfCopy(job(s), 'Robert', s.today)! })).toBe('A what-if copy is open. Keep it or throw it away first.')
  })

  it('sets each beside ours by name, with the difference, what starts ticked and its note', () => {
    const s = initialGcState()
    const t = theirDates(s, job(s), READING)
    expect(t.activities).toBe(9)
    const ours = new Map(t.ours.map((r) => [r.milestone.id, r]))
    expect(t.rows.map((r) => [r.name, r.ours, r.metOurs?.milestone.id ?? null, differenceWords(r.on, r.ours ? (ours.get(r.ours) ?? null) : null), r.ticked, rowNotes(s, job(s), r, r.ours ? (ours.get(r.ours) ?? null) : null)])).toEqual([
      ['Notice to proceed', null, null, 'a new date', false, ['That day has passed.']],
      ['Slab poured', null, 'fo-slab', 'a new date', false, ['Ours was met Thu Aug 27, so it stays.']],
      ['Dry-in', 'fo-dryin', null, '7 days later', true, []],
      ['Rough-in inspection', 'fo-roughin', null, '3 days later', true, []],
      ['Substantial completion', 'fo-substantial', null, '7 days earlier', false, ["This is the contract's finish. With theirs, the projected finish, Fri Dec 11, is 7 days past the contract."]],
      ['Grand opening', null, null, 'a new date', true, []],
    ])
    // The same day as ours reads so.
    const dryIn = ours.get('fo-dryin')!
    expect(differenceWords(dryIn.due, dryIn)).toBe('the same day')
  })
})

describe('taking them', () => {
  it('writes only the dates to meet, a new one as the job’s own, and names the file in the log', () => {
    const s = initialGcState()
    const milestones = withTheirDates(job(s), startTicked(s))
    expect(milestones?.map((m) => [m.id, m.label, m.planned, m.packageId, m.metOn])).toEqual([
      ['fo-slab', 'Slab poured', '2026-08-28', 'fconc', '2026-08-27'],
      ['fo-dryin', 'Dry-in', '2026-10-02', 'froof', null],
      ['fo-roughin', 'Rough-in inspection', '2026-10-16', null, null],
      ['fo-substantial', 'Substantial completion', '2026-12-11', null, null],
      ['fairoaksd-ms-5-grand-opening', 'Grand opening', '2027-01-15', null, null],
    ])
    expect(theirDatesLogWords(job(s), FROM, FILE, startTicked(s))).toBe("Took 3 of Cibolo Creek Partners' dates to meet from cibolo-master.xml on Fair Oaks Shops, Building D.")
    expect(theirDatesLogWords(job(s), FROM, FILE, [{ name: 'Dry-in', on: '2026-10-02', ours: 'fo-dryin' }])).toBe("Took Cibolo Creek Partners' date for Dry-in from cibolo-master.xml on Fair Oaks Shops, Building D.")
  })

  it('takes nothing on one of ours met or unknown, a day it cannot read, no name, two onto one of ours, or no schedule', () => {
    const s = initialGcState()
    const refused: TheirDate[][] = [
      [{ name: 'Slab poured', on: '2026-08-28', ours: 'fo-slab' }],
      [{ name: 'Dry-in', on: '2026-10-02', ours: 'nope' }],
      [{ name: 'Dry-in', on: 'Oct 2', ours: 'fo-dryin' }],
      [{ name: ' ', on: '2027-01-15', ours: null }],
      [
        { name: 'Dry-in', on: '2026-10-02', ours: 'fo-dryin' },
        { name: 'Dry-in again', on: '2026-10-09', ours: 'fo-dryin' },
      ],
    ]
    for (const dates of refused) expect(withTheirDates(job(s), dates)).toBeNull()
    expect(withTheirDates(job(s, 'helotes'), startTicked(s))).toBeNull()
  })

  it('says every sentence in plain words', () => {
    const s = initialGcState()
    const t = theirDates(s, job(s), READING)
    const ours = new Map(t.ours.map((r) => [r.milestone.id, r]))
    const sentences = [
      ...t.rows.flatMap((r) => rowNotes(s, job(s), r, r.ours ? (ours.get(r.ours) ?? null) : null)),
      theirDatesLogWords(job(s), FROM, FILE, startTicked(s)),
      theirDatesLogWords(job(s), FROM, FILE, [{ name: 'Dry-in', on: '2026-10-02', ours: 'fo-dryin' }]),
      theirDatesRefusal(job(s, 'helotes')) ?? '',
    ]
    expect(sentences.flatMap(plainWordsFailures)).toEqual([])
  })
})
