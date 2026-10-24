import { describe, expect, it } from 'vitest'
import { plainWordsFailures } from '../plainWords'
import { factById, type FactId } from './facts'
import { SEED_FLOWS } from './seed'
import { flat, readFlow, type FactStamp, type FlowStamps } from './state'

const SUB = SEED_FLOWS.sub
// The job lane alone, for the walks: the Once lane (a sub coming on, spike) is read by subOnboardingLoad.test.ts.
const SUB_JOBS = { ...SUB, lanes: SUB.lanes.filter((l) => l.lane === 'per_job') }
const NOW = new Date('2026-10-12T17:00:00Z')

const ok = (fact: FactId, at: string): FactStamp => ({ fact, mark: 'ok', at, by: null, until: null })
/** Sam on one sheet, stamped as far as `stamps` go. */
const sam = (stamps: FactStamp[]): FlowStamps => ({
  kind: 'sub',
  jobIds: ['sheet-1'],
  defaultJobId: 'sheet-1',
  person: { stamps: [], rounds: {}, dues: {} },
  jobs: { 'sheet-1': { jobId: 'sheet-1', stamps, rounds: {}, dues: {} } },
  skips: [],
  waits: [],
  off: null,
})
const where = (stamps: FactStamp[]) => {
  const r = readFlow(SUB_JOBS, sam(stamps), NOW)
  const lane = r.lanes[0]!
  return `${r.nowStepId ?? '-'} · ${lane.steps.map((s) => `${s.stepId}:${s.state}`).join(' ')}${lane.ended ? ` · ended by ${lane.ended}` : ''}`
}

describe('flows/seed: the sub flow (R8 · 12)', () => {
  it('is one Per job lane of five steps, from the work order to the pay', () => {
    expect(SUB.kind).toBe('sub')
    expect(SUB.lanes.map((l) => l.lane)).toEqual(['once', 'per_job'])
    expect(flat(SUB_JOBS).map((s) => `${s.id}:${s.name}:${s.who}`)).toEqual(['asked:Asked:us', 'yes:Said yes:them', 'onsite:On site:them', 'done:Done:them', 'paid:Paid:us'])
  })

  it('finishes each step with a sub fact, Said yes a fork whose no ends the lane', () => {
    expect(flat(SUB).map((s) => s.facts.join('|'))).toEqual(['sub_reached', 'qualifications_noted', 'w9_signed', 'coi_current', 'sub_agreement', 'sub_first_done', 'sub_kept|sub_let_go', 'sub_asked', 'sub_said_yes|sub_declined', 'sub_on_site', 'sub_done', 'sub_paid'])
    const yes = flat(SUB).find((s) => s.id === 'yes')!
    expect([yes.fork, yes.join, factById('sub_declined')?.endsLane]).toEqual([true, 'or', true])
    for (const s of flat(SUB_JOBS)) for (const f of s.facts) expect(factById(f)?.scope).toBe('job')
    for (const s of flat(SUB).slice(0, 7)) for (const f of s.facts) expect(factById(f)?.scope).toBe('person')
  })

  it('has no reminders, our two steps seated, and says what we owe on them', () => {
    expect(flat(SUB).filter((s) => s.nudge)).toEqual([])
    expect(flat(SUB).filter((s) => s.who === 'us').map((s) => `${s.id}:${s.seat}:${s.owedWords}`)).toEqual(['reached:Rosa:a call', 'qualifications:Rosa:their qualifications', 'kept:Rosa:null', 'asked:Rosa:the work order', 'paid:Rosa:their pay'])
    expect(flat(SUB).filter((s) => s.who === 'them' && s.owedWords)).toEqual([])
  })

  it('keeps every name, owed phrase, later line and fact in plain words', () => {
    const words = flat(SUB).flatMap((s) => [s.name, s.owedWords ?? '', s.later?.en ?? '', ...s.facts.flatMap((f) => [factById(f)?.text ?? '', factById(f)?.small ?? ''])])
    expect(words.flatMap(plainWordsFailures)).toEqual([])
  })
})

describe('readFlow over the sub flow', () => {
  it('walks Sam from the work order to the pay', () => {
    expect(where([ok('sub_asked', '2026-10-05')])).toBe('yes · asked:done yes:now onsite:next done:later paid:later')
    expect(where([ok('sub_asked', '2026-10-05'), ok('sub_said_yes', '2026-10-06')])).toBe('onsite · asked:done yes:done onsite:now done:next paid:later')
    const worked = [ok('sub_asked', '2026-10-05'), ok('sub_said_yes', '2026-10-06'), ok('sub_on_site', '2026-10-08'), ok('sub_done', '2026-10-10')]
    expect(where(worked)).toBe('paid · asked:done yes:done onsite:done done:done paid:now')
    expect(where([...worked, ok('sub_paid', '2026-10-12')])).toBe('- · asked:done yes:done onsite:done done:done paid:done')
  })

  it('ends the lane when they turn the work down', () => {
    expect(where([ok('sub_asked', '2026-10-05'), ok('sub_declined', '2026-10-06')])).toBe(
      '- · asked:done yes:done onsite:later done:later paid:later · ended by sub_declined',
    )
  })
})
