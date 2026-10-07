/**
 * The tests of `gcNotReady.test.ts` on branch spike/gc-mode that read only these kernels and the made-up data,
 * moved word for word (the Board's B2-ii). The data is `schedule/testState.ts`. The tests that play the
 * prototype's reducer or read another lane stay on the spike, where they run against these kernels.
 */
import { describe, expect, it } from 'vitest'
import type { GanttHold } from './gantt'
import type { NotReadyBlock } from './notReady'
import { NOT_READY_LATE_DAYS, notReadyBars, notReadyBlock, notReadyWords, uninsuredBlock, uninsuredNotes, withNotReady } from './notReady'
import { START_REMINDER_DAYS } from './startReminders'
import { initialGcState } from './testState'
import { walkItems } from './walk'
import type { GcState, Partner } from '../types'
import { plainWordsFailures } from '../../plainWords'

/** Fair Oaks Shops, Building D, being built; the made-up today is Fri Oct 2, and Pecan Valley's insurance ran out Sep 15. */
const fairOaks = (state: GcState) => state.projects.find((p) => p.id === 'fairoaksd')!

function withPartner(state: GcState, id: string, change: Partial<Partner>): GcState {
  return { ...state, partners: state.partners.map((p) => (p.id === id ? { ...p, ...change } : p)) }
}

/** The submittal hold the Schedule tab puts on Fire alarm (`holdsOf`). */
const fireAlarmSubmittal = (late = false) => new Map<string, GanttHold>([['felec-4', { kind: 'submittal', words: 'submittal 28 31 11-01', late }]])

/** Every sentence a block shows. */
function sentencesOf(block: NotReadyBlock | null): string[] {
  if (!block) return []
  return [block.title, ...block.lines.flatMap((l) => [l.line, l.promise, l.hint]), block.last].filter((s): s is string => Boolean(s))
}

describe('a trade not ready to start (G-77)', () => {
  it('holds only the bars that have not started, on a trade whose papers are not in', () => {
    const state = initialGcState()
    const project = fairOaks(state)
    // Pecan Valley is on site, so its Panels and feeders and its Lighting are under way, not waiting to start.
    expect(notReadyBars(state, project).map((b) => [b.lineId, b.start, b.late, notReadyWords(b.gaps)])).toEqual([
      ['felec-5', '2026-10-19', false, 'current insurance, theirs ran out Sep 15'],
      ['felec-4', '2026-11-02', false, 'current insurance, theirs ran out Sep 15'],
    ])
    // On the chart: Site lighting is held by its papers alone; Fire alarm keeps its submittal, after them.
    const holds = fireAlarmSubmittal()
    const out = withNotReady(holds, state, project)
    expect(out.get('felec-5')).toEqual({ kind: 'paperwork', words: 'current insurance, theirs ran out Sep 15', late: false })
    expect(out.get('felec-4')).toEqual({ kind: 'paperwork', words: 'current insurance and submittal 28 31 11-01', late: false })
    expect(out.size).toBe(2)
    expect(holds.size).toBe(1)
    // A renewed certificate takes them off, and the chart keeps the map it had.
    const renewed = withPartner(state, 'pecanvalley', { coiExpires: '2027-09-15' })
    expect(notReadyBars(renewed, fairOaks(renewed))).toEqual([])
    expect(withNotReady(holds, renewed, fairOaks(renewed))).toBe(holds)
  })

  it('reads insurance on the day each bar starts, once the renewal ask is due', () => {
    const base = initialGcState()
    // Runs out Sun Oct 25: after Site lighting starts Oct 19, before Fire alarm starts Nov 2.
    const oct25 = withPartner(base, 'pecanvalley', { coiExpires: '2026-10-25' })
    expect(notReadyBars(oct25, fairOaks(oct25)).map((b) => [b.lineId, notReadyWords(b.gaps)])).toEqual([['felec-4', 'current insurance, theirs runs out Oct 25']])
    expect(notReadyBlock(oct25, fairOaks(oct25), 'felec-4')?.lines.map((l) => l.line)).toEqual(['Insurance runs out Sun Oct 25, before this starts.'])
    // Cool Breeze has Rooftop units Oct 12, Controls Nov 2 and Test and balance Nov 30 still to start.
    // A certificate 30 days off is asked for now; 32 days off, the usual renewal has time.
    const hvac = (state: GcState) => notReadyBars(state, fairOaks(state)).filter((b) => b.pkg.id === 'fhvac').map((b) => b.lineId)
    expect(hvac(withPartner(base, 'coolbreeze', { coiExpires: '2026-11-01' }))).toEqual(['fhvac-3', 'fhvac-4'])
    expect(hvac(withPartner(base, 'coolbreeze', { coiExpires: '2026-11-03' }))).toEqual([])
    // None on file holds every bar of theirs not started.
    const none = withPartner(base, 'coolbreeze', { coiExpires: null })
    expect(notReadyBars(none, fairOaks(none)).filter((b) => b.pkg.id === 'fhvac').map((b) => [b.lineId, notReadyWords(b.gaps)])).toEqual([
      ['fhvac-1', 'insurance, none on file'],
      ['fhvac-3', 'insurance, none on file'],
      ['fhvac-4', 'insurance, none on file'],
    ])
    expect(notReadyBlock(none, fairOaks(none), 'fhvac-1')?.lines.map((l) => [l.line, l.verb])).toEqual([['Insurance: none on file.', 'Ask for it']])
  })

  it('turns late once the bar starts within three days, or its day passed with nothing reported', () => {
    expect(NOT_READY_LATE_DAYS).toBe(3)
    // The day the trade's last start reminder goes (G-114): its own number here, held equal.
    expect(NOT_READY_LATE_DAYS).toBe(START_REMINDER_DAYS[START_REMINDER_DAYS.length - 1])
    const on = (today: string) => {
      const state = { ...initialGcState(), today }
      return { state, bar: notReadyBars(state, fairOaks(state)).find((b) => b.lineId === 'felec-5') }
    }
    expect(on('2026-10-15').bar?.late).toBe(false)
    expect(on('2026-10-16').bar?.late).toBe(true)
    const startDay = on('2026-10-19')
    expect(notReadyBlock(startDay.state, fairOaks(startDay.state), 'felec-5')?.title).toBe('This starts today. Pecan Valley Electric is not ready.')
    const passed = on('2026-10-21')
    expect(passed.bar?.late).toBe(true)
    expect(notReadyBlock(passed.state, fairOaks(passed.state), 'felec-5')).toMatchObject({ title: 'This was to start Mon Oct 19. Pecan Valley Electric is not ready.', late: true })
    // A late hold already on the bar keeps it late.
    const state = initialGcState()
    expect(withNotReady(fireAlarmSubmittal(true), state, fairOaks(state)).get('felec-4')?.late).toBe(true)
  })

  it('reads on the weekly walk the way any hold does', () => {
    // Site lighting starts Mon Oct 19: on the walk from Mon Oct 12, a week out; late from Fri Oct 16.
    const facts = (today: string) => {
      const state = { ...initialGcState(), today }
      const project = fairOaks(state)
      return walkItems(state, project, withNotReady(new Map(), state, project)).find((i) => i.lineId === 'felec-5')
    }
    expect(facts('2026-10-12')).toMatchObject({ kind: 'held', chip: 'held' })
    expect(facts('2026-10-12')?.facts).toContain('It waits on current insurance, theirs ran out Sep 15.')
    expect(facts('2026-10-16')?.facts).toContain('It waits on current insurance, theirs ran out Sep 15, which is late.')
  })
})

describe('a trade at work with its insurance run out (G-138)', () => {
  it('says every sentence in plain words', () => {
    const state = initialGcState()
    const block = uninsuredBlock(state, fairOaks(state), 'felec-3')
    const sentences = [...[...uninsuredNotes(state, fairOaks(state)).values()].flatMap((n) => [n.note, n.words]), ...sentencesOf(block), 'No insurance on file. Nothing they do for us is covered.']
    expect(sentences.flatMap(plainWordsFailures)).toEqual([])
  })
})
