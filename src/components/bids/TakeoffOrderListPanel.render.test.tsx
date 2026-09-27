// @vitest-environment jsdom
/**
 * Render smokes for Materials to order (v2.3409): rows read needed → ordered
 * with packs and the extra, the total, the empty state, the folded compact
 * form, and the catalog refresh reporting what it changed.
 */
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { TakeoffOrderListPanel } from './TakeoffOrderListPanel'
import { summarizeOrderRounding } from '../../lib/bids/takeoffOrderRounding'
import { settle } from '../../test/renderSmokeMocks'

const rounding = summarizeOrderRounding([{ id: 'a', count: 1 }], [
  { countRowId: 'a', quantity: 105, partId: 'cu', unitPrice: 2.75, orderIncrement: 20, orderIncrementUnit: 'ft_stick' },
  { countRowId: 'a', quantity: 40, partId: 'pvc', unitPrice: 3, orderIncrement: 20, orderIncrementUnit: 'ft_stick' },
])
const names = new Map([['cu', '3/4" Type L Copper'], ['pvc', '2" PVC DWV']])

describe('TakeoffOrderListPanel', () => {
  it('lists each part: needed → ordered, packs × increment, the extra; exact parts read exact; the total', async () => {
    render(<TakeoffOrderListPanel rounding={rounding} partNameById={names} />)
    await settle()
    const panel = screen.getByTestId('takeoff-order-list')
    expect(panel.textContent).toContain('3/4" Type L Copper')
    expect(panel.textContent).toContain('105 → 120 ft')
    expect(panel.textContent).toContain('6 × 20 ft')
    expect(panel.textContent).toContain('+$41.25')
    expect(panel.textContent).toContain('2" PVC DWV')
    expect(panel.textContent).toContain('exact')
    expect(panel.textContent).toContain('Extra bought for rounding')
    expect(screen.getByTitle(/105 ft needed on this bid → 120 ft/)).toBeTruthy()
  })

  it('with no rules it says how to get one; compact starts folded and opens on tap', async () => {
    render(<TakeoffOrderListPanel rounding={summarizeOrderRounding([], [])} partNameById={new Map()} />)
    await settle()
    expect(screen.getByTestId('takeoff-order-list').textContent).toContain('No part on this bid carries a Sold in rule yet')
  })

  it('compact starts folded and opens on tap', async () => {
    render(<TakeoffOrderListPanel rounding={rounding} partNameById={names} compact />)
    await settle()
    expect(screen.getByTestId('takeoff-order-list').textContent).not.toContain('105 → 120 ft')
    fireEvent.click(screen.getByRole('button', { name: /Materials to order/ }))
    expect(screen.getByTestId('takeoff-order-list').textContent).toContain('105 → 120 ft')
  })

  it('Refresh re-reads the catalog and says what changed', async () => {
    const onRefreshRules = vi.fn(async () => ({ updated: 3, cleared: 1 }))
    render(<TakeoffOrderListPanel rounding={rounding} partNameById={names} onRefreshRules={onRefreshRules} />)
    await settle()
    fireEvent.click(screen.getByRole('button', { name: /Refresh Sold in rules/ }))
    await waitFor(() => expect(onRefreshRules).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(screen.getByTestId('takeoff-order-list').textContent).toContain('3 lines updated, 1 cleared.'))
  })
})
