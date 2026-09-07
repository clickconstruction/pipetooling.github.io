import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { DEFAULT_MERCURY_LEDGER_SORT } from './bankingMercuryLedgerTableSort'
import {
  clearAccountingLedgerFiltersStorage,
  readAccountingApplyRulesByDefault,
  readAccountingApprovalsGroupByLabel,
  readAccountingHideLabeledTransactions,
  readAccountingLedgerFiltersRaw,
  readAccountingLedgerSort,
  readAccountingRulesSectionExpanded,
  readDragSortHideLabeledTransactions,
  readDragSortLabelsCardsExpanded,
  readDragSortLabelsReorderMode,
  readUserReviewChartView,
  writeAccountingApplyRulesByDefault,
  writeAccountingApprovalsGroupByLabel,
  writeAccountingHideLabeledTransactions,
  writeAccountingLedgerFiltersRaw,
  writeAccountingLedgerSort,
  writeAccountingRulesSectionExpanded,
  writeDragSortHideLabeledTransactions,
  writeDragSortLabelsCardsExpanded,
  writeDragSortLabelsReorderMode,
  writeUserReviewChartView,
} from './bankingDragSortStorage'

// The node test environment has no window; a Map-backed stand-in is installed per test.
const g = globalThis as unknown as { window?: unknown }
let store: Map<string, string>
let throwing = false
function installWindow() {
  g.window = {
    localStorage: {
      getItem: (k: string) => { if (throwing) throw new Error('blocked'); return store.has(k) ? store.get(k)! : null },
      setItem: (k: string, v: string) => { if (throwing) throw new Error('blocked'); store.set(k, String(v)) },
      removeItem: (k: string) => { if (throwing) throw new Error('blocked'); store.delete(k) },
    },
  }
}
beforeEach(() => { store = new Map(); throwing = false; installWindow() })
afterEach(() => { delete g.window })

const U = 'user-1'

describe('opt-in flags (absent = off, "1" = on)', () => {
  it.each([
    ['Drag Sort hide labeled', readDragSortHideLabeledTransactions, writeDragSortHideLabeledTransactions, 'banking_drag_sort_hide_labeled_v1_'],
    ['Drag Sort reorder mode', readDragSortLabelsReorderMode, writeDragSortLabelsReorderMode, 'banking_drag_sort_reorder_labels_v1_'],
    ['Accounting apply rules by default', readAccountingApplyRulesByDefault, writeAccountingApplyRulesByDefault, 'banking_accounting_apply_rules_default_v1_'],
    ['Accounting approvals grouped', readAccountingApprovalsGroupByLabel, writeAccountingApprovalsGroupByLabel, 'banking_accounting_approvals_group_by_label_v1_'],
  ] as const)('%s', (_name, read, write, prefix) => {
    expect(read(U)).toBe(false)
    write(U, true)
    expect(store.get(prefix + U)).toBe('1')
    expect(read(U)).toBe(true)
    expect(read('user-2')).toBe(false) // per user
    write(U, false)
    expect(store.has(prefix + U)).toBe(false)
    expect(read(U)).toBe(false)
    store.set(prefix + U, 'yes')
    expect(read(U)).toBe(false) // only the literal "1" counts
  })
})

describe('opt-out flags (absent = on, "0" = off; legacy "1" still reads on)', () => {
  it.each([
    ['Drag Sort label cards expanded', readDragSortLabelsCardsExpanded, writeDragSortLabelsCardsExpanded, 'banking_drag_sort_labels_cards_expanded_v1_'],
    ['Accounting hide labeled', readAccountingHideLabeledTransactions, writeAccountingHideLabeledTransactions, 'banking_accounting_hide_labeled_v1_'],
    ['Accounting rules section expanded', readAccountingRulesSectionExpanded, writeAccountingRulesSectionExpanded, 'banking_accounting_rules_section_expanded_v1_'],
  ] as const)('%s', (_name, read, write, prefix) => {
    expect(read(U)).toBe(true)
    write(U, false)
    expect(store.get(prefix + U)).toBe('0')
    expect(read(U)).toBe(false)
    expect(read('user-2')).toBe(true)
    write(U, true)
    expect(store.has(prefix + U)).toBe(false)
    expect(read(U)).toBe(true)
    store.set(prefix + U, '1')
    expect(read(U)).toBe(true)
  })
})

describe('Accounting ledger filters (raw JSON)', () => {
  it('stores whatever JSON it is given; empty or null clears', () => {
    expect(readAccountingLedgerFiltersRaw(U)).toBeNull()
    writeAccountingLedgerFiltersRaw(U, '{"kind":"card"}')
    expect(readAccountingLedgerFiltersRaw(U)).toBe('{"kind":"card"}')
    writeAccountingLedgerFiltersRaw(U, '')
    expect(readAccountingLedgerFiltersRaw(U)).toBeNull()
    writeAccountingLedgerFiltersRaw(U, '{"a":1}')
    clearAccountingLedgerFiltersStorage(U)
    expect(store.size).toBe(0)
  })
})

describe('Accounting ledger sort', () => {
  it('defaults, stores only a non-default state, and parses what it stored', () => {
    expect(readAccountingLedgerSort(U)).toEqual(DEFAULT_MERCURY_LEDGER_SORT)
    writeAccountingLedgerSort(U, { key: 'amount', dir: 'asc' })
    expect(store.get('banking_accounting_ledger_sort_v1_' + U)).toBe('{"key":"amount","dir":"asc"}')
    expect(readAccountingLedgerSort(U)).toEqual({ key: 'amount', dir: 'asc' })
    writeAccountingLedgerSort(U, DEFAULT_MERCURY_LEDGER_SORT)
    expect(store.size).toBe(0)
  })
  it('malformed stored JSON reads as the default', () => {
    store.set('banking_accounting_ledger_sort_v1_' + U, '{oops')
    expect(readAccountingLedgerSort(U)).toEqual(DEFAULT_MERCURY_LEDGER_SORT)
  })
})

describe('Card Review chart view (device-global, migrated key)', () => {
  const KEY = 'banking_mercury_card_review_chart_view_v1'
  const LEGACY = 'banking_mercury_user_review_chart_view_v1'
  it('defaults to table; pie is stored, table clears', () => {
    expect(readUserReviewChartView()).toBe('table')
    writeUserReviewChartView('pie')
    expect(store.get(KEY)).toBe('pie')
    expect(readUserReviewChartView()).toBe('pie')
    writeUserReviewChartView('table')
    expect(store.has(KEY)).toBe(false)
  })
  it('migrates a value under the old user_review key on first read', () => {
    store.set(LEGACY, 'pie')
    expect(readUserReviewChartView()).toBe('pie')
    expect(store.get(KEY)).toBe('pie')
    expect(store.has(LEGACY)).toBe(false)
  })
  it('anything but "pie" is table', () => {
    store.set(KEY, 'bar')
    expect(readUserReviewChartView()).toBe('table')
  })
})

describe('no window / blocked storage', () => {
  it('every read returns its default and every write is a no-op without a window', () => {
    delete g.window
    expect(readDragSortHideLabeledTransactions(U)).toBe(false)
    expect(readDragSortLabelsCardsExpanded(U)).toBe(true)
    expect(readAccountingHideLabeledTransactions(U)).toBe(true)
    expect(readAccountingLedgerFiltersRaw(U)).toBeNull()
    expect(readAccountingLedgerSort(U)).toEqual(DEFAULT_MERCURY_LEDGER_SORT)
    expect(readUserReviewChartView()).toBe('table')
    expect(() => {
      writeDragSortHideLabeledTransactions(U, true)
      writeAccountingLedgerSort(U, { key: 'amount', dir: 'asc' })
      writeUserReviewChartView('pie')
    }).not.toThrow()
    expect(store.size).toBe(0)
  })
  it('a storage that throws (private mode) reads as defaults and swallows writes', () => {
    throwing = true
    expect(readDragSortHideLabeledTransactions(U)).toBe(false)
    expect(readDragSortLabelsCardsExpanded(U)).toBe(true)
    expect(readAccountingLedgerSort(U)).toEqual(DEFAULT_MERCURY_LEDGER_SORT)
    expect(readUserReviewChartView()).toBe('table')
    expect(() => {
      writeDragSortLabelsReorderMode(U, true)
      writeAccountingLedgerFiltersRaw(U, '{}')
      writeUserReviewChartView('pie')
    }).not.toThrow()
  })
})
