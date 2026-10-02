// @vitest-environment jsdom
/**
 * Render smoke for a bid's materials at today's book (v2.4395): the Takeoffs line when open,
 * locked and revising, a price that looks wrong, and the Pricing note.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { PricingMaterialsTodayNote, TakeoffPriceDriftLine } from './TakeoffPriceDrift'
import type { TakeoffDrift } from '../../lib/bids/takeoffPriceDrift'

afterEach(() => cleanup())

const moved: TakeoffDrift = {
  materials: 49_427.26,
  moved: [
    { lineId: 'l1', partName: '4IN 90 PVC', houseName: 'Reece', quantity: 52, priced: 25.88, today: 17.56, change: -432.64 },
    { lineId: 'l2', partName: '2005_02 FD', houseName: 'Reece', quantity: 6, priced: 137.02, today: 101.92, change: -210.6 },
    { lineId: 'l3', partName: 'B65P-CC', houseName: 'Reece', quantity: 3, priced: 494.73, today: 501.18, change: 19.35 },
  ],
  gap: -623.89,
  share: -623.89 / 49_427.26,
  wrong: [],
  refresh: [],
}
const sink = { sourcePriceId: 'src-sink', partName: 'RIVERBY SINK', houseName: 'Reece', priced: 653.93, today: 999_999, lineCount: 1 }
const none: TakeoffDrift = { materials: 100, moved: [], gap: 0, share: 0, wrong: [], refresh: [] }

const line = () => screen.getByRole('region', { name: 'Materials at today’s book' })

describe('TakeoffPriceDriftLine', () => {
  it('says nothing when every book price still matches', () => {
    const { container } = render(<TakeoffPriceDriftLine drift={none} lock="open" sentDay={null} refreshing={false} onRefresh={vi.fn()} />)
    expect(container.textContent).toBe('')
  })

  it('an open bid: how many moved, the gap and its share, Refresh prices, and the lines', () => {
    const onRefresh = vi.fn()
    render(<TakeoffPriceDriftLine drift={moved} lock="open" sentDay={null} refreshing={false} onRefresh={onRefresh} />)
    const l = line()
    expect(l.textContent).toContain('3 prices on this takeoff moved in the book. At today’s book these materials cost $624 less (▼ 1.3%).')
    fireEvent.click(within(l).getByRole('button', { name: 'Refresh prices' }))
    expect(onRefresh).toHaveBeenCalledTimes(1)
    const rows = within(l).getAllByRole('row')
    expect(rows[1]!.textContent).toContain('4IN 90 PVC')
    expect(rows[1]!.textContent).toContain('$25.88')
    expect(rows[1]!.textContent).toContain('▼ $432.64')
    expect(rows[3]!.textContent).toContain('▲ $19.35')
    expect(l.textContent).toContain('Prices you typed stay as they are.')
  })

  it('a sent bid shows the gap only and says how to refresh', () => {
    render(<TakeoffPriceDriftLine drift={moved} lock="locked" sentDay="Jul 7" refreshing={false} onRefresh={vi.fn()} />)
    const l = line()
    expect(l.textContent).toContain('Sent Jul 7. Press Revise on Pricing to refresh them.')
    expect(within(l).queryByRole('button', { name: 'Refresh prices' })).toBeNull()
  })

  it('a sent bid being revised can refresh, and the button holds while it runs', () => {
    const { rerender } = render(<TakeoffPriceDriftLine drift={moved} lock="revising" sentDay="Jul 7" refreshing={false} onRefresh={vi.fn()} />)
    expect(within(line()).getByRole('button', { name: 'Refresh prices' })).toBeTruthy()
    rerender(<TakeoffPriceDriftLine drift={moved} lock="revising" sentDay="Jul 7" refreshing onRefresh={vi.fn()} />)
    expect((within(line()).getByRole('button', { name: 'Refreshing…' }) as HTMLButtonElement).disabled).toBe(true)
  })

  it('a price that looks wrong is named, left out, and sent to Materials', () => {
    render(<TakeoffPriceDriftLine drift={{ ...none, wrong: [sink] }} lock="locked" sentDay="Jul 20" refreshing={false} onRefresh={vi.fn()} />)
    const l = line()
    expect(l.textContent).toContain('1 price looks wrong, so it is left out. RIVERBY SINK at Reece reads $999,999.00. It was $653.93 on this takeoff.')
    expect(within(l).getByRole('link', { name: 'Fix it in Materials' }).getAttribute('href')).toBe('/materials?tab=parts-book')
    expect(l.textContent).not.toContain('moved in the book')
  })
})

describe('PricingMaterialsTodayNote', () => {
  it('the gap in one line, any wrong price, and See Takeoffs', () => {
    const onSeeTakeoffs = vi.fn()
    render(<PricingMaterialsTodayNote drift={{ ...moved, wrong: [sink] }} onSeeTakeoffs={onSeeTakeoffs} />)
    const note = screen.getByTestId('pricing-materials-today')
    expect(note.textContent).toContain('Materials at today’s book: $624 less (▼ 1.3%). 1 price that looks wrong is left out.')
    fireEvent.click(within(note).getByRole('button', { name: 'See Takeoffs' }))
    expect(onSeeTakeoffs).toHaveBeenCalledTimes(1)
  })

  it('nothing while it reads, or when nothing moved', () => {
    const { container, rerender } = render(<PricingMaterialsTodayNote drift={null} onSeeTakeoffs={vi.fn()} />)
    expect(container.textContent).toBe('')
    rerender(<PricingMaterialsTodayNote drift={none} onSeeTakeoffs={vi.fn()} />)
    expect(container.textContent).toBe('')
  })
})
