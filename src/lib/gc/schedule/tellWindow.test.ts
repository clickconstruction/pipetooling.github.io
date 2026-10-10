/**
 * The schedule's PR 13b (./tellWindow.ts) on Fair Oaks D: the roof moves, Summit Roofing's TPO membrane, pushing its
 * sheet metal and Cool Breeze Mechanical's rooftop units. Who is still to tell, company by company; a pull's finished
 * lines told to nobody; the lines a tell shows; the email's key; the kept line; and a told move undone.
 */
import { describe, expect, it } from 'vitest'
import { plainWordsFailures } from '../../plainWords'
import { addDays } from '../building'
import type { GcProject, GcState } from '../types'
import { moveRecord, planMove } from './moves'
import { initialGcState } from './testState'
import { companiesNotTold, datesEmailKey, keptNotToldWords, tellShown, toldThenUndone } from './tellWindow'
import type { ScheduleMove } from './types'

const job = (s: GcState) => s.projects.find((p) => p.id === 'fairoaksd')!
const NOTE = 'Rain stopped the roof for a week.'

/** A bar's days later, saved as a press saves it, newest first. */
function saved(project: GcProject, lineId: string, days: number, change: Partial<ScheduleMove> = {}): GcProject {
  const schedule = project.schedule!
  const a = schedule.activities.find((x) => x.lineId === lineId)!
  const plan = planMove(project, lineId, addDays(a.start, days), addDays(a.finish, days))!
  const move = { ...moveRecord(schedule, lineId, plan, { reason: 'weather', note: NOTE, by: 'Robert' }, '2026-10-02'), ...change }
  return { ...project, schedule: { ...schedule, activities: plan.activities, moves: [move, ...(schedule.moves ?? [])] } }
}
const withMove = (project: GcProject, change: Partial<ScheduleMove>, id = 'move-1'): GcProject => ({
  ...project,
  schedule: { ...project.schedule!, moves: project.schedule!.moves!.map((m) => (m.id === id ? { ...m, ...change } : m)) },
})
const moveOf = (p: GcProject, id = 'move-1') => p.schedule!.moves!.find((m) => m.id === id)!

describe('companiesNotTold: told by company, not by move (call 3)', () => {
  it('lists each company a standing move changed days for, until that company is told', () => {
    const s = initialGcState()
    const p = saved(job(s), 'froof-1', 30)
    expect(companiesNotTold(s, p).map((c) => [c.partner.company, c.moves.map((m) => m.id)])).toEqual([
      ['Summit Roofing', ['move-1']],
      ['Cool Breeze Mechanical', ['move-1']],
    ])
    // Summit told, Cool Breeze refused at the send: Cool Breeze stays, for that move alone.
    const summitTold = withMove(p, { toldOn: '2026-10-02', toldTo: ['summit'] })
    expect(companiesNotTold(s, summitTold).map((c) => c.partner.company)).toEqual(['Cool Breeze Mechanical'])
    expect(companiesNotTold(s, withMove(p, { toldOn: '2026-10-02', toldTo: ['summit', 'coolbreeze'] }))).toEqual([])
    expect(companiesNotTold(s, withMove(p, { undoneOn: '2026-10-03', undoneBy: 'Robert' }))).toEqual([])
  })

  it('tells a pull only to the companies whose dates came in', () => {
    const s = initialGcState()
    // Summit's two lines are the work that finished: only Cool Breeze's came in behind it.
    const p = saved(job(s), 'froof-1', 30, { pull: { finished: ['froof-1', 'froof-3'] } })
    expect(companiesNotTold(s, p).map((c) => c.partner.company)).toEqual(['Cool Breeze Mechanical'])
  })
})

describe('tellShown: the lines a tell shows one company', () => {
  it('is the company’s lines the move changed, with the dates its message gives', () => {
    const s = initialGcState()
    const p = saved(job(s), 'froof-1', 30)
    const shown = tellShown(s, p, moveOf(p), 'summit')
    expect(shown.map((l) => l.work)).toEqual(['TPO membrane', 'Sheet metal and flashing'])
    expect(shown[0]!.to.start).toBe(addDays(shown[0]!.from.start, 30))
    expect(tellShown(s, p, moveOf(p), 'lonestar')).toEqual([])
  })
})

describe('datesEmailKey (call 4)', () => {
  it('is the same for the same moves in any order, new for another set, and fits the sender’s 200', async () => {
    const a = await datesEmailKey(['m-2', 'm-1'])
    expect(a).toBe(await datesEmailKey(['m-1', 'm-2']))
    expect(a).not.toBe(await datesEmailKey(['m-1', 'm-2', 'm-3']))
    expect(a).toMatch(/^dates:[0-9a-f]{64}$/)
    expect(a.length).toBe(70)
  })
})

describe('keptNotToldWords: the kept line', () => {
  it('names the companies the kept moves have not told, until each is', () => {
    const s = initialGcState()
    const kept = saved(job(s), 'froof-1', 30, { fromWhatIf: '2026-10-01' })
    const line = keptNotToldWords(s, kept)!
    expect(line.words).toBe('1 move kept from the what-if. Summit Roofing and Cool Breeze Mechanical have not been told.')
    expect(plainWordsFailures(line.words)).toEqual([])
    expect(keptNotToldWords(s, withMove(kept, { toldOn: '2026-10-02', toldTo: ['summit'] }))!.words).toBe('1 move kept from the what-if. Cool Breeze Mechanical has not been told.')
    expect(keptNotToldWords(s, withMove(kept, { toldOn: '2026-10-02', toldTo: ['summit', 'coolbreeze'] }))).toBeNull()
    // A move made on the real schedule is the record's to tell, not the kept line's.
    expect(keptNotToldWords(s, saved(job(s), 'froof-1', 30))).toBeNull()
  })
})

describe('toldThenUndone: a told move undone (call 11)', () => {
  it('names the companies that still hold the moved dates, with who to call', () => {
    const s = initialGcState()
    const p = saved(job(s), 'froof-1', 30)
    expect(toldThenUndone(s, p)).toEqual([])
    expect(toldThenUndone(s, withMove(p, { undoneOn: '2026-10-03', undoneBy: 'Robert' }))).toEqual([])
    const undone = withMove(p, { toldOn: '2026-10-02', toldTo: ['summit'], undoneOn: '2026-10-03', undoneBy: 'Robert' })
    const [row] = toldThenUndone(s, undone)
    expect(row!.words).toBe('Told, then undone: Summit Roofing still has the moved dates. Call them.')
    expect(row!.calls.map((c) => c.first)).toEqual([s.partners.find((x) => x.id === 'summit')!.contact.split(' ')[0]])
    const both = withMove(p, { toldOn: '2026-10-02', toldTo: ['summit', 'coolbreeze'], undoneOn: '2026-10-03', undoneBy: 'Robert' })
    expect(toldThenUndone(s, both)[0]!.words).toBe('Told, then undone: Summit Roofing and Cool Breeze Mechanical still have the moved dates. Call them.')
    for (const w of [row!.words, toldThenUndone(s, both)[0]!.words]) expect(plainWordsFailures(w), w).toEqual([])
    // Told and standing: nothing to say here.
    expect(toldThenUndone(s, withMove(p, { toldOn: '2026-10-02', toldTo: ['summit'] }))).toEqual([])
  })
})
