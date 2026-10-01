// @vitest-environment jsdom
/**
 * Render smoke for the Workbench "?" card (region P2 of the Pricing map): the four lines,
 * the solo and the many-GC wording, every door reports, and every line reads in plain words
 * (v2.4304).
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen } from '@testing-library/react'
import { renderWithProviders } from '../../test/renderSmokeMocks'
import { plainWordsFailures } from '../../lib/plainWords'
import { WorkbenchHelpCard } from './WorkbenchHelpCard'

function props(over: Partial<Parameters<typeof WorkbenchHelpCard>[0]> = {}) {
  return { solo: true, firstScenarioName: 'Base', gcName: 'Acme Builders', gcShort: 'Acme', onClose: vi.fn(), onTakeTour: vi.fn(), ...over }
}

afterEach(() => cleanup())

describe('WorkbenchHelpCard', () => {
  it('a solo bid: four lines, and "This bid" names the price its GC sees', () => {
    renderWithProviders(<WorkbenchHelpCard {...props()} />)
    const card = screen.getByRole('dialog', { name: 'How this page works' })
    for (const k of ['Type a price', 'Solve', 'This bid', 'Labor & cost']) expect(screen.getByText(k)).toBeTruthy()
    expect(card.textContent).toContain('This bid has one packet, the copy one GC gets. Acme sees Base.')
    expect(screen.queryByText('This GC')).toBeNull()
  })

  it('more than one price or GC: "This GC" names whose packet is on screen', () => {
    renderWithProviders(<WorkbenchHelpCard {...props({ solo: false })} />)
    expect(screen.getByRole('dialog').textContent).toContain('You are on the packet for Acme Builders, their copy of the bid. The ★ base is the price they see on their letter.')
    expect(screen.queryByText('This bid')).toBeNull()
  })

  it.each([
    ['a solo bid', true],
    ['more than one price or GC', false],
  ])('%s: every line reads in plain words (src/lib/plainWords.ts)', (_name, solo) => {
    renderWithProviders(<WorkbenchHelpCard {...props({ solo, gcName: 'Burd & Assoc', gcShort: 'Burd' })} />)
    const lines = Array.from(screen.getByRole('dialog').querySelectorAll('[data-help-line]'))
    expect(lines).toHaveLength(4)
    for (const line of lines) {
      const text = (line.textContent ?? '').replace(/\s+/g, ' ').trim()
      expect(plainWordsFailures(text), `${line.getAttribute('data-help-line')}: ${text}`).toEqual([])
    }
  })

  it('the solver line names the controls by their exact names', () => {
    renderWithProviders(<WorkbenchHelpCard {...props()} />)
    const solve = screen.getByRole('dialog').querySelector('[data-help-line="Solve"]')?.textContent ?? ''
    for (const control of ['Solver ›', 'Apply', 'Discard']) expect(solve).toContain(control)
  })

  it('the guide link points at the Workbench guide', () => {
    renderWithProviders(<WorkbenchHelpCard {...props()} />)
    expect(screen.getByRole('link', { name: 'Read the guide →' }).getAttribute('href')).toBe('/help?g=price-a-bid-with-the-workbench')
  })

  it('Close, the backdrop and the guide link close; the tour button reports; a click inside does nothing', () => {
    const onClose = vi.fn()
    const onTakeTour = vi.fn()
    renderWithProviders(<WorkbenchHelpCard {...props({ onClose, onTakeTour })} />)
    fireEvent.click(screen.getByText('Type a price'))
    expect(onClose).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Close' }))
    expect(onClose).toHaveBeenCalledTimes(1)
    fireEvent.click(screen.getByRole('presentation'))
    expect(onClose).toHaveBeenCalledTimes(2)
    fireEvent.click(screen.getByRole('link', { name: 'Read the guide →' }))
    expect(onClose).toHaveBeenCalledTimes(3)
    fireEvent.click(screen.getByRole('button', { name: '▶ Take the tour' }))
    expect(onTakeTour).toHaveBeenCalledTimes(1)
    expect(onClose).toHaveBeenCalledTimes(3)
  })
})
