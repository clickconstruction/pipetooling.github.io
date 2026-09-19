import { describe, expect, it } from 'vitest'
import { blockCoverageKey, buildBlockCoverageByKey, countUnsupervised, coverageOfAssignees, supervisionWarningFor, type CoveragePerson } from './blockGroupCoverage'

const people = new Map<string, CoveragePerson>([
  ['mike', { role: 'master_technician', needsSupervision: false }],
  ['bryan', { role: 'helpers', needsSupervision: true }],
  ['tristen', { role: 'helpers', needsSupervision: false }],
  ['jake', { role: 'subcontractor', needsSupervision: true }],
  ['grace', { role: 'assistant', needsSupervision: false }],
])

const b = (id: string, group: string | null, assignee: string) => ({ id, shared_block_group_id: group, assignee_user_id: assignee })

describe('coverageOfAssignees', () => {
  it('a master or a switched-off helper covers; helpers and subs who need supervision do not', () => {
    expect(coverageOfAssignees(['bryan', 'mike'], people)).toBe('covered')
    expect(coverageOfAssignees(['bryan', 'tristen'], people)).toBe('covered')
    expect(coverageOfAssignees(['bryan', 'jake'], people)).toBe('unsupervised')
    expect(coverageOfAssignees(['bryan'], people)).toBe('unsupervised')
  })
  it('office people are neither supervision nor supervised; a block of only them, or nobody, is not a warning', () => {
    expect(coverageOfAssignees(['grace'], people)).toBe('covered')
    expect(coverageOfAssignees(['grace', 'bryan'], people)).toBe('unsupervised')
    expect(coverageOfAssignees([], people)).toBe('covered')
  })
  it('an assignee the roster did not return makes the verdict unknown, never a warning', () => {
    expect(coverageOfAssignees(['bryan', 'ghost'], people)).toBe('unknown')
    expect(coverageOfAssignees(['mike', 'ghost'], people)).toBe('covered') // a supervisor settles it first
  })
})

describe('buildBlockCoverageByKey', () => {
  it('judges the legs of a linked group together and a solo block alone, keyed by group or block id', () => {
    const blocks = [
      b('b1', 'g1', 'mike'),
      b('b2', 'g1', 'bryan'),
      b('b3', 'g2', 'bryan'),
      b('b4', 'g2', 'jake'),
      b('b5', null, 'jake'),
      b('b6', null, 'tristen'),
    ]
    const m = buildBlockCoverageByKey(blocks, people)
    expect(m.get('g1')).toBe('covered')
    expect(m.get('g2')).toBe('unsupervised')
    expect(m.get('b5')).toBe('unsupervised')
    expect(m.get('b6')).toBe('covered')
    expect(blockCoverageKey(b('b5', null, 'jake'))).toBe('b5')
    expect(blockCoverageKey(b('b1', 'g1', 'mike'))).toBe('g1')
    expect(countUnsupervised(m)).toBe(2)
  })
})

describe('supervisionWarningFor', () => {
  it('warns only for a person who needs supervision on a block nobody can run', () => {
    expect(supervisionWarningFor('Bryan', people.get('bryan'), 'unsupervised')).toMatch(/^Bryan needs supervision — nobody on this block can run it yet/)
    expect(supervisionWarningFor('Bryan', people.get('bryan'), 'covered')).toBeNull()
    expect(supervisionWarningFor('Bryan', people.get('bryan'), 'unknown')).toBeNull()
    expect(supervisionWarningFor('Mike', people.get('mike'), 'unsupervised')).toBeNull()
    expect(supervisionWarningFor('Tristen', people.get('tristen'), 'unsupervised')).toBeNull()
    expect(supervisionWarningFor('Ghost', undefined, 'unsupervised')).toBeNull()
  })
})
