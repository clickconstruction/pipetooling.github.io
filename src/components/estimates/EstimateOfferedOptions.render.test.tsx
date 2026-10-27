// @vitest-environment jsdom
/**
 * What was offered (v2.5988, punch list #206 PR 2): every option as a block with its own lines and
 * total; a single-option estimate draws nothing; an accepted row folds the blocks.
 */
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen, within } from '@testing-library/react'
import EstimateOfferedOptions from './EstimateOfferedOptions'
import type { EstimateOption } from '../../lib/estimates/estimateOptions'

const line = (line_item: string, amount_cents: number) => ({ line_item, description: '', quantity: 1, unit_price_cents: amount_cents, amount_cents })
const opt = (key: string, name: string, lines: ReturnType<typeof line>[], kind: EstimateOption['kind'], recommended = false): EstimateOption => ({
  key,
  name,
  description: kind === 'choice' ? `${name}, the pitch` : '',
  recommended,
  kind,
  line_items: lines,
})

const two = [
  opt('pvc', 'PVC water line', [line('Water line to the range (PVC)', 1_097_200)], 'choice', true),
  opt('hdpe', 'HDPE water line', [line('Fused HDPE', 1_286_000), line('Fire connection', 55_000)], 'choice'),
]

afterEach(() => cleanup())

describe('EstimateOfferedOptions', () => {
  it('draws every option with its lines and total, the recommended one starred', () => {
    render(<EstimateOfferedOptions options={two} />)
    expect(screen.getByRole('heading', { level: 2 }).textContent).toContain('What was offered')
    const blocks = screen.getAllByTestId('estimate-offered-option')
    expect(blocks).toHaveLength(2)
    expect(within(blocks[0]!).getByRole('heading', { level: 3 }).textContent).toBe('Option 1 · PVC water line★ Recommended')
    expect(within(blocks[0]!).getByTestId('estimate-offered-option-money').textContent).toBe('$10,972.00')
    expect(within(blocks[0]!).getByTestId('estimate-offered-option-note').textContent).toBe("The Pipeline's number until they decide.")
    expect(within(blocks[1]!).getByText('Fused HDPE')).toBeTruthy()
    expect(within(blocks[1]!).getByText('Fire connection')).toBeTruthy()
    expect(within(blocks[1]!).getByTestId('estimate-offered-option-money').textContent).toBe('$13,410.00')
    expect(within(blocks[1]!).queryByTestId('estimate-offered-option-note')).toBeNull()
  })

  it('a single-option estimate draws nothing', () => {
    const { container } = render(<EstimateOfferedOptions options={[two[0]!]} />)
    expect(container.innerHTML).toBe('')
  })

  it('an accepted row folds the blocks under Every option as sent, with no Pipeline note', () => {
    render(<EstimateOfferedOptions options={two} accepted />)
    const fold = screen.getByTestId('estimate-offered-options')
    expect(fold.tagName).toBe('DETAILS')
    expect(fold.querySelector('summary')?.textContent).toContain('Every option as sent')
    expect(screen.getAllByTestId('estimate-offered-option')).toHaveLength(2)
    expect(screen.queryByTestId('estimate-offered-option-note')).toBeNull()
  })
})
