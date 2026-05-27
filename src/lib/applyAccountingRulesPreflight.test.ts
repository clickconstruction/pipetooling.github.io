import { describe, expect, it } from 'vitest'
import type { AccountingLabelRuleCriteriaV1 } from './accountingLabelRuleMatch'
import {
  buildAccountingRulesToInsert,
  type ApplyRulesPreflightRuleInput,
  type ApplyRulesPreflightTxInput,
} from './applyAccountingRulesPreflight'

function rule(
  partial: Partial<ApplyRulesPreflightRuleInput> & { id: string },
): ApplyRulesPreflightRuleInput {
  return {
    label_id: `label-for-${partial.id}`,
    sort_order: 0,
    enabled: true,
    criteria: { v: 1, counterparty: { op: 'contains', value: 'acme' } },
    ...partial,
  }
}

function tx(
  partial: Partial<ApplyRulesPreflightTxInput> & { id: string },
): ApplyRulesPreflightTxInput {
  return {
    amount: 0,
    counterparty_name: null,
    raw: null,
    ...partial,
  }
}

const counterpartyContains = (value: string): AccountingLabelRuleCriteriaV1 => ({
  v: 1,
  counterparty: { op: 'contains', value },
})

describe('buildAccountingRulesToInsert', () => {
  it('returns empty when no rules', () => {
    const out = buildAccountingRulesToInsert({
      rules: [],
      filteredTransactions: [tx({ id: 't1', counterparty_name: 'Acme Co' })],
      assignedTxIds: new Set(),
      pendingTxIds: new Set(),
    })
    expect(out).toEqual([])
  })

  it('returns empty when no transactions', () => {
    const out = buildAccountingRulesToInsert({
      rules: [rule({ id: 'r1', criteria: counterpartyContains('acme') })],
      filteredTransactions: [],
      assignedTxIds: new Set(),
      pendingTxIds: new Set(),
    })
    expect(out).toEqual([])
  })

  it('skips disabled rules', () => {
    const out = buildAccountingRulesToInsert({
      rules: [rule({ id: 'r1', enabled: false, criteria: counterpartyContains('acme') })],
      filteredTransactions: [tx({ id: 't1', counterparty_name: 'Acme Co' })],
      assignedTxIds: new Set(),
      pendingTxIds: new Set(),
    })
    expect(out).toEqual([])
  })

  it('skips rules with null criteria', () => {
    const out = buildAccountingRulesToInsert({
      rules: [rule({ id: 'r1', criteria: null })],
      filteredTransactions: [tx({ id: 't1', counterparty_name: 'Acme Co' })],
      assignedTxIds: new Set(),
      pendingTxIds: new Set(),
    })
    expect(out).toEqual([])
  })

  it('skips rules with zero substantive clauses (empty value)', () => {
    const out = buildAccountingRulesToInsert({
      rules: [rule({ id: 'r1', criteria: { v: 1, counterparty: { op: 'contains', value: '' } } })],
      filteredTransactions: [tx({ id: 't1', counterparty_name: 'Acme Co' })],
      assignedTxIds: new Set(),
      pendingTxIds: new Set(),
    })
    expect(out).toEqual([])
  })

  it('skips transactions already assigned a label', () => {
    const out = buildAccountingRulesToInsert({
      rules: [rule({ id: 'r1', label_id: 'lbl-1', criteria: counterpartyContains('acme') })],
      filteredTransactions: [
        tx({ id: 't1', counterparty_name: 'Acme Co' }),
        tx({ id: 't2', counterparty_name: 'Acme Co' }),
      ],
      assignedTxIds: new Set(['t1']),
      pendingTxIds: new Set(),
    })
    expect(out).toEqual([
      { mercury_transaction_id: 't2', rule_id: 'r1', suggested_label_id: 'lbl-1' },
    ])
  })

  it('skips transactions already in pending suggestions', () => {
    const out = buildAccountingRulesToInsert({
      rules: [rule({ id: 'r1', label_id: 'lbl-1', criteria: counterpartyContains('acme') })],
      filteredTransactions: [
        tx({ id: 't1', counterparty_name: 'Acme Co' }),
        tx({ id: 't2', counterparty_name: 'Acme Co' }),
      ],
      assignedTxIds: new Set(),
      pendingTxIds: new Set(['t2']),
    })
    expect(out).toEqual([
      { mercury_transaction_id: 't1', rule_id: 'r1', suggested_label_id: 'lbl-1' },
    ])
  })

  it('first-match-wins by sort_order ascending', () => {
    const out = buildAccountingRulesToInsert({
      rules: [
        rule({ id: 'rWide', label_id: 'lbl-wide', sort_order: 10, criteria: counterpartyContains('gas') }),
        rule({ id: 'rNarrow', label_id: 'lbl-narrow', sort_order: 1, criteria: counterpartyContains('shell gas') }),
      ],
      filteredTransactions: [tx({ id: 't1', counterparty_name: 'Shell Gas Station' })],
      assignedTxIds: new Set(),
      pendingTxIds: new Set(),
    })
    expect(out).toEqual([
      { mercury_transaction_id: 't1', rule_id: 'rNarrow', suggested_label_id: 'lbl-narrow' },
    ])
  })

  it('first-match-wins by id when sort_order ties', () => {
    const out = buildAccountingRulesToInsert({
      rules: [
        rule({ id: 'rB', label_id: 'lbl-b', sort_order: 5, criteria: counterpartyContains('acme') }),
        rule({ id: 'rA', label_id: 'lbl-a', sort_order: 5, criteria: counterpartyContains('acme') }),
      ],
      filteredTransactions: [tx({ id: 't1', counterparty_name: 'Acme Co' })],
      assignedTxIds: new Set(),
      pendingTxIds: new Set(),
    })
    expect(out).toEqual([
      { mercury_transaction_id: 't1', rule_id: 'rA', suggested_label_id: 'lbl-a' },
    ])
  })

  it('emits one row per matching tx, in input transaction order', () => {
    const out = buildAccountingRulesToInsert({
      rules: [
        rule({ id: 'rA', label_id: 'lbl-a', criteria: counterpartyContains('acme') }),
        rule({ id: 'rB', label_id: 'lbl-b', sort_order: 5, criteria: counterpartyContains('shell') }),
      ],
      filteredTransactions: [
        tx({ id: 't1', counterparty_name: 'Other' }),
        tx({ id: 't2', counterparty_name: 'Acme Co' }),
        tx({ id: 't3', counterparty_name: 'Shell Inc' }),
        tx({ id: 't4', counterparty_name: 'Acme Inc' }),
      ],
      assignedTxIds: new Set(),
      pendingTxIds: new Set(),
    })
    expect(out).toEqual([
      { mercury_transaction_id: 't2', rule_id: 'rA', suggested_label_id: 'lbl-a' },
      { mercury_transaction_id: 't3', rule_id: 'rB', suggested_label_id: 'lbl-b' },
      { mercury_transaction_id: 't4', rule_id: 'rA', suggested_label_id: 'lbl-a' },
    ])
  })

  it('emits no row when a tx matches zero rules', () => {
    const out = buildAccountingRulesToInsert({
      rules: [rule({ id: 'r1', label_id: 'lbl-1', criteria: counterpartyContains('acme') })],
      filteredTransactions: [tx({ id: 't1', counterparty_name: 'Other Co' })],
      assignedTxIds: new Set(),
      pendingTxIds: new Set(),
    })
    expect(out).toEqual([])
  })

  it('does not enforce a cap (returns full uncapped list)', () => {
    const matchingRule = rule({ id: 'r1', label_id: 'lbl-1', criteria: counterpartyContains('acme') })
    const txs = Array.from({ length: 1500 }, (_, i) =>
      tx({ id: `t${i}`, counterparty_name: 'Acme Co' }),
    )
    const out = buildAccountingRulesToInsert({
      rules: [matchingRule],
      filteredTransactions: txs,
      assignedTxIds: new Set(),
      pendingTxIds: new Set(),
    })
    expect(out).toHaveLength(1500)
  })

  it('does not double-count a tx that appears twice in the input list', () => {
    const out = buildAccountingRulesToInsert({
      rules: [rule({ id: 'r1', label_id: 'lbl-1', criteria: counterpartyContains('acme') })],
      filteredTransactions: [
        tx({ id: 't1', counterparty_name: 'Acme Co' }),
        tx({ id: 't1', counterparty_name: 'Acme Co' }),
      ],
      assignedTxIds: new Set(),
      pendingTxIds: new Set(),
    })
    expect(out).toEqual([
      { mercury_transaction_id: 't1', rule_id: 'r1', suggested_label_id: 'lbl-1' },
    ])
  })
})
