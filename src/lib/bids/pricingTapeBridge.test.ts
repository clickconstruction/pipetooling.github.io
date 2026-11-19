import { afterEach, describe, expect, it, vi } from 'vitest'
import { getPricingTapeSink, setPricingTapeSink, tapeAnswerSendable, type PricingTapeSink } from './pricingTapeBridge'

afterEach(() => setPricingTapeSink(null))

describe('the line between the Pricing Tape and the Workbench', () => {
  it('has no sink until the Workbench sets one, and none again once it clears it', () => {
    expect(getPricingTapeSink()).toBeNull()
    const sink: PricingTapeSink = { send: vi.fn() }
    setPricingTapeSink(sink)
    expect(getPricingTapeSink()).toBe(sink)
    setPricingTapeSink(null)
    expect(getPricingTapeSink()).toBeNull()
  })

  it('hands the calculator’s answer to the sink as it was sent', () => {
    const send = vi.fn()
    setPricingTapeSink({ send })
    getPricingTapeSink()?.send({ value: 2480, words: 'Pipe revenue × 0.4 = 2,480', rule: { pct: 40, basis: 'revenue', sourceKey: 'kind:pipe' } }, 'new-row')
    expect(send).toHaveBeenCalledWith({ value: 2480, words: 'Pipe revenue × 0.4 = 2,480', rule: { pct: 40, basis: 'revenue', sourceKey: 'kind:pipe' } }, 'new-row')
  })

  it('sends a number of zero or more, never a negative or a broken result', () => {
    expect(tapeAnswerSendable(0)).toBe(true)
    expect(tapeAnswerSendable(1234.56)).toBe(true)
    expect(tapeAnswerSendable(-4)).toBe(false)
    expect(tapeAnswerSendable(Number.NaN)).toBe(false)
    expect(tapeAnswerSendable(Number.POSITIVE_INFINITY)).toBe(false)
  })
})
