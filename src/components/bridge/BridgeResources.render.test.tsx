// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, screen } from '@testing-library/react'
import { renderWithProviders } from '../../test/renderSmokeMocks'
import { BridgeResources } from './BridgeResources'
import { BridgeOrderModal } from './BridgeOrderModal'
import { buildResources } from '../../lib/bridge/resources'
import { buildOrder } from '../../lib/bridge/order'
import { buildStageFlow } from '../../lib/bridge/stageFlow'

const resources = buildResources({ linkId: 'bill', pendingHours: 585, pendingSessions: 104, unpricedJobs: 6, noPctJobs: 6, unsortedBankRows: 1151, bidsNoValue: 0, bankUsd: 390, bankSynced: true, lowestUsd: -16_300, lowestLabel: 'Oct 12', floorUsd: 5000, clearsFloor: false, fieldPeople: 7, fieldHours7d: 317, billers: 1 })

describe('BridgeResources', () => {
  it('draws the three cards; the card picks, the badge opens the order', () => {
    const onPick = vi.fn()
    const onOrder = vi.fn()
    renderWithProviders(<BridgeResources resources={resources} pickedId={null} onPick={onPick} onOrder={onOrder} />)
    expect(screen.getByTestId('bridge-resource-gauge-decision').textContent).toBe('4 piles on you')
    expect(screen.getByTestId('bridge-resource-badge-capital').textContent).toBe('symptom of the link')
    fireEvent.click(screen.getByTestId('bridge-resource-talent'))
    expect(onPick).toHaveBeenCalledWith('talent')
    fireEvent.click(screen.getByTestId('bridge-resource-badge-decision'))
    expect(onOrder).toHaveBeenCalledWith('decision')
    expect(onPick).toHaveBeenCalledTimes(1)
  })
})

describe('BridgeOrderModal', () => {
  it('lists the tiers with the pressed row and closes on the overlay', () => {
    const flow = buildStageFlow({ market: null, sales: null, fieldPerWeekUsd: null, build: null, bill: { pileUsd: 233_000, pileCount: 15, inPerWeekUsd: 34_000, outPerWeekUsd: 22_000 }, collect: { pileUsd: 332_000, pileCount: 49, inPerWeekUsd: 22_000, outPerWeekUsd: 46_000, lateCount: 49 }, heldLinkId: null })
    const order = buildOrder({ flow, resources, pressedId: 'collect' })
    const onClose = vi.fn()
    renderWithProviders(<BridgeOrderModal order={order} note="at today’s pace" onClose={onClose} />)
    expect(screen.getByTestId('bridge-order-row-bill').textContent).toContain('Bill')
    expect(screen.getByText('You pressed Collect: next · the link once the first one moves.')).toBeTruthy()
    fireEvent.click(screen.getByTestId('bridge-order-modal'))
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})
