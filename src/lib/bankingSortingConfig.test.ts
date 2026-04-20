import { describe, expect, it } from 'vitest'
import { bankSortingConfigsFilterEqual, defaultBankingSortingConfig } from './bankingSortingConfig'

describe('bankSortingConfigsFilterEqual', () => {
  it('returns true when only array order differs', () => {
    const base = defaultBankingSortingConfig()
    const a = { ...base, kinds: ['fee', 'bar'] }
    const b = { ...base, kinds: ['bar', 'fee'] }
    expect(bankSortingConfigsFilterEqual(a, b)).toBe(true)
  })

  it('returns false when startDateYmd differs', () => {
    const a = defaultBankingSortingConfig()
    const b = { ...a, startDateYmd: '2020-01-01' }
    expect(bankSortingConfigsFilterEqual(a, b)).toBe(false)
  })
})
