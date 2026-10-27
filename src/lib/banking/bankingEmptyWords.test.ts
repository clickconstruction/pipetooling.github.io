import { describe, expect, it, vi } from 'vitest'
import { ACCOUNTING_LABELS_PATH, BANKING_FILTERS_HIDE_ALL, bankingTableEmptyWords, NO_TRANSACTIONS_YET, NOTHING_WAITING_FOR_A_LABEL } from './bankingEmptyWords'
import { plainWordsFailures } from '../plainWords'

describe('bankingTableEmptyWords', () => {
  it('a Banking filter hides every row: Clear the filters resets them', () => {
    const clear = vi.fn()
    expect(bankingTableEmptyWords({ clearBankingFilters: clear, unlabeledOnly: true })).toEqual({ main: BANKING_FILTERS_HIDE_ALL, next: { label: 'Clear the filters', onPress: clear } })
  })

  it('no filter on: the unlabeled view is the good state, the full view has no rows yet', () => {
    expect(bankingTableEmptyWords({ clearBankingFilters: null, unlabeledOnly: true })).toEqual({ main: NOTHING_WAITING_FOR_A_LABEL })
    expect(bankingTableEmptyWords({ clearBankingFilters: null, unlabeledOnly: false })).toEqual({ main: NO_TRANSACTIONS_YET })
  })

  it('labels are made on the Drag Sort tab, and every sentence reads in plain words', () => {
    expect(ACCOUNTING_LABELS_PATH).toBe('/banking?tab=drag_sort')
    for (const s of [BANKING_FILTERS_HIDE_ALL, NOTHING_WAITING_FOR_A_LABEL, NO_TRANSACTIONS_YET]) expect(plainWordsFailures(s), s).toEqual([])
  })
})
