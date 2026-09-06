import { describe, expect, it } from 'vitest'
import {
  canOpenMoneyStory,
  jobSummaryRowDomId,
  moneyStoryHref,
  resolveMoneyStoryLanding,
} from './moneyStoryDoor'
import type { UserRole } from '../../hooks/useAuth'

const ROLES: UserRole[] = [
  'dev',
  'master_technician',
  'assistant',
  'controller',
  'subcontractor',
  'helpers',
  'estimator',
  'primary',
  'superintendent',
]

describe('canOpenMoneyStory (T5-02)', () => {
  it('opens for every Job Summary role except assistants', () => {
    expect(ROLES.filter((r) => canOpenMoneyStory(r))).toEqual(['dev', 'master_technician', 'controller'])
  })
  it('is closed to assistants explicitly (Will, 2026-09-06)', () => {
    expect(canOpenMoneyStory('assistant')).toBe(false)
  })
  it('is closed with no role (cold load)', () => {
    expect(canOpenMoneyStory(null)).toBe(false)
    expect(canOpenMoneyStory(undefined)).toBe(false)
  })
})

describe('moneyStoryHref + row id', () => {
  it('lands on the Job Summary tab with the job id encoded', () => {
    expect(moneyStoryHref('abc-123')).toBe('/jobs?tab=job-summary&job=abc-123')
    expect(moneyStoryHref('a b')).toBe('/jobs?tab=job-summary&job=a%20b')
  })
  it('names the row the deep link scrolls to', () => {
    expect(jobSummaryRowDomId('abc')).toBe('job-summary-row-abc')
  })
})

describe('resolveMoneyStoryLanding', () => {
  it('does nothing without a param', () => {
    expect(resolveMoneyStoryLanding(null, new Set())).toEqual({ kind: 'none' })
    expect(resolveMoneyStoryLanding('  ', new Set())).toEqual({ kind: 'none' })
  })
  it('waits for the ledger', () => {
    expect(resolveMoneyStoryLanding('j1', null)).toEqual({ kind: 'wait' })
  })
  it('focuses a job on the list and reports one that is not', () => {
    expect(resolveMoneyStoryLanding('j1', new Set(['j1']))).toEqual({ kind: 'focus', jobId: 'j1' })
    expect(resolveMoneyStoryLanding('j2', new Set(['j1']))).toEqual({ kind: 'missing', jobId: 'j2' })
  })
})
