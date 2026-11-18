// @vitest-environment jsdom
/**
 * Five small pieces of the Workbench's sticky bar, as their own pieces (decomposition queue row 1).
 * All draw and report. The tab's own smoke mounts each of them from the screen.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { PricingLockChip, PricingMarkupTool, PricingRobotRowsDoor, PricingSentLine, PricingTaxTool } from './PricingBarPieces'

afterEach(cleanup)

const MARKUP_ROWS = [
  { id: 'wc', name: 'Water closet', kind: 'fixture' as const, tags: ['restrooms'], own: false, markup: 0.5, hasMaterial: true },
  { id: 'lav', name: 'Lavatory', kind: 'fixture' as const, tags: [], own: true, markup: 0.2, hasMaterial: true },
]
const TAX_ROWS = [
  { id: 'wc', name: 'Water closet', kind: 'fixture' as const, tags: ['restrooms'], taxable: true, hasMaterial: true },
  { id: 'lav', name: 'Lavatory', kind: 'fixture' as const, tags: [], taxable: false, hasMaterial: true },
]

describe('PricingMarkupTool', () => {
  const setup = (open: boolean) => {
    const calls = { toggle: vi.fn(), close: vi.fn(), apply: vi.fn(), undo: vi.fn() }
    render(<PricingMarkupTool open={open} onToggle={calls.toggle} onClose={calls.close} rows={MARKUP_ROWS} bidMarkup={0.5} weightedMarkup={0.425} onApply={calls.apply} undoCount={0} onUndo={calls.undo} />)
    return calls
  }
  it('closed, it is one button that says so and reports a press', () => {
    const calls = setup(false)
    const btn = screen.getByRole('button', { name: /Markup ›/ })
    expect(btn.getAttribute('aria-expanded')).toBe('false')
    expect(btn.title).toBe('Material markup — set one number across the rows, a tag or a kind')
    expect(btn.style.background).toBe('var(--surface)')
    expect(screen.queryByText('Material markup')).toBeNull()
    fireEvent.click(btn)
    expect(calls.toggle).toHaveBeenCalledTimes(1)
  })
  it("open, the button reads pressed and the popover shows the bid's number and the rows' own", () => {
    setup(true)
    const btn = screen.getByRole('button', { name: /Markup ›/ })
    expect(btn.getAttribute('aria-expanded')).toBe('true')
    expect(btn.style.background).toBe('var(--bg-muted)')
    expect(document.body.textContent).toContain("the bid's number is +50%")
    expect(document.body.textContent).toContain('the rows are at +42.5%')
  })
})

describe('PricingTaxTool', () => {
  const setup = (open: boolean) => {
    const calls = { toggle: vi.fn(), close: vi.fn(), apply: vi.fn(), undo: vi.fn(), commit: vi.fn() }
    render(<PricingTaxTool open={open} onToggle={calls.toggle} onClose={calls.close} rows={TAX_ROWS} taxPercent={8.25} onTaxPercentCommit={calls.commit} onApply={calls.apply} undoCount={0} onUndo={calls.undo} />)
    return calls
  }
  it('closed, it is one button that says so and reports a press', () => {
    const calls = setup(false)
    const btn = screen.getByRole('button', { name: /Tax ›/ })
    expect(btn.getAttribute('aria-expanded')).toBe('false')
    expect(btn.title).toBe('Sales tax — make rows tax-free or taxed across the bid, a tag or a kind')
    expect(screen.queryByText('Sales tax')).toBeNull()
    fireEvent.click(btn)
    expect(calls.toggle).toHaveBeenCalledTimes(1)
  })
  it('open, the popover counts the tax-free rows it was handed', () => {
    setup(true)
    expect(screen.getByRole('button', { name: /Tax ›/ }).getAttribute('aria-expanded')).toBe('true')
    expect(document.body.textContent).toContain('1 of 2 rows are tax-free now')
  })
})

describe('PricingRobotRowsDoor', () => {
  it('says how many rows it will price and reports the press', () => {
    const onPrice = vi.fn()
    render(<PricingRobotRowsDoor count={3} busy={false} onPrice={onPrice} />)
    const btn = screen.getByTestId('pricing-robot-price-door') as HTMLButtonElement
    expect(btn.textContent).toBe("Price 3 robot rows at the robot's prices")
    expect(document.body.textContent).toContain('3 robot rows landed before a book was picked and have no price.')
    fireEvent.click(btn)
    expect(onPrice).toHaveBeenCalledTimes(1)
  })
  it('one row reads in the singular', () => {
    render(<PricingRobotRowsDoor count={1} busy={false} onPrice={() => {}} />)
    expect(screen.getByTestId('pricing-robot-price-door').textContent).toBe("Price 1 robot row at the robot's prices")
    expect(document.body.textContent).toContain('1 robot row landed before a book was picked and has no price.')
  })
  it('while it prices, the button is dead and says so', () => {
    const onPrice = vi.fn()
    render(<PricingRobotRowsDoor count={3} busy onPrice={onPrice} />)
    const btn = screen.getByTestId('pricing-robot-price-door') as HTMLButtonElement
    expect(btn.disabled).toBe(true)
    expect(btn.textContent).toBe('Pricing…')
    expect(btn.style.cursor).toBe('wait')
    fireEvent.click(btn)
    expect(onPrice).not.toHaveBeenCalled()
  })
})

describe('PricingLockChip', () => {
  it('locked: the padlock, the words, and Revise…', () => {
    const onToggle = vi.fn()
    render(<PricingLockChip chip="Sent Jun 2 · locked" revising={false} onToggle={onToggle} />)
    const chip = screen.getByTestId('pricing-lock-chip')
    expect(chip.textContent).toContain('🔒 Sent Jun 2 · locked')
    const btn = screen.getByRole('button', { name: 'Revise…' })
    expect(btn.title).toBe("Unlock this bid's pricing for this session — changes after send are on purpose")
    fireEvent.click(btn)
    expect(onToggle).toHaveBeenCalledTimes(1)
  })
  it('revising: the pencil, amber, and Lock again', () => {
    render(<PricingLockChip chip="Revising a sent bid" revising onToggle={() => {}} />)
    const chip = screen.getByTestId('pricing-lock-chip')
    expect(chip.textContent).toContain('✎ Revising a sent bid')
    expect((chip.querySelector('span') as HTMLElement).style.background).toBe('var(--bg-amber-tint)')
    expect(screen.getByRole('button', { name: 'Lock again' }).title).toBe("Lock this bid's pricing again")
  })
})

describe('PricingSentLine', () => {
  it('shows its words, quiet when today matches what was sent', () => {
    render(<PricingSentLine text="Sent Jun 2 at $6,800 · today $6,800" differs={false} />)
    const line = screen.getByTestId('pricing-sent-vs-today')
    expect(line.textContent).toBe('Sent Jun 2 at $6,800 · today $6,800')
    expect(line.style.color).toBe('var(--text-muted)')
    expect(line.style.fontWeight).toBe('400')
  })
  it('reads amber and bold when today differs', () => {
    render(<PricingSentLine text="Sent Jun 2 at $6,500 · today $6,800" differs />)
    const line = screen.getByTestId('pricing-sent-vs-today')
    expect(line.style.color).toBe('var(--text-amber-700)')
    expect(line.style.fontWeight).toBe('600')
  })
})
