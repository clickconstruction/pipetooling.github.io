/**
 * The tests of `gcRecovery.test.ts` on branch spike/gc-mode that read only these kernels and the made-up data,
 * moved word for word (the schedule's PR 1a, and PR 9c for the offers). The data is `testState.ts`. The tests that
 * play the prototype's reducer stay on the spike, where they run against these kernels.
 */
import { describe, expect, it } from 'vitest'
import { recoveryFollowPeople, recoveryNoneWords, recoveryOffers } from './recovery'
import { initialGcState } from './testState'
import type { ScheduleActivity, ScheduleWait } from './types'
import type { GcState } from '../types'

const ID = 'fairoaksd'

const job = (s: GcState) => s.projects.find((p) => p.id === ID)!

const offersOf = (s: GcState) => recoveryOffers(s, job(s))

const activity = (s: GcState, lineId: string) => job(s).schedule!.activities.find((a) => a.lineId === lineId)!

/**
 * Three trades in a chain on Fair Oaks D, nothing else on the schedule: Sheet metal and flashing
 * (Summit Roofing, Mon Nov 30 to Sun Dec 6), then Controls (Cool Breeze Mechanical, Dec 7 to 13),
 * then Trim (our own crew, Dec 14 to 18). The contract says Dec 11: 7 days past.
 */
function chain(more: { controls?: Partial<ScheduleActivity>; ahead?: ScheduleActivity; trim?: Partial<ScheduleActivity>; waits?: ScheduleWait[] } = {}): GcState {
  const s = initialGcState()
  const keep = new Map(job(s).schedule!.activities.map((a) => [a.lineId, a]))
  const line = (id: string, start: string, finish: string, after: string[], extra: Partial<ScheduleActivity> = {}): ScheduleActivity => {
    const { lag: _lag, ...base } = keep.get(id) as ScheduleActivity
    return { ...base, lineId: id, start, finish, after, ...extra }
  }
  const ahead = more.ahead ?? line('froof-3', '2026-11-30', '2026-12-06', [])
  const activities = [ahead, line('fhvac-3', '2026-12-07', '2026-12-13', [ahead.lineId], more.controls ?? {}), line('fplumb-4', '2026-12-14', '2026-12-18', ['fhvac-3'], more.trim ?? {})]
  return {
    ...s,
    projects: s.projects.map((p) => (p.id === ID && p.schedule ? { ...p, schedule: { ...p.schedule, activities, moves: [], walks: [], baseline: null }, waits: more.waits ?? [], submittals: [], rfis: [] } : p)),
  }
}

describe('how to get days back (G-82)', () => {
  it('offers nothing on the fixture: every job is on time or not being built', () => {
    const s = initialGcState()
    for (const p of s.projects) expect(recoveryOffers(s, p)).toEqual([])
  })

  it('a chain of three trades: side by side and a second crew, the most days back first', () => {
    const offers = offersOf(chain())
    expect(offers.map((o) => [o.key, o.daysBack])).toEqual([
      ['side:fplumb-4:fhvac-3', 3],
      ['side:fhvac-3:froof-3', 3],
      ['crew:fhvac-3', 2],
      ['crew:froof-3', 2],
      ['crew:fplumb-4', 1],
    ])
    const side = offers.find((o) => o.key === 'side:fhvac-3:froof-3')!
    expect([side.gapWas, side.gap, side.to]).toEqual([0, -3, { start: '2026-12-04', finish: '2026-12-10' }])
    expect(side.pulls.map((p) => [p.lineId, p.to])).toEqual([['fplumb-4', { start: '2026-12-11', finish: '2026-12-15' }]])
    expect(side.words.title).toBe('Controls starts 3 days before Sheet metal and flashing finishes.')
    expect(side.words.who).toBe('Cool Breeze Mechanical and Summit Roofing have to agree: Andre Wallace and Carla Nguyen.')
    expect(side.words.worth).toBe('3 days back brings the finish to Tue Dec 15, still 4 days past the contract.')
    // Our own crew is our call: nobody to ask.
    expect(offers.find((o) => o.key === 'crew:fplumb-4')?.words.who).toBe('It is our own crew: our call.')
  })
})

describe('side by side: what the kernel reads on the wait', () => {
  const sideKeys = (s: GcState) => offersOf(s).filter((o) => o.how === 'side').map((o) => o.key)

  it('two trades: one trade’s own lines in a row are not offered', () => {
    const s = initialGcState()
    const rtu = { ...activity(s, 'fhvac-1'), start: '2026-11-30', finish: '2026-12-06', after: [] }
    expect(sideKeys(chain({ ahead: rtu, controls: { after: ['fhvac-1'] } }))).not.toContain('side:fhvac-3:fhvac-1')
  })

  it('never beside an inspection or the job’s own bar', () => {
    const insp: ScheduleActivity = { lineId: 'fairoaksd-insp-x', packageId: '', start: '2026-11-30', finish: '2026-12-06', after: [], inspection: { label: 'Cover inspection' } }
    const own: ScheduleActivity = { lineId: 'fairoaksd-own-9', packageId: '', start: '2026-11-30', finish: '2026-12-06', after: [], added: { label: 'Cure time', who: 'Cure time', doneOn: null } }
    expect(sideKeys(chain({ ahead: insp, controls: { after: [insp.lineId] } })).filter((k) => k.startsWith('side:fhvac-3'))).toEqual([])
    expect(sideKeys(chain({ ahead: own, controls: { after: [own.lineId] } })).filter((k) => k.startsWith('side:fhvac-3'))).toEqual([])
  })

  it('a gap already on the wait is cure or lead time, and stays', () => {
    expect(sideKeys(chain({ controls: { lag: { 'froof-3': 2 }, start: '2026-12-09', finish: '2026-12-15' }, trim: { start: '2026-12-16', finish: '2026-12-20' } }))).not.toContain('side:fhvac-3:froof-3')
  })

  it('nothing may hold it: a late delivery on Controls takes both its offers', () => {
    const delivery: ScheduleWait = { id: 'fairoaksd-wait-9', kind: 'delivery', title: 'Control panels', packageId: 'fhvac', who: "Cool Breeze Mechanical's supplier", lineIds: ['fhvac-3'], askedOn: '2026-09-20', expectedOn: '2026-12-08', shippedOn: null, doneOn: null }
    const keys = offersOf(chain({ waits: [delivery] })).map((o) => o.key)
    expect(keys).not.toContain('side:fhvac-3:froof-3')
    expect(keys).not.toContain('crew:fhvac-3')
  })

  it('not started: a bar under way does not move to start beside the one ahead', () => {
    expect(sideKeys(chain({ controls: { actualStart: '2026-10-01' } }))).not.toContain('side:fhvac-3:froof-3')
  })

  it('a second crew needs 3 days left', () => {
    expect(offersOf(chain({ trim: { finish: '2026-12-15' } })).map((o) => o.key)).not.toContain('crew:fplumb-4')
  })

  it('the work behind keeps G-37’s rules: held, it cannot come in, so nothing ahead of it is worth a day', () => {
    const tile: ScheduleWait = { id: 'fairoaksd-wait-9', kind: 'decision', title: 'the restroom tile', packageId: 'fplumb', who: 'Cibolo Creek Partners', lineIds: ['fplumb-4'], askedOn: '2026-09-20', expectedOn: '2026-12-20', shippedOn: null, doneOn: null }
    expect(offersOf(chain({ waits: [tile] })).map((o) => o.key)).toEqual([])
  })

  it('when the work’s pace sets the finish, the plan alone gives nothing back, and says so', () => {
    const s = structuredClone(initialGcState())
    const ms = job(s).schedule!.milestones.find((x) => /substantial completion/i.test(x.label))!
    ms.planned = '2026-12-08'
    expect(offersOf(s)).toEqual([])
    expect(recoveryNoneWords(s, job(s))).toBe("The work's pace sets the finish, not the plan.")
  })
})

describe('the gap below zero (the lead’s condition)', () => {
  it('every gap in the made-up data is still zero or more', () => {
    for (const p of initialGcState().projects) for (const a of p.schedule?.activities ?? []) for (const d of Object.values(a.lag ?? {})) expect(d).toBeGreaterThanOrEqual(0)
  })
})

describe('who has to agree (pick 2)', () => {
  it('the Follow up sheet walks each company on the offer, one item each, in its language', () => {
    const s = chain()
    const people = recoveryFollowPeople(s, job(s), 'side:fhvac-3:froof-3')
    expect(people.map((p) => p.partner.company)).toEqual(['Cool Breeze Mechanical', 'Summit Roofing'])
    expect(people.map((p) => p.items.map((i) => `${i.kind} ${i.label}: ${i.why}`))).toEqual([
      ['schedule Days back · Fair Oaks Shops, Building D: Controls starts 3 days before Sheet metal and flashing finishes.'],
      ['schedule Days back · Fair Oaks Shops, Building D: Controls starts 3 days before Sheet metal and flashing finishes.'],
    ])
    expect(people[1]?.items[0]?.words.en.ask).toBe('Could your crews share the space for those days?')
    for (const p of people) for (const lang of ['en', 'es'] as const) expect(Object.values(p.items[0]!.words[lang]).every((w) => w.length > 0)).toBe(true)
    // Our own crew's offer has nobody to call.
    expect(recoveryFollowPeople(s, job(s), 'crew:fplumb-4')).toEqual([])
  })
})
