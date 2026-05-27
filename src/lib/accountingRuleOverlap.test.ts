import { describe, expect, it } from 'vitest'
import type { AccountingLabelRuleCriteriaV1 } from './accountingLabelRuleMatch'
import {
  buildAccountingRuleOverlapReport,
  type OverlapRuleInput,
  type OverlapTxInput,
} from './accountingRuleOverlap'

function rule(partial: Partial<OverlapRuleInput> & { id: string }): OverlapRuleInput {
  return {
    name: partial.id,
    label_id: 'label-default',
    sort_order: 0,
    enabled: true,
    criteria: { v: 1, counterparty: { op: 'contains', value: 'acme' } },
    ...partial,
  }
}

function tx(partial: Partial<OverlapTxInput> & { id: string }): OverlapTxInput {
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

describe('buildAccountingRuleOverlapReport', () => {
  it('returns empty report when no rules and no txs', () => {
    const r = buildAccountingRuleOverlapReport([], [])
    expect(r.txRows).toEqual([])
    expect(r.overlappingTxCount).toBe(0)
    expect(r.conflictTxCount).toBe(0)
    expect(r.perRule.size).toBe(0)
    expect(r.pairCounts).toEqual([])
  })

  it('returns empty report when rules exist but no txs match', () => {
    const r = buildAccountingRuleOverlapReport(
      [rule({ id: 'r1', criteria: counterpartyContains('shell') })],
      [tx({ id: 't1', counterparty_name: 'Other' })],
    )
    expect(r.txRows).toEqual([])
    expect(r.overlappingTxCount).toBe(0)
    expect(r.perRule.get('r1')).toEqual({ matched: 0, winner: 0, shadowed: 0 })
  })

  it('does not include single-match txs in txRows when there is no assignment conflict', () => {
    const r = buildAccountingRuleOverlapReport(
      [rule({ id: 'r1', criteria: counterpartyContains('shell') })],
      [tx({ id: 't1', counterparty_name: 'Shell Gas' })],
    )
    expect(r.txRows).toEqual([])
    expect(r.overlappingTxCount).toBe(0)
    expect(r.perRule.get('r1')).toEqual({ matched: 1, winner: 1, shadowed: 0 })
  })

  it('marks lower sort_order as winner and records the shadowed pair', () => {
    const r = buildAccountingRuleOverlapReport(
      [
        rule({ id: 'rWide', sort_order: 10, criteria: counterpartyContains('gas') }),
        rule({ id: 'rNarrow', sort_order: 1, criteria: counterpartyContains('shell gas') }),
      ],
      [tx({ id: 't1', counterparty_name: 'Shell Gas Station' })],
    )
    expect(r.overlappingTxCount).toBe(1)
    expect(r.txRows).toHaveLength(1)
    const row = r.txRows[0]!
    expect(row.txId).toBe('t1')
    expect(row.matches.map((m) => m.ruleId)).toEqual(['rNarrow', 'rWide'])
    expect(row.matches[0]!.isWinner).toBe(true)
    expect(row.matches[1]!.isWinner).toBe(false)
    expect(r.pairCounts).toEqual([
      { winnerRuleId: 'rNarrow', shadowedRuleId: 'rWide', txCount: 1 },
    ])
    expect(r.perRule.get('rNarrow')).toEqual({ matched: 1, winner: 1, shadowed: 0 })
    expect(r.perRule.get('rWide')).toEqual({ matched: 1, winner: 0, shadowed: 1 })
  })

  it('breaks sort_order ties by id.localeCompare', () => {
    const r = buildAccountingRuleOverlapReport(
      [
        rule({ id: 'b', sort_order: 0, criteria: counterpartyContains('a') }),
        rule({ id: 'a', sort_order: 0, criteria: counterpartyContains('a') }),
      ],
      [tx({ id: 't1', counterparty_name: 'Acme' })],
    )
    const row = r.txRows[0]!
    expect(row.matches.map((m) => m.ruleId)).toEqual(['a', 'b'])
    expect(row.matches[0]!.isWinner).toBe(true)
  })

  it('excludes disabled rules by default', () => {
    const r = buildAccountingRuleOverlapReport(
      [
        rule({ id: 'r1', sort_order: 1, criteria: counterpartyContains('acme') }),
        rule({ id: 'r2', sort_order: 2, enabled: false, criteria: counterpartyContains('acme') }),
      ],
      [tx({ id: 't1', counterparty_name: 'Acme Co' })],
    )
    expect(r.overlappingTxCount).toBe(0)
    expect(r.perRule.has('r2')).toBe(false)
    expect(r.perRule.get('r1')).toEqual({ matched: 1, winner: 1, shadowed: 0 })
  })

  it('includes disabled rules when includeDisabled is true', () => {
    const r = buildAccountingRuleOverlapReport(
      [
        rule({ id: 'r1', sort_order: 1, criteria: counterpartyContains('acme') }),
        rule({ id: 'r2', sort_order: 2, enabled: false, criteria: counterpartyContains('acme') }),
      ],
      [tx({ id: 't1', counterparty_name: 'Acme Co' })],
      { includeDisabled: true },
    )
    expect(r.overlappingTxCount).toBe(1)
    expect(r.perRule.get('r2')).toEqual({ matched: 1, winner: 0, shadowed: 1 })
  })

  it('excludes rules with null or empty criteria', () => {
    const r = buildAccountingRuleOverlapReport(
      [
        rule({ id: 'rOk', sort_order: 1, criteria: counterpartyContains('acme') }),
        rule({ id: 'rNull', sort_order: 0, criteria: null }),
        rule({ id: 'rEmpty', sort_order: 0, criteria: { v: 1 } }),
        rule({
          id: 'rWhitespace',
          sort_order: 0,
          criteria: { v: 1, counterparty: { op: 'contains', value: '  ' } },
        }),
      ],
      [tx({ id: 't1', counterparty_name: 'Acme Co' })],
    )
    expect(r.overlappingTxCount).toBe(0)
    expect(r.perRule.has('rNull')).toBe(false)
    expect(r.perRule.has('rEmpty')).toBe(false)
    expect(r.perRule.has('rWhitespace')).toBe(false)
    expect(r.perRule.get('rOk')).toEqual({ matched: 1, winner: 1, shadowed: 0 })
  })

  it('records a (winner, shadowed) entry for every pair when 3+ rules match the same tx', () => {
    const r = buildAccountingRuleOverlapReport(
      [
        rule({ id: 'rA', sort_order: 1, criteria: counterpartyContains('acme') }),
        rule({ id: 'rB', sort_order: 2, criteria: counterpartyContains('acme') }),
        rule({ id: 'rC', sort_order: 3, criteria: counterpartyContains('acme') }),
      ],
      [tx({ id: 't1', counterparty_name: 'Acme' })],
    )
    expect(r.overlappingTxCount).toBe(1)
    const row = r.txRows[0]!
    expect(row.matches.map((m) => m.ruleId)).toEqual(['rA', 'rB', 'rC'])
    expect(row.matches[0]!.isWinner).toBe(true)
    expect(row.matches.slice(1).every((m) => !m.isWinner)).toBe(true)
    expect(r.pairCounts).toEqual([
      { winnerRuleId: 'rA', shadowedRuleId: 'rB', txCount: 1 },
      { winnerRuleId: 'rA', shadowedRuleId: 'rC', txCount: 1 },
    ])
    expect(r.perRule.get('rA')).toEqual({ matched: 1, winner: 1, shadowed: 0 })
    expect(r.perRule.get('rB')).toEqual({ matched: 1, winner: 0, shadowed: 1 })
    expect(r.perRule.get('rC')).toEqual({ matched: 1, winner: 0, shadowed: 1 })
  })

  it('aggregates pairCounts across multiple txs and sorts desc by count', () => {
    const r = buildAccountingRuleOverlapReport(
      [
        rule({ id: 'rA', sort_order: 1, criteria: counterpartyContains('acme') }),
        rule({ id: 'rB', sort_order: 2, criteria: counterpartyContains('acme') }),
        rule({ id: 'rC', sort_order: 3, criteria: counterpartyContains('shell') }),
        rule({ id: 'rD', sort_order: 4, criteria: counterpartyContains('shell') }),
      ],
      [
        tx({ id: 't1', counterparty_name: 'Acme One' }),
        tx({ id: 't2', counterparty_name: 'Acme Two' }),
        tx({ id: 't3', counterparty_name: 'Shell One' }),
      ],
    )
    expect(r.pairCounts).toEqual([
      { winnerRuleId: 'rA', shadowedRuleId: 'rB', txCount: 2 },
      { winnerRuleId: 'rC', shadowedRuleId: 'rD', txCount: 1 },
    ])
  })

  it('flags assignment-vs-winner conflicts and includes single-match conflict txs in txRows', () => {
    const r = buildAccountingRuleOverlapReport(
      [rule({ id: 'r1', label_id: 'label-Y', criteria: counterpartyContains('shell') })],
      [tx({ id: 't1', counterparty_name: 'Shell Gas' })],
      { assignmentLabelByTxId: new Map([['t1', 'label-X']]) },
    )
    expect(r.overlappingTxCount).toBe(0)
    expect(r.conflictTxCount).toBe(1)
    expect(r.txRows).toHaveLength(1)
    expect(r.txRows[0]!.conflictWithAssignedLabelId).toBe('label-X')
    expect(r.txRows[0]!.matches[0]!.labelId).toBe('label-Y')
  })

  it('does not flag a conflict when winning rule labels match the assignment', () => {
    const r = buildAccountingRuleOverlapReport(
      [rule({ id: 'r1', label_id: 'label-X', criteria: counterpartyContains('shell') })],
      [tx({ id: 't1', counterparty_name: 'Shell Gas' })],
      { assignmentLabelByTxId: new Map([['t1', 'label-X']]) },
    )
    expect(r.conflictTxCount).toBe(0)
    expect(r.txRows).toEqual([])
  })

  it('flags a conflict on an overlapping tx when winner disagrees with the assignment', () => {
    const r = buildAccountingRuleOverlapReport(
      [
        rule({ id: 'rA', sort_order: 1, label_id: 'label-Y', criteria: counterpartyContains('acme') }),
        rule({ id: 'rB', sort_order: 2, label_id: 'label-Z', criteria: counterpartyContains('acme') }),
      ],
      [tx({ id: 't1', counterparty_name: 'Acme Co' })],
      { assignmentLabelByTxId: new Map([['t1', 'label-X']]) },
    )
    expect(r.overlappingTxCount).toBe(1)
    expect(r.conflictTxCount).toBe(1)
    expect(r.txRows[0]!.conflictWithAssignedLabelId).toBe('label-X')
    expect(r.txRows[0]!.matches[0]!.ruleId).toBe('rA')
  })
})
