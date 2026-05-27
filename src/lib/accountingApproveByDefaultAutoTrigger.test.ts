import { describe, expect, it } from 'vitest'

import {
  buildApproveByDefaultSignature,
  shouldAutoApproveAccountingSuggestions,
  type ShouldAutoApproveAccountingSuggestionsState,
} from './accountingApproveByDefaultAutoTrigger'

const baseGate: ShouldAutoApproveAccountingSuggestionsState = {
  enabled: true,
  pendingLoading: false,
  approveAllBusy: false,
  pendingCount: 5,
  currentSignature: 's1,s2,s3,s4,s5',
  lastSignature: null,
}

describe('buildApproveByDefaultSignature', () => {
  it('sorts suggestion ids so upstream order does not invalidate the signature', () => {
    const a = buildApproveByDefaultSignature([
      { suggestionId: 'b' },
      { suggestionId: 'a' },
      { suggestionId: 'c' },
    ])
    const b = buildApproveByDefaultSignature([
      { suggestionId: 'c' },
      { suggestionId: 'b' },
      { suggestionId: 'a' },
    ])
    expect(a).toBe(b)
  })

  it('returns empty string for an empty pending list (no crash)', () => {
    expect(buildApproveByDefaultSignature([])).toBe('')
  })

  it('changes when a single suggestion id is added', () => {
    const a = buildApproveByDefaultSignature([{ suggestionId: 's1' }])
    const b = buildApproveByDefaultSignature([{ suggestionId: 's1' }, { suggestionId: 's2' }])
    expect(a).not.toBe(b)
  })

  it('changes when a single suggestion id is removed (one approved away)', () => {
    const before = buildApproveByDefaultSignature([
      { suggestionId: 's1' },
      { suggestionId: 's2' },
    ])
    const after = buildApproveByDefaultSignature([{ suggestionId: 's2' }])
    expect(before).not.toBe(after)
  })
})

describe('shouldAutoApproveAccountingSuggestions', () => {
  it('runs when all gates pass and signature has changed', () => {
    expect(shouldAutoApproveAccountingSuggestions(baseGate)).toBe(true)
  })

  it('blocks when the toggle is off', () => {
    expect(
      shouldAutoApproveAccountingSuggestions({ ...baseGate, enabled: false }),
    ).toBe(false)
  })

  it('blocks while the pending list is loading (pendingLoading=true)', () => {
    expect(
      shouldAutoApproveAccountingSuggestions({ ...baseGate, pendingLoading: true }),
    ).toBe(false)
  })

  it('blocks while a manual Approve all is in flight (approveAllBusy=true)', () => {
    expect(
      shouldAutoApproveAccountingSuggestions({ ...baseGate, approveAllBusy: true }),
    ).toBe(false)
  })

  it('blocks when there is nothing to approve (pendingCount=0)', () => {
    expect(
      shouldAutoApproveAccountingSuggestions({ ...baseGate, pendingCount: 0 }),
    ).toBe(false)
  })

  it('blocks when the signature equals the last signature (loop guard for Internal Transfers conflict residue)', () => {
    expect(
      shouldAutoApproveAccountingSuggestions({
        ...baseGate,
        currentSignature: 'sig-x',
        lastSignature: 'sig-x',
      }),
    ).toBe(false)
  })

  it('unblocks on signature change (e.g. v2.580 auto-apply added new pending suggestions)', () => {
    expect(
      shouldAutoApproveAccountingSuggestions({
        ...baseGate,
        currentSignature: 'sig-new',
        lastSignature: 'sig-old',
      }),
    ).toBe(true)
  })
})
