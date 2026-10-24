/**
 * The candidate flow's stamps (spike, 2026-10-23), over a made-up row on the Team hiring board. Nothing here is real.
 */
import { describe, expect, it } from 'vitest'
import { candidateStamps, candidateStampsFor, type CandidateRow } from './candidateLoad'
import type { FlowRows } from './load'
import { readFlow } from './state'
import { SEED_FLOWS } from './seed'

const NOW = new Date('2026-10-23T20:00:00Z')

const fresh: CandidateRow = {
  status: 'active',
  rating_ability: null,
  rating_drive: null,
  rating_integrity: null,
  last_contact: null,
  trial_started_at: null,
  created_at: '2026-10-20T15:00:00Z',
  updated_at: '2026-10-20T15:00:00Z',
}

const QUALS = { levels: { plumbing: 1 as const, electrical: 0 as const, hvac: 0 as const }, license: { has: true as const, words: 'Journeyman plumber, TX M-55555' }, location: 'Round Rock' }

const rows = (candidate: CandidateRow | null, qualifications: typeof QUALS | null = null): FlowRows => ({
  contact: { id: 'c-casey', kind: 'candidate', off_since: null, off_why: null, off_by: null },
  candidate,
  qualifications,
})

describe('candidateStamps: what the hiring board row says', () => {
  it('gives nothing for a contact with no row, or a row the board has not touched', () => {
    expect(candidateStamps(null)).toEqual([])
    expect(candidateStamps(fresh)).toEqual([])
  })

  it('qualifications noted once the trades, the license and the home are known; the board’s old numbers no longer count', () => {
    expect(candidateStamps({ ...fresh, rating_ability: 3, rating_drive: 4, rating_integrity: 5 })).toEqual([])
    expect(candidateStamps(fresh, { levels: { plumbing: 1, electrical: 0 }, license: { has: false }, location: 'Round Rock' })).toEqual([])
    expect(candidateStamps(fresh, { levels: { plumbing: 1, electrical: 0, hvac: 0 }, license: { has: false }, location: 'Round Rock' })).toEqual([
      { fact: 'qualifications_noted', mark: 'ok', at: null, by: null, until: null },
    ])
  })

  it('screened by phone on a last contact, or once the board pulled them up for calls', () => {
    expect(candidateStamps({ ...fresh, last_contact: '2026-10-22' }).map((s) => [s.fact, s.at])).toEqual([['cand_called', '2026-10-22']])
    expect(candidateStamps({ ...fresh, status: 'calling', updated_at: '2026-10-22T10:00:00Z' }).map((s) => [s.fact, s.at])).toEqual([['cand_called', '2026-10-22T10:00:00Z']])
  })

  it('a try-out, then hired or passed, each on its own column', () => {
    const trial = { ...fresh, status: 'trial', trial_started_at: '2026-10-23T13:00:00Z', updated_at: '2026-10-23T13:00:00Z' }
    expect(candidateStamps(trial).map((s) => s.fact)).toEqual(['cand_called', 'cand_trial'])
    expect(candidateStamps({ ...trial, status: 'hired' }).map((s) => s.fact)).toEqual(['cand_called', 'cand_trial', 'cand_hired'])
    expect(candidateStamps({ ...trial, status: 'passed' }).map((s) => s.fact)).toEqual(['cand_called', 'cand_trial', 'cand_passed'])
  })
})

describe('candidateStampsFor with the seeded candidate flow', () => {
  const stepStates = (candidate: CandidateRow | null, qualifications: typeof QUALS | null = QUALS) =>
    readFlow(SEED_FLOWS.candidate, candidateStampsFor(rows(candidate, qualifications)), NOW).lanes.map((l) => l.steps.map((s) => [s.stepId, s.state]))

  it('is one Once lane with no jobs, off nobody', () => {
    const stamps = candidateStampsFor(rows(fresh))
    expect(stamps).toMatchObject({ kind: 'candidate', jobIds: [], defaultJobId: null, jobs: {}, off: null })
    expect(stamps.person.stamps).toEqual([])
  })

  it('reads the lane step by step: rated, screened, try-out, hired or passed', () => {
    const states = stepStates({ ...fresh, rating_ability: 3, rating_drive: 4, rating_integrity: 5, status: 'calling', last_contact: '2026-10-22' })
    expect(states).toHaveLength(1)
    expect(states[0]!.map(([id]) => id)).toEqual(['screen', 'qualifications', 'trial', 'decided'])
    const done = states[0]!.filter(([, state]) => state === 'done').map(([id]) => id)
    expect(done).toEqual(['screen', 'qualifications'])
  })

  it('a decision ends the lane either way', () => {
    const hired = stepStates({ ...fresh, rating_ability: 3, rating_drive: 4, rating_integrity: 5, status: 'hired', last_contact: '2026-10-22', trial_started_at: '2026-10-23T13:00:00Z' })
    expect(hired[0]!.every(([, state]) => state === 'done')).toBe(true)
  })
})
