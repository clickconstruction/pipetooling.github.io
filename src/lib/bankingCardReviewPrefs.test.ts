import { describe, it, expect } from 'vitest'
import {
  CARD_REVIEW_KIND_ALL,
  CARD_REVIEW_KIND_CARD_ONLY,
  CARD_REVIEW_STORAGE_KEYS,
  buildCardReviewKindOptions,
  filterCardReviewRowsByKind,
  normalizeCardReviewKindFilter,
  readMigratedStorageItem,
  type StorageLike,
} from './bankingCardReviewPrefs'

const rows = [
  { id: 'a', kind: 'debitCardTransaction' },
  { id: 'b', kind: 'externalTransfer' },
  { id: 'c', kind: 'internalTransfer' },
  { id: 'd', kind: 'debitCardTransaction' },
  { id: 'e', kind: 'outgoingPayment' },
  { id: 'f', kind: '' },
  { id: 'g', kind: null },
]

describe('buildCardReviewKindOptions', () => {
  it('leads with All kinds, offers Card charges only when a card kind is present, then distinct kinds by label', () => {
    const opts = buildCardReviewKindOptions(rows)
    expect(opts[0]).toEqual({ value: CARD_REVIEW_KIND_ALL, label: 'All kinds' })
    expect(opts[1]).toEqual({ value: CARD_REVIEW_KIND_CARD_ONLY, label: 'Card charges only' })
    expect(opts.slice(2).map((o) => o.value)).toEqual([
      'debitCardTransaction', // label "Debit Card" sorts before the raw strings
      'externalTransfer',
      'internalTransfer',
      'outgoingPayment',
    ])
    expect(opts.find((o) => o.value === 'debitCardTransaction')?.label).toBe('Debit Card')
  })

  it('skips empty/null kinds and omits Card charges only when no card kind is in the window', () => {
    const opts = buildCardReviewKindOptions([{ kind: 'externalTransfer' }, { kind: null }, { kind: '  ' }])
    expect(opts.map((o) => o.value)).toEqual([CARD_REVIEW_KIND_ALL, 'externalTransfer'])
  })

  it('returns only All kinds for an empty window', () => {
    expect(buildCardReviewKindOptions([])).toEqual([{ value: CARD_REVIEW_KIND_ALL, label: 'All kinds' }])
  })
})

describe('filterCardReviewRowsByKind', () => {
  it('returns the same array for All kinds (no work, stable identity for memos)', () => {
    expect(filterCardReviewRowsByKind(rows, CARD_REVIEW_KIND_ALL)).toBe(rows)
  })

  it('Card charges only drops transfers, payouts and unknown kinds — the J33-adj-2 "Unassigned" fix', () => {
    expect(filterCardReviewRowsByKind(rows, CARD_REVIEW_KIND_CARD_ONLY).map((r) => r.id)).toEqual(['a', 'd'])
  })

  it('a specific kind keeps exactly that kind', () => {
    expect(filterCardReviewRowsByKind(rows, 'internalTransfer').map((r) => r.id)).toEqual(['c'])
    expect(filterCardReviewRowsByKind(rows, 'checkDeposit')).toEqual([])
  })
})

describe('normalizeCardReviewKindFilter', () => {
  const opts = buildCardReviewKindOptions(rows)

  it('keeps a stored value that is still an option', () => {
    expect(normalizeCardReviewKindFilter(CARD_REVIEW_KIND_CARD_ONLY, opts)).toBe(CARD_REVIEW_KIND_CARD_ONLY)
    expect(normalizeCardReviewKindFilter('externalTransfer', opts)).toBe('externalTransfer')
  })

  it('falls back to All kinds for null, a kind that left the window, or garbage', () => {
    expect(normalizeCardReviewKindFilter(null, opts)).toBe(CARD_REVIEW_KIND_ALL)
    expect(normalizeCardReviewKindFilter(undefined, opts)).toBe(CARD_REVIEW_KIND_ALL)
    expect(normalizeCardReviewKindFilter('checkDeposit', opts)).toBe(CARD_REVIEW_KIND_ALL)
    expect(normalizeCardReviewKindFilter('<script>', opts)).toBe(CARD_REVIEW_KIND_ALL)
  })

  it('Card charges only is not an option when no card kinds exist, so it normalizes away', () => {
    const noCards = buildCardReviewKindOptions([{ kind: 'externalTransfer' }])
    expect(normalizeCardReviewKindFilter(CARD_REVIEW_KIND_CARD_ONLY, noCards)).toBe(CARD_REVIEW_KIND_ALL)
  })
})

function fakeStorage(initial: Record<string, string> = {}): StorageLike & { data: Map<string, string> } {
  const data = new Map(Object.entries(initial))
  return {
    data,
    getItem: (k) => (data.has(k) ? data.get(k)! : null),
    setItem: (k, v) => void data.set(k, v),
    removeItem: (k) => void data.delete(k),
  }
}

describe('readMigratedStorageItem', () => {
  const { key, legacy } = CARD_REVIEW_STORAGE_KEYS.timeWindow

  it('moves a legacy user_review value to the card_review key once and removes the old key', () => {
    const s = fakeStorage({ [legacy]: 'last_90_days' })
    expect(readMigratedStorageItem(s, key, legacy)).toBe('last_90_days')
    expect(s.data.get(key)).toBe('last_90_days')
    expect(s.data.has(legacy)).toBe(false)
    // second read is a plain read of the new key
    expect(readMigratedStorageItem(s, key, legacy)).toBe('last_90_days')
  })

  it('a value under the new key wins over a stale legacy value', () => {
    const s = fakeStorage({ [key]: 'this_week', [legacy]: 'all' })
    expect(readMigratedStorageItem(s, key, legacy)).toBe('this_week')
    expect(s.data.get(legacy)).toBe('all') // left alone — only an unset new key triggers the move
  })

  it('returns null when neither key is set, when there is no legacy key, or when storage is unavailable', () => {
    expect(readMigratedStorageItem(fakeStorage(), key, legacy)).toBeNull()
    expect(readMigratedStorageItem(fakeStorage({ old: 'x' }), CARD_REVIEW_STORAGE_KEYS.kindFilter.key, null)).toBeNull()
    expect(readMigratedStorageItem(null, key, legacy)).toBeNull()
    expect(readMigratedStorageItem(undefined, key, legacy)).toBeNull()
  })

  it('never throws — a storage that throws reads as unset', () => {
    const throwing: StorageLike = {
      getItem: () => {
        throw new Error('SecurityError')
      },
      setItem: () => {
        throw new Error('QuotaExceeded')
      },
      removeItem: () => {},
    }
    expect(readMigratedStorageItem(throwing, key, legacy)).toBeNull()
  })

  it('every migrated key pair really changed name (guards a copy-paste that keeps the old key)', () => {
    for (const pair of Object.values(CARD_REVIEW_STORAGE_KEYS)) {
      expect(pair.key).toMatch(/card_review/)
      if (pair.legacy) expect(pair.legacy).toMatch(/user_review/)
      expect(pair.key).not.toBe(pair.legacy)
    }
  })
})
