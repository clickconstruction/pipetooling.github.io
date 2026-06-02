import { describe, it, expect } from 'vitest'
import * as appMatcher from './accountingLabelRuleMatch'
// Deno edge copy (supabase/functions/_shared) — must behave identically.
import * as sharedMatcher from '../../supabase/functions/_shared/accountingLabelRuleMatch'

// Guards against drift between the client engine and the edge-function copy that
// pre-tags Mercury transactions in mercury-webhook. If this fails, the two
// implementations diverged — reconcile them.

type Tx = { amount: number | string | null; counterparty_name: string | null; raw: unknown }

const CRITERIA: unknown[] = [
  { v: 1 }, // no substantive clauses → never matches
  { v: 2 }, // unsupported version → parse null
  { v: 1, amount: { min: -120, max: -20 } },
  { v: 1, amount: { min: -20, max: -120 } }, // swapped bounds
  { v: 1, amount: { max: 0 } },
  { v: 1, amount: { min: 100 } },
  { v: 1, counterparty: { op: 'contains', value: 'shell' } },
  { v: 1, counterparty: { op: 'equals', value: 'Shell Oil' } },
  { v: 1, counterparty: { op: 'contains', value: '' } }, // empty → not substantive
  { v: 1, bankDescription: { op: 'contains', value: 'fuel' } },
  { v: 1, bankDescription: { op: 'equals', value: 'FUEL PURCHASE' } },
  { v: 1, amount: { min: -100, max: -10 }, counterparty: { op: 'contains', value: 'shell' } },
  { v: 1, amount: { bogus: true } }, // invalid → parse null
  { v: 1, counterparty: { op: 'startsWith', value: 'x' } }, // invalid op → parse null
  'not-an-object',
  null,
]

const TXS: Tx[] = [
  { amount: -40.27, counterparty_name: 'Shell Oil', raw: { bankDescription: 'FUEL PURCHASE shell' } },
  { amount: -1907.25, counterparty_name: null, raw: { bankDescription: 'CHECK 1021' } },
  { amount: 2000, counterparty_name: 'Internal Transfer', raw: {} },
  { amount: -15, counterparty_name: 'SHELL', raw: { bankDescription: 'Fuel' } },
  { amount: '-50', counterparty_name: 'shell oil co', raw: null },
  { amount: null, counterparty_name: 'Shell', raw: { bankDescription: 123 } },
]

describe('accountingLabelRuleMatch shared/app parity', () => {
  it('parseAccountingLabelRuleCriteria agrees on every fixture', () => {
    for (const c of CRITERIA) {
      expect(sharedMatcher.parseAccountingLabelRuleCriteria(c as never)).toEqual(
        appMatcher.parseAccountingLabelRuleCriteria(c as never),
      )
    }
  })

  it('matchAccountingLabelRuleCriteria agrees on every (tx, criteria) pair', () => {
    for (const c of CRITERIA) {
      const parsed = appMatcher.parseAccountingLabelRuleCriteria(c as never)
      if (parsed == null) continue
      for (const tx of TXS) {
        const appResult = appMatcher.matchAccountingLabelRuleCriteria(tx as never, parsed)
        const sharedResult = sharedMatcher.matchAccountingLabelRuleCriteria(tx as never, parsed)
        expect(sharedResult, `mismatch for tx=${JSON.stringify(tx)} criteria=${JSON.stringify(c)}`).toBe(
          appResult,
        )
      }
    }
  })
})
