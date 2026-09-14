// @vitest-environment jsdom
/**
 * Render tests for the Stages "% done" input (v2.1928): out-of-range entries
 * clamp to the nearest bound and COMMIT (110 → 100) instead of silently not
 * saving; in-range and cleared entries commit as before.
 */
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { buildStagesMoneyBarModel } from '../../lib/stagesMoneyBar'
import StagesProgressPaymentCell from './StagesProgressPaymentCell'

const model = buildStagesMoneyBarModel({ totalBill: 17_800, paymentsMade: 8000, pctComplete: 70 })

function renderPctInput(onPctCommit: (pct: number | null) => void, pctComplete: number | null = 70) {
  render(<StagesProgressPaymentCell model={model} pctComplete={pctComplete} onPctCommit={onPctCommit} />)
  return screen.getByLabelText('Percent complete') as HTMLInputElement
}

describe('StagesProgressPaymentCell % done input', () => {
  it('clamps entries over 100 to 100 and commits (input shows the normalized value)', () => {
    const onPctCommit = vi.fn()
    const input = renderPctInput(onPctCommit)
    fireEvent.change(input, { target: { value: '110' } })
    fireEvent.blur(input)
    expect(onPctCommit).toHaveBeenCalledWith(100)
    expect(input.value).toBe('100')
  })

  it('clamps negative entries to 0 and commits', () => {
    const onPctCommit = vi.fn()
    const input = renderPctInput(onPctCommit)
    fireEvent.change(input, { target: { value: '-5' } })
    fireEvent.blur(input)
    expect(onPctCommit).toHaveBeenCalledWith(0)
    expect(input.value).toBe('0')
  })

  it('commits in-range values untouched and null on cleared', () => {
    const onPctCommit = vi.fn()
    const input = renderPctInput(onPctCommit)
    fireEvent.change(input, { target: { value: '85' } })
    fireEvent.blur(input)
    expect(onPctCommit).toHaveBeenCalledWith(85)
    fireEvent.change(input, { target: { value: '' } })
    fireEvent.blur(input)
    expect(onPctCommit).toHaveBeenCalledWith(null)
  })
})

describe('StagesProgressPaymentCell bill-sent alert (v2.3411)', () => {
  const alert = { sentAt: '2026-09-02T15:00:00Z', label: 'Bill sent Sep 2 · set % done', title: 'A bill is out — how far along is the work?' }
  const blankModel = buildStagesMoneyBarModel({ totalBill: 17_800, paymentsMade: 0, pctComplete: null, billedUnpaid: 9_000 })

  it('editable: the empty box wears the red outline, aria-invalid, and the red line under it', () => {
    render(<StagesProgressPaymentCell model={blankModel} pctComplete={null} onPctCommit={vi.fn()} billSentAlert={alert} />)
    const input = screen.getByLabelText('Percent complete') as HTMLInputElement
    expect(input.getAttribute('aria-invalid')).toBe('true')
    expect(input.getAttribute('data-bill-sent-alert')).toBe('on')
    expect(input.style.borderRadius).toBe('4px')
    expect(screen.getByText('Bill sent Sep 2 · set % done')).toBeTruthy()
  })

  it('read-only viewer: the same red box and line, with no input', () => {
    render(<StagesProgressPaymentCell model={blankModel} pctComplete={null} billSentAlert={alert} />)
    expect(screen.queryByLabelText('Percent complete')).toBeNull()
    expect(document.querySelector('[data-bill-sent-alert="on"]')).toBeTruthy()
    expect(screen.getByText('Bill sent Sep 2 · set % done')).toBeTruthy()
  })

  it('no alert: the plain underline box and no line', () => {
    render(<StagesProgressPaymentCell model={blankModel} pctComplete={null} onPctCommit={vi.fn()} />)
    const input = screen.getByLabelText('Percent complete') as HTMLInputElement
    expect(input.getAttribute('aria-invalid')).toBeNull()
    expect(document.querySelector('[data-bill-sent-alert-line]')).toBeNull()
  })
})

describe('StagesProgressPaymentCell legend (v2.3416 — the four rows sum to the bid)', () => {
  it('prints the amber slice’s own dollars beside its percent, and names the empty track', () => {
    // The owner's 2026-09-14 screenshot row: 80% of $40,000, $13,412 paid, $11,770 billed.
    const m = buildStagesMoneyBarModel({ totalBill: 40_000, paymentsMade: 13_412, pctComplete: 80, billedUnpaid: 11_770 })
    const { container } = render(<StagesProgressPaymentCell model={m} pctComplete={80} />)
    expect(screen.getByText(/17% Done, not billed/)).toBeTruthy()
    expect(container.querySelector('[data-done-not-billed]')?.textContent).toBe('$6,818')
    expect(screen.getByText(/20% Not done/)).toBeTruthy()
    expect(container.querySelector('[data-not-done]')?.textContent).toBe('$8,000')
    expect(screen.queryByText(/\$18,588/)).toBeNull()
  })

  it('compact card says Done, not billed and omits it when billing runs ahead of the work', () => {
    const ahead = buildStagesMoneyBarModel({ totalBill: 40_135, paymentsMade: 0, pctComplete: 60, billedUnpaid: 32_108 })
    const { rerender } = render(<StagesProgressPaymentCell compact model={ahead} pctComplete={60} />)
    expect(screen.queryByText(/Done, not billed/)).toBeNull()
    const behind = buildStagesMoneyBarModel({ totalBill: 40_000, paymentsMade: 13_412, pctComplete: 80, billedUnpaid: 11_770 })
    rerender(<StagesProgressPaymentCell compact model={behind} pctComplete={80} />)
    expect(screen.getByText(/Done, not billed \$6,818/)).toBeTruthy()
  })
})
