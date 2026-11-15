// @vitest-environment jsdom
/**
 * The line under the Pricing workbench's strip (v2.5043): the margin kept on the bid with its
 * inputs, and on a sent bid the margin it went out at, which repricing does not move.
 */
import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { PricedMarginLine } from './PricedMarginLine'

const stamp = { pct: 31.42, revenueUsd: 48_700, costUsd: 33_400, uncostedUsd: 1_200, rateSet: true, bidVersionId: null, at: '2026-10-09T15:00:00Z', difficultyUsd: 0 }

describe('PricedMarginLine', () => {
  it('an unsent bid: the margin kept on it, the inputs and why it reads high, and the day', () => {
    render(<PricedMarginLine stamp={stamp} sent={false} />)
    expect(screen.getByTestId('pricing-priced-margin').textContent).toBe('Kept on the bid as its priced margin: 31% · $33,400 cost on $48,700 · $1,200 on rows with no cost · Oct 9')
  })
  it('a sent bid: the margin it went out at, kept at send', () => {
    render(<PricedMarginLine stamp={{ ...stamp, uncostedUsd: 0 }} sent />)
    expect(screen.getByTestId('pricing-priced-margin').textContent).toBe('Went out at 31% · $33,400 cost on $48,700 · kept at send, so repricing does not move it')
  })
  it('the GC difficulty part of the cost, when the stamp carries one (punch list #357, PR 4)', () => {
    render(<PricedMarginLine stamp={{ ...stamp, uncostedUsd: 0, difficultyUsd: 960 }} sent />)
    expect(screen.getByTestId('pricing-priced-margin').textContent).toBe('Went out at 31% · $33,400 cost on $48,700 · $960 of it difficulty · kept at send, so repricing does not move it')
  })
  it('no stamp, no line', () => {
    const { container } = render(<PricedMarginLine stamp={null} sent={false} />)
    expect(container.textContent).toBe('')
  })
})
