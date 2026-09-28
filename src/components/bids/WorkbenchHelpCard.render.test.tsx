// @vitest-environment jsdom
/**
 * Render smoke for the Workbench "?" card (region P2 of the Pricing map): the four lines,
 * the solo and the many-GC wording, and every door reports.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen } from '@testing-library/react'
import { renderWithProviders } from '../../test/renderSmokeMocks'
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
    expect(card.textContent).toContain('one packet — Acme sees Base.')
    expect(screen.queryByText('This GC')).toBeNull()
  })

  it('more than one price or GC: "This GC" names whose packet is on screen', () => {
    renderWithProviders(<WorkbenchHelpCard {...props({ solo: false })} />)
    expect(screen.getByRole('dialog').textContent).toContain('Acme Builders — ★ base is what they see on their letter')
    expect(screen.queryByText('This bid')).toBeNull()
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
