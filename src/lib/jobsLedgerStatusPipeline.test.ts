import { describe, expect, it } from 'vitest'
import {
  JOBS_LEDGER_STATUS_PIPELINE,
  jobsLedgerStatusDotColor,
  labelJobsLedgerStatusForDashboard,
  normalizeJobsLedgerStatus,
} from './jobsLedgerStatusPipeline'

describe('normalizeJobsLedgerStatus', () => {
  it('accepts every pipeline status, case- and whitespace-insensitive', () => {
    for (const s of JOBS_LEDGER_STATUS_PIPELINE) {
      expect(normalizeJobsLedgerStatus(s)).toBe(s)
      expect(normalizeJobsLedgerStatus(` ${s.toUpperCase()} `)).toBe(s)
    }
  })

  it('returns null for unknown, empty, and nullish input', () => {
    expect(normalizeJobsLedgerStatus('collections')).toBeNull()
    expect(normalizeJobsLedgerStatus('')).toBeNull()
    expect(normalizeJobsLedgerStatus(null)).toBeNull()
    expect(normalizeJobsLedgerStatus(undefined)).toBeNull()
  })
})

describe('labelJobsLedgerStatusForDashboard', () => {
  it('labels billed as Billed Awaiting Payment', () => {
    expect(labelJobsLedgerStatusForDashboard('billed')).toBe('Billed Awaiting Payment')
  })

  it('falls back to an em dash for unknown status', () => {
    expect(labelJobsLedgerStatusForDashboard('bogus')).toBe('—')
  })
})

describe('jobsLedgerStatusDotColor', () => {
  it('returns a distinct color for every pipeline status', () => {
    const colors = JOBS_LEDGER_STATUS_PIPELINE.map((s) => jobsLedgerStatusDotColor(s))
    expect(new Set(colors).size).toBe(JOBS_LEDGER_STATUS_PIPELINE.length)
    for (const c of colors) expect(c).toMatch(/^#[0-9a-f]{6}$/)
  })

  it('falls back to the neutral dot for unknown or missing status', () => {
    expect(jobsLedgerStatusDotColor('bogus')).toBe(jobsLedgerStatusDotColor(null))
    expect(jobsLedgerStatusDotColor(undefined)).toBe(jobsLedgerStatusDotColor(null))
  })
})
