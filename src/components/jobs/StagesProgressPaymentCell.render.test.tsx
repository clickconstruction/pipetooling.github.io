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
