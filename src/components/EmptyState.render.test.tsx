// @vitest-environment jsdom
/**
 * Render smoke for EmptyState: main alone, a button press with its tail, a Link press, and the
 * compact padding for a list inside a window.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen } from '@testing-library/react'
import { renderWithProviders as render } from '../test/renderSmokeMocks'
import { EmptyState } from './EmptyState'
import { emptyWords, emptyWordsWithPress } from '../lib/emptyWords'

afterEach(cleanup)

describe('EmptyState', () => {
  it('draws main alone when there is no press', () => {
    render(<EmptyState main="Nothing waiting on dispatch." />)
    const p = document.querySelector('[data-empty-state]') as HTMLElement
    expect(p.tagName).toBe('P')
    expect(p.textContent).toBe('Nothing waiting on dispatch.')
    expect(p.querySelector('button, a')).toBeNull()
    expect(p.style.textAlign).toBe('center')
    expect(p.style.padding).toBe('2rem')
  })

  it('draws the press as a button between main and the tail, and the press fires', () => {
    const onPress = vi.fn()
    render(<EmptyState main="No bids yet." next={{ label: 'New Bid', onPress }} tail="adds the first." />)
    const p = document.querySelector('[data-empty-state]') as HTMLElement
    expect(p.textContent).toBe('No bids yet. New Bid adds the first.')
    const press = screen.getByRole('button', { name: 'New Bid' })
    expect(press.getAttribute('type')).toBe('button')
    expect(press.style.fontWeight).toBe('600')
    fireEvent.click(press)
    expect(onPress).toHaveBeenCalledTimes(1)
  })

  it('draws a page press as a link with the same look', () => {
    render(<EmptyState main="No sessions yet." next={{ label: 'Clock in', to: '/clock' }} tail="starts the first." />)
    const link = screen.getByRole('link', { name: 'Clock in' })
    expect(link.getAttribute('href')).toBe('/clock')
    expect(link.style.fontWeight).toBe('600')
    expect((document.querySelector('[data-empty-state]') as HTMLElement).textContent).toBe('No sessions yet. Clock in starts the first.')
  })

  it('takes the kernel words with their press, and compact tightens the padding', () => {
    const clear = vi.fn()
    render(<EmptyState compact {...emptyWordsWithPress(emptyWords({ kind: 'filter', noun: 'bids', query: 'Ridgeway' }), { onPress: clear })} />)
    const p = document.querySelector('[data-empty-state]') as HTMLElement
    expect(p.textContent).toBe('No bids match ‘Ridgeway’. Clear the search')
    expect(p.style.padding).toBe('0.75rem')
    fireEvent.click(screen.getByRole('button', { name: 'Clear the search' }))
    expect(clear).toHaveBeenCalledTimes(1)
  })
})
