// @vitest-environment jsdom
// (localStorage-backed helpers; the global vitest environment is node)
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  PEOPLE_OVERHEAD_TABLE_SIMPLE_VIEW_KEY,
  readOverheadTableSimpleViewFromStorage,
  writeOverheadTableSimpleViewToStorage,
} from './overheadTableViewStorage'

afterEach(() => {
  localStorage.clear()
  vi.restoreAllMocks()
})

describe('overheadTableViewStorage', () => {
  it('defaults to Advanced (false) when nothing is stored', () => {
    expect(readOverheadTableSimpleViewFromStorage()).toBe(false)
  })

  it('round-trips Simple (true) and Advanced (false)', () => {
    writeOverheadTableSimpleViewToStorage(true)
    expect(localStorage.getItem(PEOPLE_OVERHEAD_TABLE_SIMPLE_VIEW_KEY)).toBe('1')
    expect(readOverheadTableSimpleViewFromStorage()).toBe(true)

    writeOverheadTableSimpleViewToStorage(false)
    expect(localStorage.getItem(PEOPLE_OVERHEAD_TABLE_SIMPLE_VIEW_KEY)).toBe('0')
    expect(readOverheadTableSimpleViewFromStorage()).toBe(false)
  })

  it('treats any non-"1" stored value as Advanced', () => {
    localStorage.setItem(PEOPLE_OVERHEAD_TABLE_SIMPLE_VIEW_KEY, 'yes')
    expect(readOverheadTableSimpleViewFromStorage()).toBe(false)
  })

  it('read swallows storage exceptions (private mode) and returns the default', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('denied')
    })
    expect(readOverheadTableSimpleViewFromStorage()).toBe(false)
  })

  it('write swallows storage exceptions (quota / private mode)', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota')
    })
    expect(() => writeOverheadTableSimpleViewToStorage(true)).not.toThrow()
  })
})
