/**
 * The schedule's PR 5: the database says a refusal the way the screen does. Every sentence a kernel
 * says before a save, the migration's functions say word for word, so a press refused on either side
 * reads the same. Every sentence the functions say is plain words (src/lib/plainWords.ts).
 */
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { plainWordsFailures, plainWordsSentences } from '../../plainWords'
import { addedActivityProblem } from './addedActivity'
import { importRefusal } from './import'
import { MOVE_NOTE_MIN, MOVE_REASONS, moveWhyProblem, planMove } from './moves'
import { PLACE_MAX, placeProblem } from './places'
import { splitParts } from './splitBars'
import { initialGcState } from './testState'
import { theirDatesRefusal } from './theirDates'
import type { ScheduleMove } from './types'
import { SCHEDULE_CHANGED } from './versionRefusal'
import { keepWhatIf, whatIfCopy } from './whatIf'

const dir = join(process.cwd(), 'supabase', 'migrations')
const file = readdirSync(dir).find((f) => f.endsWith('_gc_schedule_writes.sql'))
const SQL = file ? readFileSync(join(dir, file), 'utf8') : ''
/** Each sentence the functions raise, as a person reads it: quotes undone, a day where the SQL puts one. */
const raised = [...SQL.matchAll(/RAISE EXCEPTION '((?:[^']|'')*)'/g)].map((m) => (m[1] ?? '').replace(/''/g, "'").replace(/%/g, 'Wed Nov 4'))
/** The SQL says it, as SQL spells it. */
const says = (sentence: string | null | undefined) => Boolean(sentence) && SQL.includes((sentence ?? '').replace(/'/g, "''"))

const s = initialGcState()
const fairOaks = s.projects.find((p) => p.id === 'fairoaksd')!
const schedule = fairOaks.schedule!
const bar = schedule.activities.find((a) => !a.inspection && !a.added)!
const tried: ScheduleMove = {
  id: 'move-1', on: s.today, by: 'Robert', lineId: bar.lineId, from: { start: bar.start, finish: bar.finish }, to: { start: bar.start, finish: bar.finish },
  reason: 'other', note: 'No reason yet. Keep asks for one.', pushed: [], finishFrom: bar.finish, finishTo: bar.finish, noWhy: true,
}
const { noWhy: _noWhy, ...stood } = tried
const copy = whatIfCopy(fairOaks, 'Robert', s.today)!

describe("the schedule's writes say a refusal the way the screen does", () => {
  it('finds the migration', () => {
    expect(file).toBeTruthy()
  })

  it('says why a move cannot save in moveWhyProblem’s and planMove’s words, with its numbers', () => {
    for (const w of [moveWhyProblem(null, ''), moveWhyProblem('crew', 'short'), planMove(fairOaks, bar.lineId, '', '')?.problem, planMove(fairOaks, bar.lineId, '2026-11-13', '2026-11-03')?.problem]) expect(says(w), w ?? '').toBe(true)
    expect(SQL.match(new RegExp(`\\) < ${MOVE_NOTE_MIN}\\b`, 'g'))?.length).toBe(2)
    const lists = [...SQL.matchAll(/NOT IN \(('weather'[^)]*)\)/g)].map((m) => (m[1] ?? '').split(',').map((x) => x.trim().replace(/'/g, '')).sort())
    expect(lists).toEqual([0, 1].map(() => MOVE_REASONS.map((r) => r.key).sort()))
  })

  it('words the job’s own work, a split and a place as their kernels do', () => {
    const one = (name: string, start = bar.start, finish = bar.finish) => ({ name, start, finish })
    const problem = (r: ReturnType<typeof splitParts>) => ('problem' in r ? r.problem : null)
    for (const w of [
      addedActivityProblem('', 'Our own crew', '2026-11-02', '2026-11-03'),
      addedActivityProblem('Mobilize', ' ', '2026-11-02', '2026-11-03'),
      problem(splitParts(bar, [one('Whole')], 0)),
      problem(splitParts(bar, [one(' '), one('B')], 0)),
      problem(splitParts(bar, [one('A'), one('a')], 0)),
      problem(splitParts(bar, [one('A', bar.finish, bar.start), one('B')], 0)),
      placeProblem('x'.repeat(PLACE_MAX + 1)),
    ]) expect(says(w), w ?? '').toBe(true)
    // Both parts start on the line's last day, so the first does not start with the line.
    const span = problem(splitParts(bar, [one('A', bar.finish), one('B', bar.finish)], 0)) ?? ''
    expect(span.endsWith('as the line does. Move a part after the split to change that.')).toBe(true)
    expect(says('as the line does. Move a part after the split to change that.')).toBe(true)
  })

  it('words a draw, a keep and their dates as importRefusal, keepWhatIf and theirDatesRefusal do', () => {
    const job = (id: string) => s.projects.find((p) => p.id === id)!
    const notStarted = { ...fairOaks, startedOn: null }
    const keep = (p: typeof fairOaks) => {
      const r = keepWhatIf(p, {}, 'Robert', s.today)
      return 'problem' in r ? r.problem : null
    }
    for (const w of [
      importRefusal(job('boerne')),
      importRefusal({ ...job('helotes'), lostOn: '2026-10-01' }),
      plainWordsSentences(importRefusal(fairOaks) ?? '')[1],
      importRefusal({ ...notStarted, schedule: { ...schedule, walks: [{ id: 'walk-1', on: s.today, by: 'Robert', kept: [bar.lineId], moveIds: [], skipped: 0 }] } }),
      importRefusal({ ...notStarted, schedule: { ...schedule, walks: [], baseline: null, moves: [stood] } }),
      keep({ ...fairOaks }),
      keep({ ...fairOaks, whatIf: copy }),
      keep({ ...fairOaks, whatIf: { ...copy, schedule: { ...copy.schedule, moves: [tried] } } }),
      theirDatesRefusal(job('helotes')),
      theirDatesRefusal({ ...fairOaks, whatIf: copy }),
    ]) expect(says(w), w ?? '').toBe(true)
  })

  it('refuses a stale press with the phrase and the DETAIL keys the reader reads', () => {
    expect(says(SCHEDULE_CHANGED)).toBe(true)
    for (const key of ['read', 'version', 'changes', 'at', 'by', 'name', 'words']) expect(SQL.includes(`'${key}', `), key).toBe(true)
  })

  it('says every refusal in plain words', () => {
    expect(raised.length).toBeGreaterThan(40)
    expect(raised.flatMap(plainWordsFailures)).toEqual([])
  })
})
