import { describe, expect, it } from 'vitest'
import {
  accountIsInUse,
  eligibleAbsorbCandidates,
  mergeIneligibilityReason,
} from './mergeUserAccounts'

const liveUsed = { id: 'a', role: 'subcontractor', archived_at: null, last_sign_in_at: '2026-07-01T00:00:00Z' }
const liveNeverUsed = { id: 'b', role: 'subcontractor', archived_at: null, last_sign_in_at: null }
const archived = { id: 'c', role: 'subcontractor', archived_at: '2026-05-01T00:00:00Z', last_sign_in_at: '2026-04-01T00:00:00Z' }
const archived2 = { id: 'd', role: 'subcontractor', archived_at: '2026-03-01T00:00:00Z', last_sign_in_at: null }
const estimatorArchived = { id: 'e', role: 'estimator', archived_at: '2026-05-01T00:00:00Z', last_sign_in_at: null }

describe('accountIsInUse', () => {
  it('is true only for live accounts that have signed in', () => {
    expect(accountIsInUse(liveUsed)).toBe(true)
    expect(accountIsInUse(liveNeverUsed)).toBe(false)
    expect(accountIsInUse(archived)).toBe(false)
  })
})

describe('mergeIneligibilityReason', () => {
  it('allows archived into live (combined stays live)', () => {
    expect(mergeIneligibilityReason(liveUsed, archived)).toBeNull()
  })
  it('allows archived into archived (stays archived)', () => {
    expect(mergeIneligibilityReason(archived, archived2)).toBeNull()
  })
  it('allows a live never-signed-in account to be absorbed', () => {
    expect(mergeIneligibilityReason(liveUsed, liveNeverUsed)).toBeNull()
  })
  it('blocks absorbing a live signed-in account', () => {
    expect(mergeIneligibilityReason(liveNeverUsed, liveUsed)).toMatch(/archived, or never signed into/)
  })
  it('blocks an archived survivor when the absorbed is live', () => {
    expect(mergeIneligibilityReason(archived, liveNeverUsed)).toMatch(/must be the survivor/)
  })
  it('blocks role mismatches and self-merges', () => {
    expect(mergeIneligibilityReason(liveUsed, estimatorArchived)).toMatch(/same role/)
    expect(mergeIneligibilityReason(liveUsed, liveUsed)).toMatch(/two different accounts/)
  })
})

describe('eligibleAbsorbCandidates', () => {
  it('filters to same-role, absorbable accounts', () => {
    const all = [liveUsed, liveNeverUsed, archived, archived2, estimatorArchived]
    expect(eligibleAbsorbCandidates(liveUsed, all).map((a) => a.id)).toEqual(['b', 'c', 'd'])
    expect(eligibleAbsorbCandidates(archived, all).map((a) => a.id)).toEqual(['d'])
    expect(eligibleAbsorbCandidates(null, all)).toEqual([])
  })
})
