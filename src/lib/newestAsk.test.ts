import { describe, expect, it } from 'vitest'
import { newestAsk } from './newestAsk'

describe('newestAsk', () => {
  it('a lone ask is the newest', () => {
    const asks = newestAsk()
    const first = asks.next()
    expect(first()).toBe(true)
  })

  it('an ask stops being the newest when a later one starts, and stays stopped', () => {
    const asks = newestAsk()
    const first = asks.next()
    const second = asks.next()
    expect(first()).toBe(false)
    expect(second()).toBe(true)
    const third = asks.next()
    expect(first()).toBe(false)
    expect(second()).toBe(false)
    expect(third()).toBe(true)
  })

  it('two lists keep their own count', () => {
    const a = newestAsk()
    const b = newestAsk()
    const fromA = a.next()
    b.next()
    b.next()
    expect(fromA()).toBe(true)
  })
})
