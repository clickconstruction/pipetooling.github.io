import { describe, expect, it } from 'vitest'

import {
  buildAutoApplySignature,
  shouldAutoApplyAccountingRules,
  type ShouldAutoApplyAccountingRulesState,
} from './accountingApplyRulesAutoTrigger'

const baseGate: ShouldAutoApplyAccountingRulesState = {
  enabled: true,
  loading: false,
  rulesLoading: false,
  assignmentsLoading: false,
  applyRulesBusy: false,
  rulesCount: 3,
  currentSignature: 'a,b|r1,r2',
  lastSignature: null,
}

describe('buildAutoApplySignature', () => {
  it('sorts tx ids so upstream order does not invalidate the signature', () => {
    const a = buildAutoApplySignature(
      [{ id: 'b' }, { id: 'a' }, { id: 'c' }],
      [{ id: 'r1', enabled: true }],
    )
    const b = buildAutoApplySignature(
      [{ id: 'c' }, { id: 'b' }, { id: 'a' }],
      [{ id: 'r1', enabled: true }],
    )
    expect(a).toBe(b)
  })

  it('drops rules whose enabled flag is false (matches the executor)', () => {
    const enabledOnly = buildAutoApplySignature(
      [{ id: 'tx1' }],
      [
        { id: 'r1', enabled: true },
        { id: 'r2', enabled: false },
        { id: 'r3', enabled: true },
      ],
    )
    expect(enabledOnly).toBe('tx1|r1,r3')
  })

  it('returns a stable signature with both empty inputs (no crash)', () => {
    expect(buildAutoApplySignature([], [])).toBe('|')
  })

  it('changes when a single tx id changes', () => {
    const a = buildAutoApplySignature([{ id: 'tx1' }], [{ id: 'r1', enabled: true }])
    const b = buildAutoApplySignature([{ id: 'tx2' }], [{ id: 'r1', enabled: true }])
    expect(a).not.toBe(b)
  })
})

describe('shouldAutoApplyAccountingRules', () => {
  it('runs when all gates pass and signature has changed', () => {
    expect(shouldAutoApplyAccountingRules(baseGate)).toBe(true)
  })

  it('blocks when the toggle is off', () => {
    expect(shouldAutoApplyAccountingRules({ ...baseGate, enabled: false })).toBe(false)
  })

  it('blocks while rows are loading (loading=true)', () => {
    expect(shouldAutoApplyAccountingRules({ ...baseGate, loading: true })).toBe(false)
  })

  it('blocks while rules are loading (rulesLoading=true)', () => {
    expect(shouldAutoApplyAccountingRules({ ...baseGate, rulesLoading: true })).toBe(false)
  })

  it('blocks while assignments are loading (assignmentsLoading=true)', () => {
    expect(shouldAutoApplyAccountingRules({ ...baseGate, assignmentsLoading: true })).toBe(false)
  })

  it('blocks while a manual Apply rules click is in flight (applyRulesBusy=true)', () => {
    expect(shouldAutoApplyAccountingRules({ ...baseGate, applyRulesBusy: true })).toBe(false)
  })

  it('blocks when there are no rules at all (rulesCount=0)', () => {
    expect(shouldAutoApplyAccountingRules({ ...baseGate, rulesCount: 0 })).toBe(false)
  })

  it('blocks when the signature equals the last applied signature (loop guard)', () => {
    expect(
      shouldAutoApplyAccountingRules({
        ...baseGate,
        currentSignature: 'sig-x',
        lastSignature: 'sig-x',
      }),
    ).toBe(false)
  })

  it('unblocks on signature change (e.g. a tx dropped from the unlabeled set)', () => {
    expect(
      shouldAutoApplyAccountingRules({
        ...baseGate,
        currentSignature: 'sig-new',
        lastSignature: 'sig-old',
      }),
    ).toBe(true)
  })
})
