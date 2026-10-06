import { describe, expect, it } from 'vitest'
import { initialGcState } from './gcFixture'
import { gcReducer } from './gcReducer'
import { plainWordsFailures } from '../plainWords'
import { chartHolds } from './gcChartHolds'
import type { GanttHold } from './gcGantt'
import type { GcState } from './gcTypes'
import { morningList, morningSteps, type MorningList } from './gcMorningList'

/** Fair Oaks Shops, Building D, being built; the made-up today is Fri Oct 2, and its last log Thu Oct 1. */
const fairOaks = (state: GcState) => state.projects.find((p) => p.id === 'fairoaksd')!
const listOf = (state: GcState, day?: string, holds?: Map<string, GanttHold>) => morningList(state, fairOaks(state), holds ?? chartHolds(state, fairOaks(state)), day)

/** The list as the card reads it: each company's line and its bars. */
function read(list: MorningList) {
  return list.expected.map((c) => ({
    company: `${c.company} · ${c.pkg.trade}`,
    call: c.call ? `${c.call.first} ${c.call.phone}` : null,
    log: c.logWords,
    missing: c.missing,
    bars: c.bars.map((b) => [b.name, b.dayWords, b.pct, b.flags.map((f) => f.words).join(', ')]),
  }))
}

describe('the superintendent’s morning list (G-118)', () => {
  it('reads the chart for today on Fair Oaks D: who, doing what, and the log’s last count', () => {
    const list = listOf(initialGcState())
    expect(list.summary).toBe('5 companies on 6 activities, and an inspection.')
    expect(read(list)).toEqual([
      { company: 'Iron Horse Fabrication · Structural steel', call: 'Luz (210) 555-0104', log: 'Last on the log Thu Oct 1 with 3.', missing: false, bars: [['Erection', 'last day', 80, 'due today']] },
      {
        company: 'Pecan Valley Electric · Electrical',
        call: 'Marcus (210) 555-0171',
        log: 'Last on the log Thu Oct 1 with 2.',
        missing: false,
        bars: [
          ['Panels and feeders', 'last day', 80, 'due today'],
          ['Lighting', 'day 19 of 40', 40, 'behind'],
        ],
      },
      { company: 'Summit Roofing · Roofing', call: 'Carla (210) 555-0150', log: 'Last on the log Thu Oct 1 with 4.', missing: false, bars: [['TPO membrane', 'day 12 of 19', 50, 'behind']] },
      { company: 'Our own crew · Plumbing', call: null, log: 'Last on the log Thu Oct 1 with 3.', missing: false, bars: [['Top out', 'day 5 of 12', 40, '']] },
      { company: 'Cool Breeze Mechanical · HVAC', call: 'Andre (210) 555-0127', log: 'Last on the log Thu Oct 1 with 3.', missing: false, bars: [['Ductwork', 'day 19 of 26', 80, 'ahead']] },
    ])
    expect(list.inspections.map((i) => i.words)).toEqual([
      "Electrical service inspection, the city. It is seen again today. It failed Mon Sep 28: The main bonding jumper is missing at the service panel. That was Pecan Valley Electric's work.",
    ])
    expect(list.arriving).toEqual([])
    expect(list.heldOff).toEqual([])
    expect(list.logWritten).toBe(false)
    expect(list.foot).toBe("No log for today yet. Each company's count comes in when it is written.")
  })

  it('reads yesterday against yesterday’s log, without today’s pills', () => {
    const list = listOf(initialGcState(), '2026-10-01')
    expect(list.logWritten).toBe(true)
    expect(list.foot).toBeNull()
    expect(list.inspections).toEqual([])
    expect(read(list).map((c) => [c.company, c.log, c.bars.map((b) => `${b[0]}, ${b[1]}${b[3] ? `, ${b[3]}` : ''}`)])).toEqual([
      ['Iron Horse Fabrication · Structural steel', 'On the log for Thu Oct 1 with 3.', ['Erection, day 25 of 26']],
      ['Pecan Valley Electric · Electrical', 'On the log for Thu Oct 1 with 2.', ['Panels and feeders, day 18 of 19', 'Lighting, day 18 of 40']],
      ['Summit Roofing · Roofing', 'On the log for Thu Oct 1 with 4.', ['TPO membrane, day 11 of 19']],
      ['Our own crew · Plumbing', 'On the log for Thu Oct 1 with 3.', ['Top out, day 4 of 12']],
      ['Cool Breeze Mechanical · HVAC', 'On the log for Thu Oct 1 with 3.', ['Ductwork, day 18 of 26']],
    ])
  })

  it('puts a company the day’s log does not have first, to call', () => {
    const base = initialGcState()
    const state: GcState = {
      ...base,
      projects: base.projects.map((p) => (p.id !== 'fairoaksd' ? p : { ...p, dailyLogs: (p.dailyLogs ?? []).map((l) => (l.date === '2026-10-01' ? { ...l, crews: l.crews.filter((c) => c.packageId !== 'froof') } : l)) })),
    }
    const [first, second] = listOf(state, '2026-10-01').expected
    expect(first).toMatchObject({ company: 'Summit Roofing', missing: true, logWords: 'Not on the log for Thu Oct 1. Last on it Tue Sep 29 with 5.', onTheDay: 0, lastOnLog: { on: '2026-09-29', workers: 5 } })
    expect(second).toMatchObject({ company: 'Iron Horse Fabrication', missing: false })
  })

  it('does not expect a company whose work that day is all held, and says why', () => {
    // Summit's only work today is TPO membrane: held, it is not expected. Held, the chart's pill is the hold.
    const state = initialGcState()
    const held = listOf(state, undefined, new Map<string, GanttHold>([['froof-1', { kind: 'submittal', words: 'submittal 07 54 23-01', late: false }]]))
    expect(held.expected.map((c) => c.company)).not.toContain('Summit Roofing')
    expect(held.heldOff.map((c) => [c.company, c.bars.map((b) => `${b.name}: ${b.flags.map((f) => f.words).join(', ')}`)])).toEqual([['Summit Roofing', ['TPO membrane: waits on submittal 07 54 23-01']]])
    expect(held.summary).toBe('4 companies on 5 activities, and an inspection.')
    // G-77's papers read the same way: Pecan Valley's Fire alarm starts Mon Nov 2 with its insurance run out.
    // Its Lighting still runs, so Pecan Valley is expected, with Fire alarm held under it.
    const nov2 = { ...state, today: '2026-11-02' }
    const pecan = listOf(nov2).expected.find((c) => c.company === 'Pecan Valley Electric')
    expect(pecan?.bars.find((b) => b.name === 'Fire alarm')).toMatchObject({ dayWords: 'first day', held: true, flags: [{ words: 'waits on current insurance and submittal 28 31 11-01, late', tone: 'red' }] })
  })

  it('carries a trade’s own word that a bar will be late (G-117)', () => {
    const state = gcReducer(initialGcState(), { type: 'tradeSayLate', projectId: 'fairoaksd', partnerId: 'pecanvalley', lineId: 'felec-3', day: '2026-10-28', reason: 'materials', note: 'The fixtures came in short.' })
    const lighting = listOf(state).expected.find((c) => c.company === 'Pecan Valley Electric')?.bars.find((b) => b.name === 'Lighting')
    expect(lighting?.flags.map((f) => f.words)).toEqual(['behind', 'says it will finish Wed Oct 28'])
  })

  it('names what arrives that day, from the waits', () => {
    const oct15 = listOf({ ...initialGcState(), today: '2026-10-15' })
    expect(oct15.arriving).toEqual(['The transformer, from CPS Energy.'])
    // A decision the customer owes is office work: never on the list.
    const oct30 = listOf({ ...initialGcState(), today: '2026-10-30' })
    expect(oct30.arriving).toEqual([])
  })

  it('says so before work started, or on a job not being built', () => {
    const state = initialGcState()
    expect(listOf(state, '2026-06-30')).toMatchObject({ expected: [], summary: 'Work started Wed Jul 1.' })
    const helotes = state.projects.find((p) => p.id === 'helotes')!
    expect(morningList(state, helotes, new Map())).toMatchObject({ expected: [], summary: 'The list starts once work starts.' })
  })

  it('says at the gate when a company’s insurance ran out (G-138)', () => {
    const list = listOf(initialGcState())
    expect(list.expected.map((c) => [c.company, c.insurance])).toEqual([
      ['Iron Horse Fabrication', null],
      ['Pecan Valley Electric', 'Their insurance ran out Tue Sep 15. Nothing they do for us is covered.'],
      ['Summit Roofing', null],
      ['Our own crew', null],
      ['Cool Breeze Mechanical', null],
    ])
    // Read on the list's own day: before it ran out, nothing.
    expect(listOf(initialGcState(), '2026-09-14').expected.find((c) => c.company === 'Pecan Valley Electric')?.insurance).toBeNull()
  })

  it('steps a day at a time, from the day work started to today', () => {
    const project = fairOaks(initialGcState())
    expect(morningSteps(project, '2026-10-02', '2026-10-02')).toEqual({ before: '2026-10-01', after: null })
    expect(morningSteps(project, '2026-09-28', '2026-10-02')).toEqual({ before: '2026-09-27', after: '2026-09-29' })
    expect(morningSteps(project, '2026-07-01', '2026-10-02')).toEqual({ before: null, after: '2026-07-02' })
  })

  it('says every sentence in plain words', () => {
    const base = initialGcState()
    const lists = [listOf(base), listOf(base, '2026-10-01'), listOf({ ...base, today: '2026-10-15' }), listOf(base, '2026-09-30')]
    const sentences = lists.flatMap((l) => [l.summary, ...(l.foot ? [l.foot] : []), ...l.expected.map((c) => c.logWords), ...l.inspections.map((i) => i.words), ...l.arriving])
    expect(sentences.length).toBeGreaterThan(15)
    expect(sentences.flatMap(plainWordsFailures)).toEqual([])
  })
})
