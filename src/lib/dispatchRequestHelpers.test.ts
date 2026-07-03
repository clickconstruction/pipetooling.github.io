import { describe, expect, it } from 'vitest'
import { buildUnbilledDispatchTitle } from './dispatchRequestHelpers'

describe('buildUnbilledDispatchTitle', () => {
  it('composes context + note', () => {
    expect(buildUnbilledDispatchTitle('500 · Smith House', 12345.67, 'Please bill this week')).toBe(
      'Not billed out: 500 · Smith House — $12,345.67. Please bill this week',
    )
  })

  it('omits the note sentence when empty/whitespace', () => {
    expect(buildUnbilledDispatchTitle('500 · Smith House', 1000, '   ')).toBe(
      'Not billed out: 500 · Smith House — $1,000.00',
    )
  })

  it('clips to the 2000-char title constraint', () => {
    const out = buildUnbilledDispatchTitle('500 · Smith House', 1000, 'x'.repeat(3000))
    expect(out.length).toBe(2000)
    expect(out.endsWith('…')).toBe(true)
  })
})
