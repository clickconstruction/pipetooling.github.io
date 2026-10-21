import { describe, expect, it } from 'vitest'
import { plainWordsFailures } from '../plainWords'
import { deliveryMark, deliveryOf } from './thread'

describe('deliveryMark (v2.5703, punch list #139)', () => {
  it('reads Quo’s answer on a text of ours, and nothing on anything else', () => {
    expect(deliveryMark({ direction: 'out', channel: 'text', delivery: 'delivered' })).toEqual({ words: '✓ delivered', bad: false, title: 'Quo delivered it to their phone.' })
    expect(deliveryMark({ direction: 'out', channel: 'text', delivery: 'failed' })).toMatchObject({ words: '⚠ not sent', bad: true })
    expect(deliveryMark({ direction: 'out', channel: 'text', delivery: 'undelivered' })).toMatchObject({ words: '⚠ not delivered', bad: true })
    expect(deliveryMark({ direction: 'out', channel: 'text', delivery: null })).toBeNull()
    expect(deliveryMark({ direction: 'in', channel: 'text', delivery: 'delivered' })).toBeNull()
    expect(deliveryMark({ direction: 'out', channel: 'email', delivery: 'delivered' })).toBeNull()
  })
  it('a row’s raw value reads as one of the three, else as no answer', () => {
    expect(deliveryOf('delivered')).toBe('delivered')
    expect(deliveryOf('failed')).toBe('failed')
    expect(deliveryOf('undelivered')).toBe('undelivered')
    expect(deliveryOf('queued')).toBeNull()
    expect(deliveryOf(null)).toBeNull()
    expect(deliveryOf(undefined)).toBeNull()
  })
  it('the hover words are plain', () => {
    for (const d of ['delivered', 'failed', 'undelivered'] as const) {
      const m = deliveryMark({ direction: 'out', channel: 'text', delivery: d })!
      expect(plainWordsFailures(m.title), m.title).toEqual([])
    }
  })
})
