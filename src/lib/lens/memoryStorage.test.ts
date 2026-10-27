import { describe, expect, it } from 'vitest'
import { memoryStorage } from './memoryStorage'

describe('memory storage', () => {
  it('reads and writes by method, by property and by Object.keys, as Storage does', () => {
    const s = memoryStorage({ themeOverride: 'dark' })
    expect(s.getItem('themeOverride')).toBe('dark')
    s.setItem('a', '1')
    ;(s as unknown as Record<string, string>).b = '2'
    expect(s.getItem('b')).toBe('2')
    expect((s as unknown as Record<string, string>).a).toBe('1')
    expect(Object.keys(s).sort()).toEqual(['a', 'b', 'themeOverride'])
    expect(s.length).toBe(3)
    expect(s.key(0)).toBe('themeOverride')
    s.removeItem('a')
    expect(s.getItem('a')).toBeNull()
    s.clear()
    expect(s.length).toBe(0)
  })

  it('stores strings, as Storage does', () => {
    const s = memoryStorage()
    s.setItem('n', 5 as unknown as string)
    expect(s.getItem('n')).toBe('5')
  })
})
