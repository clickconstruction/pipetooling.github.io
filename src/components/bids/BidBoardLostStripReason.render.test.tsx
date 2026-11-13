// @vitest-environment jsdom
/**
 * Render smoke for the Lost pile's "Why did we lose?" strip (v2.6409): a bid lost GC by GC with a
 * reason on every card reads those reasons and asks nothing; a loss with none nudges and carries
 * the chips; a GC still without a reason is named beside the nudge.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen } from '@testing-library/react'
import { BidBoardLostStripReason } from './BidBoardLostStripReason'
import { renderWithProviders } from '../../test/renderSmokeMocks'

afterEach(cleanup)

const NOTE = 'Low bid was $63,500. There were 12 bidders. Click was the highest.'
const pk = (name: string, outcome: string | null, versions: Array<{ loss_category?: string | null; outcome_note?: string | null }>, sharedLetter = false) => ({ name, outcome, versions, sharedLetter })
const BP391 = [
  pk('Structura, Inc. – San Antonio', 'lost', [{ loss_category: 'gc_lost', outcome_note: null }]),
  pk('PlanHub - Subcontractor Prime Opportunity', 'lost', [{ loss_category: 'price', outcome_note: NOTE }]),
  pk('Wrenman Commercial', null, [], true),
]

describe('BidBoardLostStripReason', () => {
  it("BP391: every GC card carries a reason — one line per GC, the note under PlanHub's, no nudge and no chips", () => {
    renderWithProviders(<BidBoardLostStripReason bid={{ id: 'b391', loss_category: null, loss_reason: null }} packets={BP391} saving={false} onSelect={() => {}} />)
    const lines = screen.getByTestId('lost-strip-gc-lines')
    expect(lines.textContent).toContain('Structura, Inc. – San Antonio GC lost the project')
    expect(lines.textContent).toContain('PlanHub - Subcontractor Prime Opportunity Price too high')
    expect(lines.textContent).toContain(NOTE)
    expect(screen.queryByText(/Add why/)).toBeNull()
    expect(screen.queryByRole('button', { name: 'GC lost the project' })).toBeNull()
  })

  it("the bid's own category still reads as before, category first then what they said", () => {
    renderWithProviders(<BidBoardLostStripReason bid={{ id: 'b1', loss_category: 'price', loss_reason: 'they went cheaper' }} saving={false} onSelect={() => {}} />)
    expect(screen.getByText('Price too high — they went cheaper')).toBeTruthy()
    expect(screen.queryByText(/Add why/)).toBeNull()
  })

  it('no reason anywhere: the nudge and the six chips, and a chip tap hands back its key', () => {
    const onSelect = vi.fn()
    renderWithProviders(<BidBoardLostStripReason bid={{ id: 'b2', loss_category: null, loss_reason: '' }} packets={[pk('Kestrin', 'lost', [{ loss_category: null }])]} saving={false} onSelect={onSelect} />)
    expect(screen.getByText(/Add why: an uncategorized loss/)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'GC lost the project' }))
    expect(onSelect).toHaveBeenCalledWith('gc_lost')
  })

  it('one GC still without a reason: the recorded line reads, the nudge names the GC that owes one, the chips stay', () => {
    renderWithProviders(
      <BidBoardLostStripReason
        bid={{ id: 'b3', loss_category: null, loss_reason: null }}
        packets={[pk('Structura', 'lost', [{ loss_category: 'gc_lost' }]), pk('Brund & Assoc.', 'lost', [{ loss_category: null }])]}
        saving={false}
        onSelect={() => {}}
      />,
    )
    expect(screen.getByTestId('lost-strip-gc-lines').textContent).toContain('Structura GC lost the project')
    expect(screen.getByText(/Still no reason from Brund & Assoc\./)).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Price too high' })).toBeTruthy()
  })
})
