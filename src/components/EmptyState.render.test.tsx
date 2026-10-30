// @vitest-environment jsdom
/**
 * Render smoke for EmptyState: main alone, a button press with its tail, a Link press, and the
 * compact padding for a list inside a window.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen, within } from '@testing-library/react'
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
    expect(Array.from(p.children).map((u) => (u as HTMLElement).dataset.emptyUnit)).toEqual(['main'])
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

  it('draws a second press after "or", and each press fires its own handler (v2.5986)', () => {
    const clear = vi.fn()
    const widen = vi.fn()
    render(<EmptyState main="No bids match ‘Ridgway’." next={{ label: 'Clear the search', onPress: clear }} orNext={{ label: 'Show every bid', onPress: widen }} />)
    expect((document.querySelector('[data-empty-state]') as HTMLElement).textContent).toBe('No bids match ‘Ridgway’. Clear the search or Show every bid')
    fireEvent.click(screen.getByRole('button', { name: 'Show every bid' }))
    expect(widen).toHaveBeenCalledTimes(1)
    expect(clear).not.toHaveBeenCalled()
  })

  it('draws main as one unit and the press with its tail as a second, so the second drops whole to the next line (v2.6113)', () => {
    render(<EmptyState compact main="Nothing scheduled today." next={{ label: '+ Add job', onPress: vi.fn() }} tail="puts a job on your day." />)
    const p = document.querySelector('[data-empty-state]') as HTMLElement
    const units = Array.from(p.children) as HTMLElement[]
    expect(units.map((u) => u.dataset.emptyUnit)).toEqual(['main', 'next'])
    expect(units.map((u) => u.textContent)).toEqual(['Nothing scheduled today.', '+ Add job puts a job on your day.'])
    expect(units.map((u) => u.style.display)).toEqual(['inline-block', 'inline-block'])
    expect(within(units[1] as HTMLElement).getByRole('button', { name: '+ Add job' })).toBeTruthy()
    expect(p.textContent).toBe('Nothing scheduled today. + Add job puts a job on your day.')
  })

  it('the second unit holds the or press too, and a tail with no press is a unit of its own', () => {
    render(<EmptyState main="No bids match ‘Ridgway’." next={{ label: 'Clear the search', onPress: vi.fn() }} orNext={{ label: 'Show every bid', onPress: vi.fn() }} />)
    let units = Array.from((document.querySelector('[data-empty-state]') as HTMLElement).children) as HTMLElement[]
    expect(units.map((u) => u.textContent)).toEqual(['No bids match ‘Ridgway’.', 'Clear the search or Show every bid'])
    cleanup()
    render(<EmptyState main="No reports yet." tail="Create one above." />)
    units = Array.from((document.querySelector('[data-empty-state]') as HTMLElement).children) as HTMLElement[]
    expect(units.map((u) => u.textContent)).toEqual(['No reports yet.', 'Create one above.'])
  })
})
