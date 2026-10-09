// @vitest-environment jsdom
/**
 * The History door (punch list #73, PR 2): nothing is read until it is pressed; pressing opens the
 * window on the page's body, outside the title, and a click inside it never reaches the title's
 * hosts; the window's close shuts it.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen } from '@testing-library/react'

const load = vi.fn(async (_bidId: string) => [] as unknown[])
vi.mock('../../lib/bids/loadBidHistory', () => ({ loadBidHistory: (id: string) => load(id), putBackBidChange: vi.fn(), loadBidRemovedRows: async () => [], restoreBidRemovedRow: vi.fn() }))

import { BidHistoryDoor } from './BidHistoryDoor'
import { renderWithProviders, settle } from '../../test/renderSmokeMocks'

afterEach(() => { cleanup(); load.mockClear() })

describe('BidHistoryDoor', () => {
  it('reads nothing until pressed, then opens the window outside the heading', async () => {
    const hostClick = vi.fn()
    renderWithProviders(<h2 onClick={hostClick}>Elm St <BidHistoryDoor bid={{ id: 'bid-1', label: 'Elm St · B494', bidNumber: 'B494' }} /></h2>)
    await settle()
    expect(load).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'History' }))
    hostClick.mockClear()
    await settle()
    expect(load).toHaveBeenCalledWith('bid-1')
    const dialog = screen.getByRole('dialog')
    expect(dialog.closest('h2')).toBeNull()
    fireEvent.click(screen.getByText('Nothing has changed on this bid since its history began.'))
    expect(hostClick).not.toHaveBeenCalled()
  })
})
