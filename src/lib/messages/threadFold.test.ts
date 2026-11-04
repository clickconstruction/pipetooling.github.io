import { describe, expect, it } from 'vitest'
import { isThreadFolded, isThreadShort, reachOpen, THREAD_FOLD_PX, THREAD_SHORT_PX, THREAD_SHORT_QUERY } from './threadFold'

describe('the thread header folds for a narrow column (Messages cut 10)', () => {
  it('folds at 640 px of column or less, and always on a phone', () => {
    expect(THREAD_FOLD_PX).toBe(640)
    expect(isThreadFolded(640, false)).toBe(true)
    expect(isThreadFolded(375, false)).toBe(true)
    expect(isThreadFolded(641, false)).toBe(false)
    expect(isThreadFolded(1100, true)).toBe(true)
  })

  it('reads an unmeasured column as wide', () => {
    expect(isThreadFolded(null, false)).toBe(false)
    expect(isThreadFolded(0, false)).toBe(false)
    expect(isThreadFolded(null, true)).toBe(true)
  })

  it('opens their numbers at a desk and folds them away on a narrow header, until the arrow says otherwise', () => {
    expect(reachOpen(null, false)).toBe(true)
    expect(reachOpen(null, true)).toBe(false)
    expect(reachOpen(true, true)).toBe(true)
    expect(reachOpen(false, false)).toBe(false)
  })
})

describe('the thread folds by height on a short window (v2.6474)', () => {
  it('folds under 820 px of window height, at a desk only', () => {
    expect(THREAD_SHORT_PX).toBe(820)
    expect(THREAD_SHORT_QUERY).toBe('(max-height: 819.98px)')
    expect(isThreadShort(true, false)).toBe(true)
    expect(isThreadShort(false, false)).toBe(false)
    expect(isThreadShort(true, true)).toBe(false)
  })
})
