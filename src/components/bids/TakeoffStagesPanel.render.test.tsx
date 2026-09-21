// @vitest-environment jsdom
/**
 * Render smokes for the Stages rail panel (v2.3672): the three stage lines
 * (raw → × factor), the factor field (company default vs this bid; typing the
 * company number back clears the override; garbage is dropped), the staged
 * sentence, the fill note, and the print button only when a printer is given.
 */
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { TakeoffStagesPanel } from './TakeoffStagesPanel'
import { computeMaterialsByStage, stageWeights } from '../../lib/bids/materialsByStage'

const summary = computeMaterialsByStage({
  countRows: [
    { id: 'a', fixture: 'WC-1', count: 2 },
    { id: 'b', fixture: 'ft of 4IN WASTE', count: 100 },
    { id: 'c', fixture: 'L-1', count: 1 },
  ],
  lines: [
    { id: 'l1', countRowId: 'a', partId: 'p', sourceTemplateId: null, quantity: 1, unitPrice: 100 },
    { id: 'l2', countRowId: 'b', partId: 'q', sourceTemplateId: null, quantity: 1, unitPrice: 2 },
    { id: 'l3', countRowId: 'c', partId: 'r', sourceTemplateId: null, quantity: 1, unitPrice: 50 },
  ],
  splits: [
    { countRowId: 'a', lineId: null, partId: null, weights: stageWeights(0, 0, 1), source: 'rule' },
    { countRowId: 'b', lineId: null, partId: null, weights: stageWeights(1, 1, 0), source: 'hand' },
  ],
  factor: 1.5,
})

function mount(over: Partial<React.ComponentProps<typeof TakeoffStagesPanel>> = {}) {
  const props = {
    summary,
    factorDefault: 1.5,
    factorOverride: null,
    onFactorChange: vi.fn(async () => {}),
    onFillByRules: vi.fn(async () => {}),
    fillNote: null,
    ...over,
  }
  render(<TakeoffStagesPanel {...props} />)
  return props
}

describe('TakeoffStagesPanel', () => {
  it('shows raw → scaled per stage, the total, and the staged sentence', () => {
    mount()
    expect(screen.getByTestId('stage-scaled-rough_in').textContent).toBe('$150.00')
    expect(screen.getByTestId('stage-scaled-top_out').textContent).toBe('$150.00')
    expect(screen.getByTestId('stage-scaled-trim_set').textContent).toBe('$300.00')
    expect(screen.getByTestId('stage-scaled-total').textContent).toBe('$600.00')
    expect(screen.getByText(/2 of 3 costed fixtures staged · 1 still needs a stage \(\$50\.00\)/)).toBeTruthy()
    expect(screen.getByText(/Shares 25 · 25 · 50 %/)).toBeTruthy()
    expect(screen.queryByRole('button', { name: /Print schedule of values/ })).toBeNull()
  })

  it('the factor field: a new number is this bid’s own, the company number clears it, garbage is dropped', async () => {
    const p = mount()
    const input = screen.getByLabelText('Schedule of values material factor') as HTMLInputElement
    expect(input.value).toBe('1.5')
    expect(screen.getByText('company default')).toBeTruthy()
    fireEvent.focus(input)
    fireEvent.change(input, { target: { value: '1.35' } })
    fireEvent.blur(input)
    await waitFor(() => expect(p.onFactorChange).toHaveBeenLastCalledWith(1.35))
    fireEvent.focus(input)
    fireEvent.change(input, { target: { value: '1.5' } })
    fireEvent.blur(input)
    await waitFor(() => expect(p.onFactorChange).toHaveBeenLastCalledWith(null))
    fireEvent.focus(input)
    fireEvent.change(input, { target: { value: '9' } })
    fireEvent.blur(input)
    expect(p.onFactorChange).toHaveBeenCalledTimes(2)
    expect(input.value).toBe('1.5')
  })

  it('says whose factor it is, runs the rule fill, shows the note, and prints when it can', () => {
    const p = mount({ factorOverride: 1.35, fillNote: '2 fixtures staged by rule · 1 set by hand kept', onPrint: vi.fn() })
    expect(screen.getByText('this bid')).toBeTruthy()
    expect(screen.getByTestId('stage-fill-note').textContent).toBe('2 fixtures staged by rule · 1 set by hand kept')
    fireEvent.click(screen.getByRole('button', { name: 'Fill from rules' }))
    expect(p.onFillByRules).toHaveBeenCalledTimes(1)
    fireEvent.click(screen.getByRole('button', { name: /Print schedule of values/ }))
    expect(p.onPrint).toHaveBeenCalledTimes(1)
  })
})
