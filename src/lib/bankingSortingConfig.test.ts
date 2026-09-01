import { describe, expect, it } from 'vitest'
import {
  bankSortingConfigsFilterEqual,
  defaultBankingSortingConfig,
  resolveSortingConfigAfterFetch,
} from './bankingSortingConfig'

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

describe('resolveSortingConfigAfterFetch', () => {
  const fetched = { ...defaultBankingSortingConfig(), kinds: ['checkDeposit'] }
  const legacyLocal = { ...defaultBankingSortingConfig(), kinds: ['other'] }

  it('adopts and caches the org row when the row was read', () => {
    const r = resolveSortingConfigAfterFetch({ outcome: 'row', fetched, legacyLocal, orgCachePresent: false })
    expect(r).toEqual({ config: fetched, saveCache: true, migrateUpsert: false })
  })

  it('migrates legacy local only on a confirmed missing row', () => {
    const r = resolveSortingConfigAfterFetch({ outcome: 'no-row', fetched, legacyLocal, orgCachePresent: false })
    expect(r).toEqual({ config: legacyLocal, saveCache: true, migrateUpsert: true })
  })

  it('never migrates or caches on a failed read', () => {
    const withCache = resolveSortingConfigAfterFetch({ outcome: 'error', fetched, legacyLocal, orgCachePresent: true })
    const withoutCache = resolveSortingConfigAfterFetch({ outcome: 'error', fetched, legacyLocal, orgCachePresent: false })
    expect(withCache).toEqual({ config: null, saveCache: false, migrateUpsert: false })
    expect(withoutCache).toEqual({ config: legacyLocal, saveCache: false, migrateUpsert: false })
  })
})
