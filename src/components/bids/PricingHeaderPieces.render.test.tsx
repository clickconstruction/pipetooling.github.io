// @vitest-environment jsdom
/**
 * The header chip and the loading panel, as their own pieces (decomposition queue row 1). Both draw
 * and report. The chip's colours and its hover words follow its state; each state is pinned here as
 * the tab drew it. The tab's own smoke mounts both from the screen.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { PricingResolvePanel, PricingRfqChip, type PricingRfqChipState } from './PricingHeaderPieces'

afterEach(cleanup)

const draw = (chip: PricingRfqChipState) => {
  const onOpen = vi.fn()
  render(<PricingRfqChip chip={chip} onOpen={onOpen} />)
  const el = screen.getByRole('button') as HTMLButtonElement
  return { el, onOpen, look: { background: el.style.background, color: el.style.color, border: el.style.border, title: el.title } }
}

describe('PricingRfqChip', () => {
  it('shows its label, keeps the id the page links to, and reports a press', () => {
    const { el, onOpen } = draw({ kind: 'quotes', tone: 'blue', label: 'Quotes (2)' })
    expect(el.textContent).toBe('Quotes (2)')
    expect(el.id).toBe('pricing-price-requests')
    fireEvent.click(el)
    expect(onOpen).toHaveBeenCalledTimes(1)
  })

  it('quotes only: blue on the surface, and the hover says compare', () => {
    expect(draw({ kind: 'quotes', tone: 'blue', label: 'Quotes (2)' }).look).toEqual({
      background: 'var(--surface)',
      color: 'var(--text-blue-500)',
      border: '1px solid rgb(59, 130, 246)',
      title: 'Compare supply house quotes on this bid',
    })
  })

  it('a quotes chip in green keeps the blue of quotes', () => {
    const { look } = draw({ kind: 'quotes', tone: 'green', label: 'Quotes (3)' })
    expect(look.color).toBe('var(--text-blue-500)')
    expect(look.border).toBe('1px solid rgb(59, 130, 246)')
  })

  it('the desk waiting: amber on a yellow tint, and the hover says the desk', () => {
    expect(draw({ kind: 'desk', tone: 'amber', label: '2 requests out' }).look).toEqual({
      background: 'var(--bg-yellow-tint)',
      color: 'var(--text-amber-700)',
      border: '1px solid rgb(245, 158, 11)',
      title: 'Open the price-request desk',
    })
  })

  it('the desk with a bounce: red on the surface', () => {
    const { look } = draw({ kind: 'desk', tone: 'red', label: '1 bounced' })
    expect(look.background).toBe('var(--surface)')
    expect(look.color).toBe('rgb(239, 68, 68)')
    expect(look.border).toBe('1px solid rgb(239, 68, 68)')
  })

  it('the desk all in: green on the surface', () => {
    const { look } = draw({ kind: 'desk', tone: 'green', label: 'All quotes in' })
    expect(look.background).toBe('var(--surface)')
    expect(look.color).toBe('var(--text-green-700)')
    expect(look.border).toBe('1px solid rgb(22, 163, 74)')
  })

  it('the robot working: blue on a blue tint, and the hover says where the robot is', () => {
    expect(draw({ kind: 'robot', tone: 'blue', label: 'Robot pricing · working', requestId: 'req-1', status: 'working' }).look).toEqual({
      background: 'var(--bg-blue-tint)',
      color: 'var(--text-blue-500)',
      border: '1px solid rgb(59, 130, 246)',
      title: 'Where the robot is on this bid',
    })
  })

  it('the robot blocked: amber on a yellow tint', () => {
    const { look } = draw({ kind: 'robot', tone: 'amber', label: 'Robot pricing · blocked', requestId: 'req-1', status: 'blocked' })
    expect(look.background).toBe('var(--bg-yellow-tint)')
    expect(look.color).toBe('var(--text-amber-700)')
    expect(look.title).toBe('Where the robot is on this bid')
  })

  it("the robot's matrix ready: green on a green tint, and the hover says open the compare", () => {
    expect(draw({ kind: 'robot', tone: 'green', label: 'Matrix ready', requestId: 'req-1', status: 'ready' }).look).toEqual({
      background: 'var(--bg-green-tint)',
      color: 'var(--text-green-700)',
      border: '1px solid rgb(22, 163, 74)',
      title: 'The robot’s matrix is ready — open the compare',
    })
  })
})

describe('PricingResolvePanel', () => {
  it('while loading it is a status that says so, with three shimmer lines and no Retry', () => {
    const onRetry = vi.fn()
    const { container } = render(<PricingResolvePanel panel="skeleton" onRetry={onRetry} />)
    const status = screen.getByRole('status', { name: "Loading this bid's packets and prices" })
    expect(status.textContent).toContain("Loading this bid's packets and prices…")
    expect(container.querySelectorAll('.bid-resolve-shimmer')).toHaveLength(6)
    expect(container.querySelectorAll('.bid-resolve-spinner')).toHaveLength(1)
    expect(screen.queryByRole('button')).toBeNull()
  })

  it('after a failed load it says the versions are safe and Retry reports', () => {
    const onRetry = vi.fn()
    render(<PricingResolvePanel panel="error" onRetry={onRetry} />)
    expect(screen.getByText("Couldn't load this bid's packets and prices — the connection dropped or the server didn't answer. Your versions are safe.")).toBeTruthy()
    expect(screen.queryByRole('status')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }))
    expect(onRetry).toHaveBeenCalledTimes(1)
  })
})
