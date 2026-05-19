import { describe, it, expect } from 'vitest'
import {
  filterForecastJobsBySearch,
  forecastJobMatchesSearch,
  normalizeForecastJobSearchQuery,
} from './projectsForecastJobSearch'
import type { LedgerPrefixMap } from './ledgerDisplayPrefixes'

const PREFIX_MAP: LedgerPrefixMap = {
  'st-plumbing': { job: 'JP', bid: 'BP' },
  'st-electric': { job: 'JE', bid: 'BE' },
}

const JOBS = [
  {
    id: 'j1',
    hcp_number: '740',
    job_name: 'Mission Hills',
    job_address: '123 Main St',
    service_type_id: 'st-plumbing',
    project_name: 'Riverside Subdivision',
  },
  {
    id: 'j2',
    hcp_number: '812',
    job_name: 'Downtown Tower',
    job_address: '999 Congress Ave',
    service_type_id: 'st-electric',
    project_name: null,
  },
  {
    id: 'j3',
    hcp_number: '850',
    job_name: 'Westlake Cottage',
    job_address: '5 Park Ln',
    service_type_id: null,
    project_name: 'Westside Holdings',
  },
] as const

describe('normalizeForecastJobSearchQuery', () => {
  it('lowercases and collapses whitespace', () => {
    expect(normalizeForecastJobSearchQuery('  MISSION   Hills ')).toBe('mission hills')
  })

  it('returns empty for blank input', () => {
    expect(normalizeForecastJobSearchQuery('')).toBe('')
    expect(normalizeForecastJobSearchQuery(null)).toBe('')
    expect(normalizeForecastJobSearchQuery(undefined)).toBe('')
    expect(normalizeForecastJobSearchQuery('   ')).toBe('')
  })
})

describe('forecastJobMatchesSearch', () => {
  it('matches everything when query is empty', () => {
    for (const j of JOBS) {
      expect(forecastJobMatchesSearch(j, '', PREFIX_MAP)).toBe(true)
    }
  })

  it('matches on the full prefix+number label', () => {
    expect(forecastJobMatchesSearch(JOBS[0], 'JP740', PREFIX_MAP)).toBe(true)
    expect(forecastJobMatchesSearch(JOBS[1], 'JE812', PREFIX_MAP)).toBe(true)
  })

  it('matches on bare HCP number (no prefix)', () => {
    expect(forecastJobMatchesSearch(JOBS[0], '740', PREFIX_MAP)).toBe(true)
    expect(forecastJobMatchesSearch(JOBS[2], '850', PREFIX_MAP)).toBe(true)
  })

  it('matches on job name substring case-insensitively', () => {
    expect(forecastJobMatchesSearch(JOBS[0], 'mission', PREFIX_MAP)).toBe(true)
    expect(forecastJobMatchesSearch(JOBS[1], 'TOWER', PREFIX_MAP)).toBe(true)
  })

  it('matches on address substring', () => {
    expect(forecastJobMatchesSearch(JOBS[0], 'main st', PREFIX_MAP)).toBe(true)
  })

  it('matches on project name substring', () => {
    expect(forecastJobMatchesSearch(JOBS[0], 'riverside', PREFIX_MAP)).toBe(true)
    expect(forecastJobMatchesSearch(JOBS[2], 'westside', PREFIX_MAP)).toBe(true)
    // Jobs with null project_name should not match a project-name query.
    expect(forecastJobMatchesSearch(JOBS[1], 'riverside', PREFIX_MAP)).toBe(false)
  })

  it('returns false for clearly non-matching queries', () => {
    expect(forecastJobMatchesSearch(JOBS[0], 'zzz nonsense', PREFIX_MAP)).toBe(false)
  })

  it('falls back to default J prefix when service_type_id is null', () => {
    expect(forecastJobMatchesSearch(JOBS[2], 'J850', PREFIX_MAP)).toBe(true)
  })
})

describe('filterForecastJobsBySearch', () => {
  it('returns the same reference when query is empty', () => {
    const out = filterForecastJobsBySearch(JOBS, '', PREFIX_MAP)
    expect(out).toBe(JOBS)
  })

  it('filters to only matching rows', () => {
    const out = filterForecastJobsBySearch(JOBS, 'mission', PREFIX_MAP)
    expect(out.map((j) => j.id)).toEqual(['j1'])
  })
})
