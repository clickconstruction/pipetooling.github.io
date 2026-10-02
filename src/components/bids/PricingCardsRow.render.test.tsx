// @vitest-environment jsdom
/**
 * Render smoke for Pricing's price cards row (the Pricing / Labor map's step 9, part 2): the
 * three layouts, what each card says and which door each control reports through, the
 * alternate-version cards, the "Add a price or GC" door and the own-takeoff name window.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { AddPriceDoorButton, PricingCardsRow, type PricingCardsRowProps } from './PricingCardsRow'
import type { BidVersion, PriceBookVersion } from '../../lib/bids/bidPricingEngineTypes'

const pricing = (id: string, name: string, over: Record<string, unknown> = {}) => ({ id, name, sort_order: 0, bid_version_id: 'v1', include_in_submission: false, ...over }) as unknown as PriceBookVersion
const BASE = pricing('pA', 'Base')
const ALT1 = pricing('pB', 'Alternate 1')
const EMPTY = pricing('pC', 'Scratch')
const REVENUE: Record<string, number | null> = { pA: 1000, pB: 1200, pC: 0 }

function props(over: Partial<PricingCardsRowProps> = {}): PricingCardsRowProps {
  return {
    mode: 'row',
    scenarios: [BASE, ALT1],
    altVersions: [],
    selectedPricingVersionId: 'pA',
    selectedBidVersionId: 'v1',
    customerFacingPricingId: 'pA',
    revenueOf: (id) => REVENUE[id] ?? null,
    totalCost: 600,
    baseMaterials: 300,
    altVersionData: {},
    marginColor: (m) => (m == null ? 'muted' : 'green'),
    copySource: null,
    cloning: false,
    copyingPrices: false,
    doorOpen: false,
    doorGcLabel: 'Hensel Phelps',
    onOpenDoor: vi.fn(),
    onCloseDoor: vi.fn(),
    onAnotherPrice: vi.fn(),
    onOwnTakeoff: vi.fn(),
    onAdopt: vi.fn(),
    ownTakeoff: null,
    creatingOwnTakeoff: false,
    ownTakeoffGcLabel: 'Hensel Phelps',
    onOwnTakeoffName: vi.fn(),
    onCancelOwnTakeoff: vi.fn(),
    onCreateOwnTakeoff: vi.fn(),
    onView: vi.fn(),
    onEdit: vi.fn(),
    onMakeBase: vi.fn(),
    onSetOffered: vi.fn(),
    onCopyPrices: vi.fn(),
    onOpenAlternate: vi.fn(),
    onOpenAlternateTakeoff: vi.fn(),
    ...over,
  }
}

/** The card that carries a price's name. */
const cardOf = (name: string) => screen.getByText(name).closest('[title]') as HTMLElement

afterEach(() => cleanup())

describe('AddPriceDoorButton', () => {
  it('opens the door, and says Duplicating… and holds while a copy runs', () => {
    const onOpenDoor = vi.fn()
    const { rerender } = render(<AddPriceDoorButton cloning={false} onOpenDoor={onOpenDoor} />)
    fireEvent.click(screen.getByRole('button'))
    expect(onOpenDoor).toHaveBeenCalledTimes(1)
    rerender(<AddPriceDoorButton cloning onOpenDoor={onOpenDoor} />)
    expect((screen.getByRole('button', { name: 'Duplicating…' }) as HTMLButtonElement).disabled).toBe(true)
  })

  it('reads on one line on a one-row strip, and breaks in two only beside the tall cards', () => {
    const { rerender } = render(<AddPriceDoorButton cloning={false} onOpenDoor={() => {}} />)
    expect(screen.getByRole('button').querySelector('br')).toBeNull()
    expect(screen.getByRole('button').textContent).toBe('＋Add price')
    rerender(<AddPriceDoorButton cloning={false} onOpenDoor={() => {}} stacked />)
    expect(screen.getByRole('button').querySelector('br')).not.toBeNull()
    // Beside the tall cards and at the solver line's end it keeps its full size.
    expect(screen.getByRole('button').style.padding).toBe('0.42rem 0.85rem')
  })
})

describe('PricingCardsRow — the solo band', () => {
  it('one priced price: the band with its figures and the door; the ★ base says the GC sees it', () => {
    const p = props({ mode: 'solo', scenarios: [BASE] })
    render(<PricingCardsRow {...p} />)
    const band = screen.getByText('One GC · one price').parentElement as HTMLElement
    expect(band.textContent).toContain('★ base · the GC sees this')
    expect(band.textContent).toContain('$1,000.00')
    expect(band.textContent).toContain('40% margin · profit $400.00')
    expect(screen.queryByRole('button', { name: '☆ Make base…' })).toBeNull()
    fireEvent.click(within(band).getByRole('button', { name: /Add\s*price/ }))
    expect(p.onOpenDoor).toHaveBeenCalledTimes(1)
  })

  it('the band is one short line: a slim Add price pill and thin padding (v2.4417)', () => {
    render(<PricingCardsRow {...props({ mode: 'solo', scenarios: [BASE] })} />)
    const band = screen.getByText('One GC · one price').parentElement as HTMLElement
    const door = within(band).getByRole('button', { name: /Add\s*price/ })
    expect(door.style.padding).toBe('0.14rem 0.6rem')
    expect(door.style.borderRadius).toBe('999px')
    expect(band.style.padding).toBe('0.25rem 0.9rem')
  })

  it('a price that is not the base offers ☆ Make base…, with its revenue', () => {
    const p = props({ mode: 'solo', scenarios: [ALT1], customerFacingPricingId: 'pA' })
    render(<PricingCardsRow {...p} />)
    fireEvent.click(screen.getByRole('button', { name: '☆ Make base…' }))
    expect(p.onMakeBase).toHaveBeenCalledWith(ALT1, 1200)
  })

  it("another version's price on the band offers no ☆ Make base… (v2.4377)", () => {
    render(<PricingCardsRow {...props({ mode: 'solo', scenarios: [pricing('pX', 'Value Engineered', { bid_version_id: 'v2' })], customerFacingPricingId: null })} />)
    expect(screen.queryByRole('button', { name: '☆ Make base…' })).toBeNull()
  })

  it('an unpriced solo bid draws no band — only the windows, and nothing while they are closed', () => {
    const { container, rerender } = render(<PricingCardsRow {...props({ mode: 'soloUnpriced', scenarios: [EMPTY] })} />)
    expect(container.textContent).toBe('')
    rerender(<PricingCardsRow {...props({ mode: 'soloUnpriced', scenarios: [EMPTY], doorOpen: true })} />)
    expect(screen.getByRole('dialog', { name: 'Add a price or GC' })).toBeTruthy()
  })
})

describe('PricingCardsRow — the tray of cards', () => {
  it('each card: its name, total and margin; the open one says Viewing, the base ★ Submittal', () => {
    render(<PricingCardsRow {...props()} />)
    const base = cardOf('Base')
    expect(base.textContent).toContain('Viewing')
    expect(base.textContent).toContain('★ Submittal')
    expect(base.textContent).toContain('★ The price on their letter')
    const alt = cardOf('Alternate 1')
    expect(alt.textContent).toContain('$1,200.00')
    expect(alt.textContent).toContain('50% margin · profit $600.00')
    expect(alt.textContent).toContain('Only you see this')
    expect(alt.textContent).not.toContain('Viewing')
  })

  it('a card still loading reads …; an unpriced one says No prices yet and only you see it', () => {
    render(<PricingCardsRow {...props({ scenarios: [BASE, EMPTY, pricing('pD', 'Loading')] })} />)
    expect(cardOf('Loading').textContent).toContain('…')
    expect(cardOf('Scratch').textContent).toContain('No prices yet')
    expect(cardOf('Scratch').textContent).toContain('Only you see this')
  })

  it('clicking another card views it; clicking the open one does nothing; ✎ edits without viewing', () => {
    const p = props()
    render(<PricingCardsRow {...p} />)
    fireEvent.click(cardOf('Alternate 1'))
    fireEvent.click(cardOf('Base'))
    expect(p.onView).toHaveBeenCalledTimes(1)
    expect(p.onView).toHaveBeenCalledWith('pB')
    fireEvent.click(screen.getByRole('button', { name: 'Edit Alternate 1' }))
    expect(p.onEdit).toHaveBeenCalledWith({ id: 'pB', name: 'Alternate 1' })
    expect(p.onView).toHaveBeenCalledTimes(1)
  })

  it('offer as alternate, stop offering and make base report, and tell the version picker to reload', () => {
    const reloads = vi.fn()
    window.addEventListener('bid-version-picker-reload', reloads)
    const offered = pricing('pE', 'Offered', { include_in_submission: true })
    const p = props({ scenarios: [BASE, ALT1, offered], revenueOf: (id) => (id === 'pE' ? 900 : REVENUE[id] ?? null) })
    render(<PricingCardsRow {...p} />)
    fireEvent.click(within(cardOf('Alternate 1')).getByRole('button', { name: 'offer as alternate' }))
    expect(p.onSetOffered).toHaveBeenLastCalledWith(ALT1, true)
    expect(cardOf('Offered').textContent).toContain('On their letter · alternate')
    fireEvent.click(within(cardOf('Offered')).getByRole('button', { name: 'stop offering' }))
    expect(p.onSetOffered).toHaveBeenLastCalledWith(offered, false)
    fireEvent.click(within(cardOf('Alternate 1')).getByRole('button', { name: '☆ make base' }))
    expect(p.onMakeBase).toHaveBeenCalledWith(ALT1, 1200)
    expect(reloads).toHaveBeenCalledTimes(3)
    expect(p.onView).not.toHaveBeenCalled()
    window.removeEventListener('bid-version-picker-reload', reloads)
  })

  it("another version's price stays view-only: no make base, no offer, and says whose it is (v2.4377)", () => {
    // The fallback row: the version on screen owns no price, so the bid's other prices show.
    const foreign = pricing('pX', 'Value Engineered', { bid_version_id: 'v2', include_in_submission: true })
    const p = props({ scenarios: [foreign], selectedPricingVersionId: 'pX', customerFacingPricingId: null, revenueOf: () => 1500 })
    render(<PricingCardsRow {...p} />)
    const card = cardOf('Value Engineered')
    expect(card.textContent).toContain("Another version's price")
    expect(card.textContent).not.toContain('On their letter')
    expect(within(card).queryByRole('button', { name: '☆ make base' })).toBeNull()
    expect(within(card).queryByRole('button', { name: 'offer as alternate' })).toBeNull()
    expect(within(card).queryByRole('button', { name: 'stop offering' })).toBeNull()
  })

  it('the open price, when unpriced, offers to copy prices from the copy source', () => {
    const p = props({ scenarios: [BASE, EMPTY], selectedPricingVersionId: 'pC', copySource: { id: 'pA', name: 'Base' } })
    render(<PricingCardsRow {...p} />)
    fireEvent.click(screen.getByRole('button', { name: 'copy prices from Base' }))
    expect(p.onCopyPrices).toHaveBeenCalledWith('pA')
    expect(p.onView).not.toHaveBeenCalled()
  })

  it('no copy source, or not the open price, offers no copy', () => {
    render(<PricingCardsRow {...props({ scenarios: [BASE, EMPTY], selectedPricingVersionId: 'pC', copySource: null })} />)
    expect(screen.queryByText(/copy prices from/)).toBeNull()
  })
})

describe('PricingCardsRow — own-takeoff alternate cards', () => {
  const av = { id: 'alt', name: 'PEX in lieu', include_in_submission: true } as unknown as BidVersion

  it('its total, margin against its own materials, the materials change, and who sees it', () => {
    // Revenue 1,000; cost 600 with materials 300 swapped for 200 → cost 500 → 50 %.
    render(<PricingCardsRow {...props({ altVersions: [av], altVersionData: { alt: { revenue: 1000, materials: 200 } } })} />)
    const card = cardOf('PEX in lieu')
    expect(card.textContent).toContain('📐 own takeoff')
    expect(card.textContent).toContain('$1,000.00')
    expect(card.textContent).toContain('50% margin · profit $500.00')
    expect(card.textContent).toContain('Materials $200.00 · −$100.00 vs base')
    expect(card.textContent).toContain('On their letter · alternate')
  })

  it('opening the card switches to that version; its takeoff link switches and goes to Takeoffs, once', () => {
    const p = props({ altVersions: [av], altVersionData: { alt: { revenue: 1000, materials: 200 } } })
    render(<PricingCardsRow {...p} />)
    fireEvent.click(screen.getByRole('button', { name: 'open its takeoff →' }))
    expect(p.onOpenAlternateTakeoff).toHaveBeenCalledWith('alt')
    expect(p.onOpenAlternate).not.toHaveBeenCalled()
    fireEvent.click(cardOf('PEX in lieu'))
    expect(p.onOpenAlternate).toHaveBeenCalledWith('alt')
  })

  it('still loading reads …; an exact-model bid says its materials are the shared POs; unpriced says so', () => {
    const { rerender } = render(<PricingCardsRow {...props({ altVersions: [av], altVersionData: {} })} />)
    expect(cardOf('PEX in lieu').textContent).toContain('…')
    rerender(<PricingCardsRow {...props({ altVersions: [av], altVersionData: { alt: { revenue: 0, materials: null } } })} />)
    expect(cardOf('PEX in lieu').textContent).toContain('Materials · shared POs (exact model)')
    expect(cardOf('PEX in lieu').textContent).toContain('No prices yet')
  })
})

describe('PricingCardsRow — the door and the own-takeoff window', () => {
  it('each choice closes the door first, then reports; Another GC asks the version picker', () => {
    const addGc = vi.fn()
    window.addEventListener('bid-version-picker-open-add-gc', addGc)
    const p = props({ doorOpen: true })
    render(<PricingCardsRow {...p} />)
    const door = screen.getByRole('dialog', { name: 'Add a price or GC' })
    expect(door.textContent).toContain('Another price for Hensel Phelps')
    fireEvent.click(within(door).getByText('Another price for Hensel Phelps'))
    fireEvent.click(within(door).getByText('Alternate with its own takeoff'))
    fireEvent.click(within(door).getByText('Another GC'))
    fireEvent.click(within(door).getByText('Adopt an existing bid'))
    expect(p.onAnotherPrice).toHaveBeenCalledTimes(1)
    expect(p.onOwnTakeoff).toHaveBeenCalledTimes(1)
    expect(addGc).toHaveBeenCalledTimes(1)
    expect(p.onAdopt).toHaveBeenCalledTimes(1)
    expect(p.onCloseDoor).toHaveBeenCalledTimes(4)
    fireEvent.click(within(door).getByRole('button', { name: 'Cancel' }))
    expect(p.onCloseDoor).toHaveBeenCalledTimes(5)
    window.removeEventListener('bid-version-picker-open-add-gc', addGc)
  })

  it('the own-takeoff window: typing, Enter, Escape and the backdrop report; Create waits for a name', () => {
    const p = props({ ownTakeoff: { name: '' } })
    const { rerender } = render(<PricingCardsRow {...p} />)
    const box = screen.getByPlaceholderText('e.g. PEX in lieu of copper')
    expect(screen.getByRole('dialog', { name: 'Alternate with its own takeoff' }).textContent).toContain('prices for Hensel Phelps')
    expect((screen.getByRole('button', { name: 'Create the alternate' }) as HTMLButtonElement).disabled).toBe(true)
    fireEvent.change(box, { target: { value: 'PEX' } })
    expect(p.onOwnTakeoffName).toHaveBeenCalledWith('PEX')

    rerender(<PricingCardsRow {...p} ownTakeoff={{ name: 'PEX' }} />)
    fireEvent.click(screen.getByRole('button', { name: 'Create the alternate' }))
    fireEvent.keyDown(screen.getByPlaceholderText('e.g. PEX in lieu of copper'), { key: 'Enter' })
    expect(p.onCreateOwnTakeoff).toHaveBeenCalledTimes(2)
    expect(p.onCreateOwnTakeoff).toHaveBeenCalledWith('PEX')
    fireEvent.keyDown(screen.getByPlaceholderText('e.g. PEX in lieu of copper'), { key: 'Escape' })
    fireEvent.click(screen.getByRole('dialog', { name: 'Alternate with its own takeoff' }).parentElement as HTMLElement)
    expect(p.onCancelOwnTakeoff).toHaveBeenCalledTimes(2)
  })

  it('while creating, the backdrop holds and the buttons say Creating…', () => {
    const p = props({ ownTakeoff: { name: 'PEX' }, creatingOwnTakeoff: true })
    render(<PricingCardsRow {...p} />)
    fireEvent.click(screen.getByRole('dialog', { name: 'Alternate with its own takeoff' }).parentElement as HTMLElement)
    expect(p.onCancelOwnTakeoff).not.toHaveBeenCalled()
    expect((screen.getByRole('button', { name: 'Creating…' }) as HTMLButtonElement).disabled).toBe(true)
  })
})
