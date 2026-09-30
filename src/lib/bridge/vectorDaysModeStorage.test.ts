// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest'
import { readVectorDaysMode, VECTOR_DAYS_MODE_KEY, writeVectorDaysMode } from './vectorDaysModeStorage'

describe('vectorDaysModeStorage', () => {
  beforeEach(() => localStorage.clear())
  it('reads recorded by default and remembers approved', () => {
    expect(readVectorDaysMode()).toBe('recorded')
    writeVectorDaysMode('approved')
    expect(localStorage.getItem(VECTOR_DAYS_MODE_KEY)).toBe('approved')
    expect(readVectorDaysMode()).toBe('approved')
    writeVectorDaysMode('recorded')
    expect(readVectorDaysMode()).toBe('recorded')
  })
  it('an unknown stored value reads recorded', () => {
    localStorage.setItem(VECTOR_DAYS_MODE_KEY, 'whatever')
    expect(readVectorDaysMode()).toBe('recorded')
  })
})
