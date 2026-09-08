// @vitest-environment jsdom
/**
 * Stage Plan PR 3 render smokes for the Multiple Segment Generator: presets
 * carry Order kinds, "+ Change order" appends an Any row with its own price,
 * the allocation line reads the split and the money outside it, and Add to
 * Job hands back every line with its kind.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen } from '@testing-library/react'
import { MultipleSegmentGeneratorModal } from './MultipleSegmentGeneratorModal'
import { renderWithProviders } from '../../test/renderSmokeMocks'

afterEach(() => cleanup())

function open(onAddToJob = vi.fn()) {
  renderWithProviders(<MultipleSegmentGeneratorModal open initialTotalDollars={41550} zIndex={10} onCancel={() => {}} onAddToJob={onAddToJob} />)
  return onAddToJob
}

describe('MultipleSegmentGeneratorModal with stage kinds', () => {
  it('a preset fills four Order rows, numbered, and the allocation line reads the split', () => {
    open()
    fireEvent.click(screen.getByRole('button', { name: /Commercial 30\/30\/30\/10/ }))
    expect(screen.getAllByTestId('generator-row-order')).toHaveLength(4)
    expect(screen.getByLabelText('Stage 4')).toBeTruthy()
    expect(screen.getByTestId('generator-allocation').textContent).toBe('100% allocated · $41,550.00 in order')
    expect(screen.getByTestId('generator-summary').textContent).toContain('4 in order')
    expect(screen.getByTestId('generator-summary').textContent).toContain('Job total $41,550.00')
  })

  it('+ Change order appends an Any row with its own price outside the split', () => {
    const add = open()
    fireEvent.click(screen.getByRole('button', { name: /Commercial 30\/30\/30\/10/ }))
    fireEvent.click(screen.getByRole('button', { name: /\+ Change order/ }))
    const anyRows = screen.getAllByTestId('generator-row-any')
    expect(anyRows).toHaveLength(1)
    const names = screen.getAllByLabelText('Segment name')
    fireEvent.change(names[4]!, { target: { value: 'Relocate water heater' } })
    fireEvent.change(screen.getByLabelText('Segment amount'), { target: { value: '1850' } })
    expect(screen.getByTestId('generator-allocation').textContent).toBe('100% allocated · $41,550.00 in order · $1,850.00 outside the split')
    expect(screen.getByTestId('generator-summary').textContent).toContain('1 any time')
    expect(screen.getByTestId('generator-summary').textContent).toContain('Job total $43,400.00')
    fireEvent.click(screen.getByRole('button', { name: /Add to Job/ }))
    expect(add).toHaveBeenCalledTimes(1)
    const lines = add.mock.calls[0]![0] as Array<{ name: string; line_unit_price: number; stage_kind: string | null }>
    expect(lines.map((l) => [l.name, l.line_unit_price, l.stage_kind])).toEqual([
      ['Rough In', 12465, 'order'],
      ['Top Out', 12465, 'order'],
      ['Trim Set', 12465, 'order'],
      ['Final', 4155, 'order'],
      ['Relocate water heater', 1850, 'any'],
    ])
  })

  it('flipping a row to — keeps its dollars as its own amount and takes it out of the split', () => {
    open()
    fireEvent.click(screen.getByRole('button', { name: /Residential 40\/40\/20/ }))
    const trim = screen.getByRole('radiogroup', { name: 'Stage kind for Trim Set' })
    fireEvent.click(trim.querySelector('[role="radio"]:nth-child(3)') as HTMLElement)
    expect(screen.getAllByTestId('generator-row-order')).toHaveLength(2)
    expect(screen.getAllByTestId('generator-row-plain')).toHaveLength(1)
    expect(screen.getByTestId('generator-allocation').textContent).toBe('80% allocated — segments usually total 100% · $33,240.00 in order · $8,310.00 outside the split')
    expect(screen.getByTestId('generator-summary').textContent).toContain('1 plain line')
  })
})
