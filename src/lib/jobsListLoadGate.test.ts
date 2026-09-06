import { describe, expect, it } from 'vitest'
import { shouldLoadJobsListForTab } from './jobsListLoadGate'

describe('shouldLoadJobsListForTab', () => {
  it('loads for the tabs whose openers read the shared jobs cache', () => {
    for (const tab of ['stages', 'billing', 'parts', 'sub_sheet_ledger', 'work_orders']) {
      expect(shouldLoadJobsListForTab(tab)).toBe(true)
    }
  })

  it('Job Summary loads too — Edit Job from a Job Summary row used to wait forever (J6-6)', () => {
    expect(shouldLoadJobsListForTab('job-summary')).toBe(true)
  })

  it('tabs that render off the cache alone stay lazy', () => {
    for (const tab of ['reports', 'combined-labor', 'teams-summary', 'inspections', 'billed']) {
      expect(shouldLoadJobsListForTab(tab)).toBe(false)
    }
  })

  it('no tab → no load', () => {
    expect(shouldLoadJobsListForTab(null)).toBe(false)
    expect(shouldLoadJobsListForTab(undefined)).toBe(false)
    expect(shouldLoadJobsListForTab('')).toBe(false)
  })
})
