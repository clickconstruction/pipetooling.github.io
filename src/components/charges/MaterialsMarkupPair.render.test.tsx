// @vitest-environment jsdom
/**
 * Render smokes for the markup pair (v2.6538): a stored markup draws both boxes; typing in either fills the other;
 * leaving a box commits the markup once, never while a box refuses; a job door names the company's figures in both
 * placeholders; a new stored markup re-draws the pair.
 */
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { MaterialsMarkupPair } from './MaterialsMarkupPair'

const markup = () => screen.getByTestId('pair') as HTMLInputElement
const margin = () => screen.getByTestId('pair-margin') as HTMLInputElement

describe('MaterialsMarkupPair', () => {
  it('draws a stored markup in both boxes and commits the markup a typed margin makes', () => {
    const onCommit = vi.fn()
    const onTyped = vi.fn()
    render(<MaterialsMarkupPair markupPct={25} testId="pair" onCommit={onCommit} onTyped={onTyped} />)
    expect(markup().value).toBe('25')
    expect(margin().value).toBe('20')
    fireEvent.change(margin(), { target: { value: '23' } })
    expect(markup().value).toBe('29.87')
    expect(onTyped).toHaveBeenLastCalledWith(expect.objectContaining({ markupPct: 29.87, refusal: null }))
    fireEvent.keyDown(margin(), { key: 'Enter' })
    fireEvent.blur(margin())
    expect(onCommit).toHaveBeenCalledWith(29.87)
    fireEvent.change(markup(), { target: { value: '50' } })
    expect(margin().value).toBe('33.3')
  })

  it('refuses a margin of 100 or more in words, leaves the markup blank and never commits it', () => {
    const onCommit = vi.fn()
    render(<MaterialsMarkupPair markupPct={null} testId="pair" onCommit={onCommit} />)
    fireEvent.change(margin(), { target: { value: '100' } })
    expect(screen.getByTestId('pair-refusal').textContent).toBe('A margin on the sale is under 100%.')
    expect(markup().value).toBe('')
    fireEvent.blur(margin())
    expect(onCommit).not.toHaveBeenCalled()
    fireEvent.change(margin(), { target: { value: '' } })
    expect(screen.queryByTestId('pair-refusal')).toBeNull()
    fireEvent.blur(margin())
    expect(onCommit).toHaveBeenCalledWith(null)
  })

  it("on a job door, names the company's markup and margin in the placeholders, and re-draws when the stored markup changes", () => {
    const { rerender } = render(<MaterialsMarkupPair markupPct={null} companyMarkupPct={25} testId="pair" />)
    expect(markup().placeholder).toBe('Company: 25')
    expect(margin().placeholder).toBe('Company: 20')
    rerender(<MaterialsMarkupPair markupPct={30} companyMarkupPct={25} testId="pair" />)
    expect(markup().value).toBe('30')
    expect(margin().value).toBe('23.1')
    rerender(<MaterialsMarkupPair markupPct={null} companyMarkupPct={null} testId="pair" />)
    expect(markup().placeholder).toBe('at cost')
    expect(margin().placeholder).toBe('at cost')
  })
})
