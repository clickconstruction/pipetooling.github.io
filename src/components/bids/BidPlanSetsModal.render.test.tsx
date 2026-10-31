// @vitest-environment jsdom
/**
 * The Bid Board's plans picker (v2.6169): every set by name, date, memo and file words, the robot's
 * chip, Open ↗ through the external-browser door, and Edit bid closing the window first.
 */
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, screen } from '@testing-library/react'
import { renderWithProviders } from '../../test/renderSmokeMocks'
import { BidPlanSetsModal } from './BidPlanSetsModal'
import { planSetsForBid, type BidPlanSetRow } from '../../lib/bids/bidPlanSets'

const opened: string[] = []
vi.mock('../../lib/openInExternalBrowser', () => ({ openInExternalBrowser: (url: string) => opened.push(url) }))

const rows: BidPlanSetRow[] = [
  { id: 'r1', bid_id: 'b1', name: 'Issued set', memo: 'A-001 to P-601', plan_date: '2026-09-14', link: 'https://drive.google.com/drive/folders/issued', file_name: '6 PDFs', file_size: 92_274_688, file_count: 6, checked_at: '2026-10-30T15:00:00Z', check_note: null, created_by: null, created_at: '2026-09-14T12:00:00Z', updated_at: '2026-09-14T12:00:00Z' },
  { id: 'r2', bid_id: 'b1', name: 'Addendum 1', memo: 'P-201 and P-401 redrawn, two more floor drains', plan_date: '2026-10-02', link: 'https://drive.google.com/drive/folders/add1', file_name: '2 PDFs', file_size: 11_534_336, file_count: 2, checked_at: '2026-10-30T15:00:00Z', check_note: null, created_by: null, created_at: '2026-10-02T12:00:00Z', updated_at: '2026-10-02T12:00:00Z' },
]
const bid = { id: 'b1', bid_number: '482', project_name: 'Oak Hollow Dental TI', plans_link: 'https://drive.google.com/drive/folders/add1' }

describe('BidPlanSetsModal', () => {
  it('lists the sets newest first with their words, marks the robot’s, opens a set and closes before Edit bid', () => {
    const onClose = vi.fn()
    const onEditBid = vi.fn()
    renderWithProviders(<BidPlanSetsModal bid={bid} items={planSetsForBid(rows, bid)} onClose={onClose} onEditBid={onEditBid} />)
    expect(screen.getByRole('dialog', { name: 'Plans on b482 · Oak Hollow Dental TI' })).toBeTruthy()
    const sets = screen.getAllByTestId('bid-plan-set')
    expect(sets).toHaveLength(2)
    expect(sets[0]!.textContent).toContain('Addendum 1')
    expect(sets[0]!.textContent).toContain('Oct 2, 2026')
    expect(sets[0]!.textContent).toContain('two more floor drains')
    expect(sets[0]!.textContent).toContain('2 PDFs · 11 MB')
    expect(sets[1]!.textContent).toContain('6 PDFs · 88 MB')
    // The robot's chip sits on the set carrying the bid's plans link alone.
    expect(sets[0]!.querySelector('[data-testid="bid-plan-set-robot"]')).toBeTruthy()
    expect(sets[1]!.querySelector('[data-testid="bid-plan-set-robot"]')).toBeNull()

    fireEvent.click(screen.getAllByRole('button', { name: 'Open ↗' })[1]!)
    expect(opened).toEqual(['https://drive.google.com/drive/folders/issued'])

    fireEvent.click(screen.getByRole('button', { name: 'Edit bid' }))
    expect(onClose).toHaveBeenCalledTimes(1)
    expect(onEditBid).toHaveBeenCalledTimes(1)
  })

  it('a bid whose plans link is on no row lists it as Plans, the robot’s', () => {
    const items = planSetsForBid([rows[0]!], { plans_link: 'https://drive.google.com/drive/folders/other' })
    renderWithProviders(<BidPlanSetsModal bid={bid} items={items} onClose={() => {}} />)
    const sets = screen.getAllByTestId('bid-plan-set')
    expect(sets).toHaveLength(2)
    expect(sets[1]!.textContent).toContain('Plans')
    expect(sets[1]!.textContent).toContain('Not read yet')
    expect(sets[1]!.querySelector('[data-testid="bid-plan-set-robot"]')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Edit bid' })).toBeNull()
  })
})
