import { describe, expect, it } from 'vitest'
import type { UserRole } from '../hooks/useAuth'
import {
  NEEDS_YOU_SOURCES,
  QUICKFILL_CARRIED_BY_STATION,
  QUICKFILL_HELD_BACK,
  needsYouSourceEnabled,
  needsYouSourceGates,
} from './needsYouSources'

const OFFICE: UserRole[] = ['dev', 'master_technician', 'assistant', 'controller']
const EVERY_ROLE: UserRole[] = [...OFFICE, 'estimator', 'primary', 'superintendent', 'subcontractor', 'helpers']

describe('needsYouSources · the parity rule (punch list #146)', () => {
  it.each(OFFICE)('%s: every source the Dashboard reads, Quickfill reads, or a station carries it, or it is held back by name', (role) => {
    const dash = needsYouSourceGates(role, 'dashboard')
    const quick = needsYouSourceGates(role, 'quickfill')
    const drifted = NEEDS_YOU_SOURCES.filter((s) => dash[s] && !quick[s] && !(s in QUICKFILL_CARRIED_BY_STATION) && !(s in QUICKFILL_HELD_BACK))
    expect(drifted).toEqual([])
  })

  it('a station or a held-back reason is the only way Quickfill reads less than the Dashboard', () => {
    for (const role of EVERY_ROLE) {
      for (const s of NEEDS_YOU_SOURCES) {
        const dash = needsYouSourceEnabled(s, role, 'dashboard')
        const quick = needsYouSourceEnabled(s, role, 'quickfill')
        if (s in QUICKFILL_CARRIED_BY_STATION || s in QUICKFILL_HELD_BACK) expect(quick).toBe(false)
        else expect(quick).toBe(dash)
      }
    }
  })

  it('names the two stations and the three held-back reasons, no more', () => {
    expect(Object.keys(QUICKFILL_CARRIED_BY_STATION).sort()).toEqual(['gcReview', 'jobFollowups'])
    expect(Object.keys(QUICKFILL_HELD_BACK).sort()).toEqual(['d22', 'robotAudits', 'submittals'])
    for (const reason of Object.values(QUICKFILL_HELD_BACK)) expect(reason.length).toBeGreaterThan(20)
  })

  it('the nine office lines of 2026-10-23 now reach Quickfill for the assistant', () => {
    const quick = needsYouSourceGates('assistant', 'quickfill')
    for (const s of ['bankReturned', 'contracts', 'jobAccountGaps', 'testReports', 'gcFollowUp', 'robotBlocked', 'statementRound', 'hoursApprovals'] as const) {
      expect(quick[s], s).toBe(true)
    }
  })

  it('keeps the role gates the Dashboard had', () => {
    expect(needsYouSourceEnabled('labelApprovals', 'assistant', 'dashboard')).toBe(false)
    expect(needsYouSourceEnabled('labelApprovals', 'controller', 'dashboard')).toBe(true)
    expect(needsYouSourceEnabled('hrReports', 'master_technician', 'dashboard')).toBe(false)
    expect(needsYouSourceEnabled('lienWaiversToSign', 'assistant', 'dashboard')).toBe(false)
    expect(needsYouSourceEnabled('lienWaiversToSign', 'master_technician', 'quickfill')).toBe(true)
    expect(needsYouSourceEnabled('myMoney', 'estimator', 'dashboard')).toBe(true)
    expect(needsYouSourceEnabled('myMoney', 'assistant', 'dashboard')).toBe(false)
    expect(needsYouSourceEnabled('vehicleRecordGaps', 'master_technician', 'dashboard')).toBe(false)
    expect(needsYouSourceEnabled('tally', null, 'dashboard')).toBe(false)
    expect(needsYouSourceEnabled('robotBlocked', 'estimator', 'quickfill')).toBe(true)
    expect(needsYouSourceEnabled('robotAudits', 'estimator', 'quickfill')).toBe(false)
  })
})
