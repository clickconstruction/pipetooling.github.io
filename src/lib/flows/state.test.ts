import { describe, expect, it } from 'vitest'
import { FLOW_PAPERS } from './facts'
import { SEED_FLOWS } from './seed'
import type { FlowReading, StepReading } from './state'
import {
  factRead,
  flat,
  flowMoves,
  laneOf,
  lapsedWhy,
  moveWords,
  paperRead,
  perJobJobs,
  placesOf,
  quietDays,
  stampDay,
  stepById,
  stepDay,
  stepReading,
  stepTrue,
} from './state'

// The prototype's clock: Fri Oct 2 2026, 11:45 AM in Chicago.
const NOW = new Date('2026-10-02T16:45:00Z')

describe('flows/seed', () => {
  it('keeps the prototype’s step ids, unique within each flow', () => {
    expect(flat(SEED_FLOWS.trade).map((s) => s.id)).toEqual(['invited', 'portal', 'papers', 'msa', 'ask', 'compare', 'sow', 'draws', 'closeout'])
    expect(flat(SEED_FLOWS.customer).map((s) => s.id)).toEqual(['agreement', 'asked', 'bid', 'yes', 'contract', 'start', 'onsite', 'payapp', 'close', 'warranty', 'co'])
    expect(flat(SEED_FLOWS.arch).map((s) => s.id)).toEqual(['plans', 'questions', 'addenda', 'submittals', 'certify'])
    expect(flat(SEED_FLOWS.unknown).map((s) => s.id)).toEqual(['who'])
  })

  it('holds only the master agreement in the customer’s Once lane, skipped on one job', () => {
    const once = SEED_FLOWS.customer.lanes.find((l) => l.lane === 'once')
    expect(once?.steps.map((s) => s.id)).toEqual(['agreement'])
    expect(once?.steps[0]?.skipOneJob).toBe(true)
    expect(flat(SEED_FLOWS.customer).filter((s) => s.skipOneJob).map((s) => s.id)).toEqual(['agreement'])
  })

  it('draws change orders apart, the only aside step', () => {
    const asides = Object.values(SEED_FLOWS).flatMap((f) => flat(f).filter((s) => s.aside).map((s) => `${f.kind}.${s.id}`))
    expect(asides).toEqual(['customer.co'])
    expect(laneOf(SEED_FLOWS.customer, 'co')).toBe('per_job')
  })

  it('gives every loop a way to end, and no step that runs once one', () => {
    for (const flow of Object.values(SEED_FLOWS)) {
      for (const s of flat(flow)) expect(s.loop == null).toBe(s.loopEnds == null)
    }
    expect(stepById(SEED_FLOWS.trade, 'ask')?.loopEnds).toBe('rounds')
    expect(stepById(SEED_FLOWS.trade, 'draws')?.loopEnds).toBe('next')
    expect(stepById(SEED_FLOWS.customer, 'payapp')?.loopEnds).toBe('next')
  })

  it('makes every fork an or with a way out that ends the lane', () => {
    const forks = Object.values(SEED_FLOWS).flatMap((f) => flat(f).filter((s) => s.fork).map((s) => ({ ...s, kind: f.kind })))
    expect(forks.map((s) => `${s.kind}.${s.id}`)).toEqual(['trade.compare', 'customer.yes', 'sub.kept', 'sub.yes', 'candidate.decided'])
    for (const s of forks) expect(s.join).toBe('or')
  })

  it('seats every our-move step and seeds the phases the boards tile by', () => {
    for (const flow of Object.values(SEED_FLOWS)) for (const s of flat(flow)) if (s.who === 'us') expect(s.seat).toBeTruthy()
    const phases = (k: keyof typeof SEED_FLOWS) => flat(SEED_FLOWS[k]).map((s) => s.phase)
    expect(phases('trade')).toEqual(['setup', 'setup', 'setup', 'setup', 'pricing', 'pricing', 'building', 'building', 'building'])
    expect(phases('customer')).toEqual(['setup', 'pricing', 'pricing', 'pricing', 'pricing', 'building', 'building', 'building', 'building', 'building', 'building'])
    expect(new Set(phases('arch'))).toEqual(new Set(['building']))
  })
})

describe('flows/state: the small reads', () => {
  it('reads a stamp’s day in Chicago', () => {
    expect(stampDay('2026-09-30')).toBe('2026-09-30')
    // 11 PM Central on Sep 30 is Oct 1 in UTC; the day is still Sep 30.
    expect(stampDay('2026-10-01T04:00:00Z')).toBe('2026-09-30')
    expect(stampDay(null)).toBeNull()
  })

  it('reads a fact with no stamp as not yet, and an expired paper as bad', () => {
    expect(factRead([], 'w9_signed').mark).toBe('no')
    const coi = factRead([{ fact: 'coi_current', mark: 'bad', at: '2026-09-30', by: null, until: '2026-09-30' }], 'coi_current')
    expect(coi.mark).toBe('bad')
    expect(coi.fact.paper).toBe('coi')
    expect(coi.until).toBe('2026-09-30')
  })

  it('finishes a step on every fact, either on a fork, and never with none', () => {
    const ok = { mark: 'ok' as const }
    const no = { mark: 'no' as const }
    expect(stepTrue({ join: 'and' }, [ok, no])).toBe(false)
    expect(stepTrue({ join: 'and' }, [ok, ok])).toBe(true)
    expect(stepTrue({ join: 'or' }, [no, ok])).toBe(true)
    expect(stepTrue({ join: 'and' }, [])).toBe(false)
  })

  it('reads a due day as late, today, a weekday this week, or a date past it', () => {
    // Greg promised Boerne's quote for Wed Sep 30.
    expect(stepDay('2026-09-30', NOW)).toEqual({ due: '2026-09-30', lateDays: 2, late: true, words: 'late 2 days' })
    expect(stepDay('2026-10-01', NOW)?.words).toBe('late 1 day')
    expect(stepDay('2026-10-02', NOW)).toEqual({ due: '2026-10-02', lateDays: 0, late: false, words: 'due today' })
    // Questions close Mon Oct 5 noon: a timestamp reads as its Chicago day.
    expect(stepDay('2026-10-05T17:00:00Z', NOW)?.words).toBe('due Mon')
    // Pad B's bid, Oct 22.
    expect(stepDay('2026-10-22', NOW)).toMatchObject({ lateDays: -20, late: false, words: 'due Oct 22' })
    expect(stepDay(null, NOW)).toBeNull()
  })

  it('counts quiet days from their last word only, never ours or a team note', () => {
    expect(
      quietDays(
        [
          { direction: 'in', at: '2026-09-28T15:00:00Z' },
          { direction: 'out', at: '2026-10-01T15:00:00Z' },
          { direction: 'team', at: '2026-10-02T14:00:00Z' },
        ],
        NOW,
      ),
    ).toBe(4)
    expect(quietDays([{ direction: 'out', at: '2026-10-01T15:00:00Z' }], NOW)).toBeNull()
  })

  it('says why a step lapsed with the paper’s short word', () => {
    const short = (p: keyof typeof FLOW_PAPERS) => FLOW_PAPERS[p].short
    expect(lapsedWhy({ state: 'lapsed', lapsedPaper: 'coi' }, short)).toBe('lapsed · insurance expired')
    expect(lapsedWhy({ state: 'lapsed', lapsedPaper: null })).toBe('lapsed')
    expect(lapsedWhy({ state: 'done', lapsedPaper: null })).toBeNull()
  })

})

describe('flows/state: reads over a reading', () => {
  const coi = factRead([{ fact: 'coi_current', mark: 'bad', at: '2026-09-30', by: null, until: '2026-09-30' }], 'coi_current')
  const w9 = factRead([{ fact: 'w9_signed', mark: 'ok', at: '2026-09-12', by: null, until: null }], 'w9_signed')
  const base = { isTrue: false, facts: [], rounds: [], day: null, skip: null, since: null, due: null, lateDays: null, waitingOn: null, lapsedPaper: null }
  const s = (stepId: string, state: StepReading['state'], lane: StepReading['lane'], jobId: string | null, more: Partial<StepReading> = {}): StepReading => ({
    ...base,
    stepId,
    state,
    lane,
    jobId,
    ...more,
  })
  // Greg, by hand, as the prototype has him: papers lapsed on his insurance, Boerne's ask late, Pad B not asked yet.
  const greg: FlowReading = {
    kind: 'trade',
    off: null,
    defaultJobId: 'boerne',
    nowStepId: 'ask',
    nowJobId: 'boerne',
    lanes: [
      { lane: 'once', jobId: null, headStepId: null, ended: null, steps: [s('invited', 'done', 'once', null), s('portal', 'done', 'once', null), s('papers', 'lapsed', 'once', null, { facts: [w9, coi], lapsedPaper: 'coi' }), s('msa', 'done', 'once', null)] },
      { lane: 'per_job', jobId: 'boerne', headStepId: 'ask', ended: null, steps: [s('ask', 'now', 'per_job', 'boerne', { since: '2026-09-22', due: '2026-09-30', lateDays: 2 }), s('compare', 'next', 'per_job', 'boerne')] },
      { lane: 'per_job', jobId: 'padb', headStepId: 'ask', ended: null, steps: [s('ask', 'now', 'per_job', 'padb', { due: '2026-10-22', lateDays: -20 }), s('compare', 'next', 'per_job', 'padb')] },
    ],
  }

  it('takes the job as a parameter on the Per job lane and ignores it on Once', () => {
    expect(stepReading(greg, 'ask', 'boerne')?.lateDays).toBe(2)
    expect(stepReading(greg, 'ask', 'padb')?.lateDays).toBe(-20)
    expect(stepReading(greg, 'ask', 'stoneoak')).toBeNull()
    expect(stepReading(greg, 'papers', 'padb')?.state).toBe('lapsed')
  })

  it('gives the boards one place per step on now or lapsed, per job', () => {
    expect(placesOf(greg).map((p) => `${p.stepId}@${p.jobId ?? '-'}:${p.state}`)).toEqual(['papers@-:lapsed', 'ask@boerne:now', 'ask@padb:now'])
  })

  it('reads a paper for the job grid, with its run-out day', () => {
    expect(paperRead(greg, 'coi', 'boerne')).toEqual({ paper: 'coi', stepId: 'papers', stepState: 'lapsed', mark: 'bad', on: '2026-09-30', expires: '2026-09-30' })
    expect(paperRead(greg, 'w9', null)?.mark).toBe('ok')
    expect(paperRead(greg, 'sow', 'boerne')).toBeNull()
  })

  it('lists the per-job lane’s jobs for its picker, the default marked', () => {
    expect(perJobJobs(greg)).toEqual([
      { jobId: 'boerne', headStepId: 'ask', started: true, isDefault: true, ended: null },
      { jobId: 'padb', headStepId: 'ask', started: true, isDefault: false, ended: null },
    ])
  })

  it('says what moved between two readings, as the thread’s event line', () => {
    const after: FlowReading = {
      ...greg,
      lanes: greg.lanes.map((l) => (l.lane === 'once' ? { ...l, steps: l.steps.map((x) => (x.stepId === 'papers' ? { ...x, state: 'done' as const, lapsedPaper: null } : x)) } : l)),
    }
    const moves = flowMoves(greg, after)
    expect(moves).toEqual([{ stepId: 'papers', jobId: null, from: 'lapsed', to: 'done' }])
    expect(moveWords(SEED_FLOWS.trade, moves)).toBe('Papers in is done.')
    expect(moveWords(SEED_FLOWS.trade, [])).toBe('')
  })
})
