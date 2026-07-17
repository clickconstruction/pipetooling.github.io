import { describe, expect, it } from 'vitest'
import {
  NO_SOURCE_LABEL,
  distinctTeamProspectSources,
  summarizeTeamProspectSources,
} from './teamProspectSourceSummary'

function row(source: string | null, status = 'active') {
  return { source, status }
}

describe('summarizeTeamProspectSources', () => {
  it('groups case- and whitespace-insensitively, keeping first-seen spelling', () => {
    const out = summarizeTeamProspectSources([
      row('Referral', 'hired'),
      row('referral '),
      row('  REFERRAL', 'passed'),
    ])
    expect(out).toHaveLength(1)
    expect(out[0]!.label).toBe('Referral')
    expect(out[0]!.total).toBe(3)
    expect(out[0]!.active).toBe(1)
    expect(out[0]!.hired).toBe(1)
    expect(out[0]!.passed).toBe(1)
  })

  it('collapses inner whitespace when grouping', () => {
    const out = summarizeTeamProspectSources([row('job  board'), row('job board')])
    expect(out).toHaveLength(1)
    expect(out[0]!.total).toBe(2)
  })

  it('buckets blank/null sources under (no source)', () => {
    const out = summarizeTeamProspectSources([row(null), row('   '), row('')])
    expect(out).toHaveLength(1)
    expect(out[0]!.label).toBe(NO_SOURCE_LABEL)
    expect(out[0]!.total).toBe(3)
  })

  it('computes hire rate over decided candidates only', () => {
    const out = summarizeTeamProspectSources([
      row('indeed', 'hired'),
      row('indeed', 'passed'),
      row('indeed', 'passed'),
      row('indeed', 'active'),
    ])
    expect(out[0]!.hireRate).toBeCloseTo(1 / 3)
  })

  it('hire rate is null when nobody has been decided', () => {
    const out = summarizeTeamProspectSources([row('walk-in'), row('walk-in')])
    expect(out[0]!.hireRate).toBeNull()
  })

  it('treats unknown statuses as active (matches board grouping)', () => {
    const out = summarizeTeamProspectSources([row('x', 'weird_status')])
    expect(out[0]!.active).toBe(1)
  })

  it('sorts by hires desc, then total desc, then label', () => {
    const out = summarizeTeamProspectSources([
      row('small', 'hired'),
      row('big', 'hired'),
      row('big', 'hired'),
      row('busy'),
      row('busy'),
      row('busy'),
      row('alpha'),
      row('beta'),
    ])
    expect(out.map((r) => r.label)).toEqual(['big', 'small', 'busy', 'alpha', 'beta'])
  })

  it('returns empty for no rows', () => {
    expect(summarizeTeamProspectSources([])).toEqual([])
  })
})

describe('distinctTeamProspectSources', () => {
  it('returns unique first-seen spellings alphabetically, skipping blanks', () => {
    const out = distinctTeamProspectSources([
      row('Referral'),
      row('referral'),
      row('Indeed'),
      row(null),
      row('  '),
      row('walk-in'),
    ])
    expect(out).toEqual(['Indeed', 'Referral', 'walk-in'])
  })
})
