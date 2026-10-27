// @vitest-environment jsdom
/**
 * Render smoke for Banking → Accounting → Rules (punch list #184, sweep A, PR 2): the Apply
 * button says the preflight's count while the window is open, and is dead only when nothing
 * new matches.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen } from '@testing-library/react'
import { renderWithProviders } from '../../test/renderSmokeMocks'
import { BankingMercuryAccountingRulesModal, type BankingMercuryAccountingRulesModalProps } from './BankingMercuryAccountingRulesModal'

afterEach(cleanup)

function props(over: Partial<BankingMercuryAccountingRulesModalProps> = {}): BankingMercuryAccountingRulesModalProps {
  return {
    open: true,
    onClose: () => {},
    rulesLoading: false,
    rules: [],
    rulesFilteredForTable: [],
    rulesSortedForTable: [],
    rulesSearchNorm: '',
    rulesTableSearchText: '',
    setRulesTableSearchText: () => {},
    rulesTableSort: { column: 'none', direction: 'asc' },
    onRulesSortHeaderClick: () => {},
    labelById: new Map(),
    ruleAttributionNameById: new Map(),
    ruleUsageApproved: {},
    labelsLoading: false,
    labelCount: 1,
    applyRulesBusy: false,
    onNewRule: () => {},
    onAuditOverlaps: () => {},
    onApplyRules: vi.fn(),
    onEditRule: () => {},
    onDeleteRule: () => {},
    ...over,
  }
}

describe('the Rules window’s Apply', () => {
  it('says how many suggestions the press makes', () => {
    const p = props({ applyMatches: 37, applyCap: 500 })
    renderWithProviders(<BankingMercuryAccountingRulesModal {...p} />)
    fireEvent.click(screen.getByRole('button', { name: 'Apply rules · 37 matches' }))
    expect(p.onApplyRules).toHaveBeenCalledTimes(1)
  })
  it('above the cap, says what one press makes', () => {
    renderWithProviders(<BankingMercuryAccountingRulesModal {...props({ applyMatches: 1240, applyCap: 500 })} />)
    expect(screen.getByRole('button', { name: 'Apply rules · 500 of 1,240 matches' })).toBeTruthy()
  })
  it('is dead when nothing new matches', () => {
    renderWithProviders(<BankingMercuryAccountingRulesModal {...props({ applyMatches: 0 })} />)
    expect(screen.getByRole('button', { name: 'Apply rules · no new matches' }).hasAttribute('disabled')).toBe(true)
  })
  it('keeps the plain label while the count is not in yet', () => {
    renderWithProviders(<BankingMercuryAccountingRulesModal {...props({ applyMatches: null })} />)
    expect(screen.getByRole('button', { name: 'Apply rules to transactions' }).hasAttribute('disabled')).toBe(false)
  })
})
