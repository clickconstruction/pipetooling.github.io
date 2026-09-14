import { describe, expect, it } from 'vitest'
import {
  INBOX_GROUP_MEMBERS_TABLE,
  NO_INBOX_GROUP_ELIGIBILITY,
  inboxGroupEligibilityFor,
  membershipRowMeansEligible,
  planInboxGroupEligibility,
  sameInboxGroupEligibility,
} from './inboxGroupEligibility'

describe('planInboxGroupEligibility', () => {
  it('signed out → none, no query', () => {
    expect(planInboxGroupEligibility({ userId: null, role: 'dev' })).toEqual({ kind: 'none' })
    expect(planInboxGroupEligibility({ userId: undefined, role: null })).toEqual({ kind: 'none' })
    expect(planInboxGroupEligibility({ userId: '', role: 'assistant' })).toEqual({ kind: 'none' })
  })

  it('disabled (a digital twin behind the banner) → none, even for dev', () => {
    expect(planInboxGroupEligibility({ userId: 'u1', role: 'dev', disabled: true })).toEqual({ kind: 'none' })
    expect(planInboxGroupEligibility({ userId: 'u1', role: 'assistant', disabled: true })).toEqual({ kind: 'none' })
  })

  it('dev → all, no query', () => {
    expect(planInboxGroupEligibility({ userId: 'u1', role: 'dev' })).toEqual({ kind: 'all' })
    expect(planInboxGroupEligibility({ userId: 'u1', role: 'dev', disabled: false })).toEqual({ kind: 'all' })
  })

  it('every other role (and a role still loading) looks the groups up', () => {
    for (const role of ['master_technician', 'assistant', 'controller', 'estimator', 'subcontractor', 'helpers', 'primary', 'superintendent', null] as const) {
      expect(planInboxGroupEligibility({ userId: 'u1', role })).toEqual({ kind: 'lookup', userId: 'u1' })
    }
  })
})

describe('membership tables and rows', () => {
  it('reads the same two tables the three copies read', () => {
    expect(INBOX_GROUP_MEMBERS_TABLE.dispatch).toBe('dispatch_group_members')
    expect(INBOX_GROUP_MEMBERS_TABLE.estimator).toBe('estimator_group_members')
  })

  it('a row means eligible; null (maybeSingle miss) does not', () => {
    expect(membershipRowMeansEligible({ user_id: 'u1' })).toBe(true)
    expect(membershipRowMeansEligible(null)).toBe(false)
    expect(membershipRowMeansEligible(undefined)).toBe(false)
  })
})

describe('inboxGroupEligibilityFor', () => {
  it('fills only the groups asked about; the rest stay false', () => {
    expect(inboxGroupEligibilityFor(['dispatch'], () => true)).toEqual({ dispatch: true, estimator: false })
    expect(inboxGroupEligibilityFor(['estimator'], () => true)).toEqual({ dispatch: false, estimator: true })
    expect(inboxGroupEligibilityFor(['dispatch', 'estimator'], (g) => g === 'estimator')).toEqual({ dispatch: false, estimator: true })
    expect(inboxGroupEligibilityFor([], () => true)).toEqual(NO_INBOX_GROUP_ELIGIBILITY)
  })

  it('never mutates the shared empty record', () => {
    inboxGroupEligibilityFor(['dispatch', 'estimator'], () => true)
    expect(NO_INBOX_GROUP_ELIGIBILITY).toEqual({ dispatch: false, estimator: false })
  })
})

describe('sameInboxGroupEligibility', () => {
  it('compares by value so the hook can keep the previous object', () => {
    expect(sameInboxGroupEligibility({ dispatch: true, estimator: false }, { dispatch: true, estimator: false })).toBe(true)
    expect(sameInboxGroupEligibility({ dispatch: true, estimator: false }, { dispatch: true, estimator: true })).toBe(false)
  })
})
