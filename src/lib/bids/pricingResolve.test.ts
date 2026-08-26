import { describe, expect, it } from 'vitest'
import {
  IDLE_PRICING_RESOLVE,
  beginPricingResolve,
  pricingResolvePanel,
  settlePricingResolve,
} from './pricingResolve'

describe('pricingResolve', () => {
  it('begins loading for a bid', () => {
    expect(beginPricingResolve('b1')).toEqual({ bidId: 'b1', status: 'loading' })
  })

  it('settles to ready on success and error on failure', () => {
    const loading = beginPricingResolve('b1')
    expect(settlePricingResolve(loading, 'b1', true)).toEqual({ bidId: 'b1', status: 'ready' })
    expect(settlePricingResolve(loading, 'b1', false)).toEqual({ bidId: 'b1', status: 'error' })
  })

  it('ignores a late settle for a bid the user already left', () => {
    const loading = beginPricingResolve('b2')
    expect(settlePricingResolve(loading, 'b1', true)).toBe(loading)
  })

  it('returns the same reference when re-settling to the same status', () => {
    const ready = settlePricingResolve(beginPricingResolve('b1'), 'b1', true)
    expect(settlePricingResolve(ready, 'b1', true)).toBe(ready)
  })

  describe('pricingResolvePanel', () => {
    it('shows content when no bid is selected (the picker list)', () => {
      expect(pricingResolvePanel(IDLE_PRICING_RESOLVE, null)).toBe('content')
    })

    it('shows the skeleton before the resolve effect has run for this bid', () => {
      // Idle state, or state still pointing at the previously viewed bid — the
      // frames that used to flash "The Workbench needs Counts…".
      expect(pricingResolvePanel(IDLE_PRICING_RESOLVE, 'b1')).toBe('skeleton')
      expect(pricingResolvePanel({ bidId: 'b0', status: 'ready' }, 'b1')).toBe('skeleton')
    })

    it('shows the skeleton while loading, never the empty state', () => {
      expect(pricingResolvePanel(beginPricingResolve('b1'), 'b1')).toBe('skeleton')
    })

    it('shows the error panel when the resolve failed', () => {
      expect(pricingResolvePanel({ bidId: 'b1', status: 'error' }, 'b1')).toBe('error')
    })

    it('shows content once ready', () => {
      expect(pricingResolvePanel({ bidId: 'b1', status: 'ready' }, 'b1')).toBe('content')
    })
  })
})
