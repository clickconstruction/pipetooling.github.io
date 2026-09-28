// @vitest-environment jsdom
/**
 * Render smoke for the ★ chooser (region P7 of the Pricing map): the title follows the
 * action, "Both" is offered for a share only, every door reports, and while the ★'s prices
 * load the backdrop and both buttons hold still.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { PricingStarChooserDialog } from './PricingStarChooserDialog'

function props(over: Partial<Parameters<typeof PricingStarChooserDialog>[0]> = {}) {
  return {
    action: 'share' as const,
    choice: 'star' as const,
    busy: false,
    starName: 'Base',
    viewedName: 'Alternate 1',
    onChoose: vi.fn(),
    onCancel: vi.fn(),
    onConfirm: vi.fn(),
    ...over,
  }
}

afterEach(() => cleanup())

describe('PricingStarChooserDialog', () => {
  it('a share: names both prices, offers Both, and the confirm says what it will send', () => {
    render(<PricingStarChooserDialog {...props()} />)
    expect(screen.getByRole('dialog', { name: 'Send which price?' })).toBeTruthy()
    expect(screen.getByText('You\'re viewing Alternate 1; the customer\'s price is ★ Base.')).toBeTruthy()
    expect(screen.getByText('Both — ★ Base and Alternate 1')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Send ★ Base' })).toBeTruthy()
  })

  it('a print and an export have their own title and no Both', () => {
    const { unmount } = render(<PricingStarChooserDialog {...props({ action: 'print', choice: 'viewed' })} />)
    expect(screen.getByRole('dialog', { name: 'Print which price?' })).toBeTruthy()
    expect(screen.queryByText(/^Both — /)).toBeNull()
    expect(screen.getByRole('button', { name: 'Print Alternate 1' })).toBeTruthy()
    unmount()
    render(<PricingStarChooserDialog {...props({ action: 'csv' })} />)
    expect(screen.getByRole('dialog', { name: 'Export which price?' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Export ★ Base' })).toBeTruthy()
  })

  it('the pick is marked, and each option reports its own choice', () => {
    const onChoose = vi.fn()
    render(<PricingStarChooserDialog {...props({ choice: 'both', onChoose })} />)
    const radios = screen.getAllByRole('radio') as HTMLInputElement[]
    expect(radios.map((r) => r.checked)).toEqual([false, false, true])
    fireEvent.click(screen.getByText('Customer\'s price — ★ Base'))
    fireEvent.click(screen.getByText('The one you\'re viewing — Alternate 1'))
    fireEvent.click(screen.getByText('Both — ★ Base and Alternate 1'))
    expect(onChoose.mock.calls.map((c) => c[0])).toEqual(['star', 'viewed', 'both'])
    expect(screen.getByRole('button', { name: 'Send both' })).toBeTruthy()
  })

  it('Cancel, the backdrop and the confirm report; a click inside the box does not cancel', () => {
    const p = props()
    render(<PricingStarChooserDialog {...p} />)
    fireEvent.click(screen.getByRole('dialog'))
    expect(p.onCancel).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(p.onCancel).toHaveBeenCalledTimes(1)
    fireEvent.click(screen.getByRole('dialog').parentElement as HTMLElement)
    expect(p.onCancel).toHaveBeenCalledTimes(2)
    fireEvent.click(screen.getByRole('button', { name: 'Send ★ Base' }))
    expect(p.onConfirm).toHaveBeenCalledTimes(1)
  })

  it('while busy the confirm says Loading, both buttons are off and the backdrop holds', () => {
    const p = props({ busy: true })
    render(<PricingStarChooserDialog {...p} />)
    expect((screen.getByRole('button', { name: 'Loading…' }) as HTMLButtonElement).disabled).toBe(true)
    expect((screen.getByRole('button', { name: 'Cancel' }) as HTMLButtonElement).disabled).toBe(true)
    fireEvent.click(screen.getByRole('dialog').parentElement as HTMLElement)
    expect(p.onCancel).not.toHaveBeenCalled()
  })
})
