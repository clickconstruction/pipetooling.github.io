// @vitest-environment jsdom
/**
 * Punch list #357 PR 4: the Workbench's difficulty strip. The chip reads the points and the cost with what that is on
 * the price; the fold lists the lines, the lines taken off and the door to the rating; a GC rated again since the bid
 * was priced shows the line with the press that reads it in; Take a line off needs a reason and names the line.
 */
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { BID_DIFFICULTY_WORDS as W, type BidDifficulty } from '../../lib/bids/bidDifficulty'
import { DIFFICULTY_CRITERIA_V1 } from '../../lib/bids/difficultyCriteria'
import { gcDifficultyStanding, type GcDifficultyRating } from '../../lib/bids/gcDifficultyRating'
import BidDifficultyStrip from './BidDifficultyStrip'

const V1 = { id: 'v1', version: 1, body: DIFFICULTY_CRITERIA_V1 }
const RATING: GcDifficultyRating = { id: 'r1', customerId: 'c1', criteriaVersionId: 'v1', picks: { field: 2, office: 1 }, pickReasons: {}, note: 'Moved us from C to A.', ratedByName: 'Robert', ratedAt: '2026-11-14T20:00:00Z' }
const STANDING = gcDifficultyStanding(RATING, [V1], V1)

const PIN: BidDifficulty = {
  id: 'pin1',
  bidId: 'b1',
  costEstimateId: 'ce1',
  ratingId: 'r1',
  criteriaVersionId: 'v1',
  priceVersionId: 'p1',
  picks: { field: 2, office: 1 },
  lines: [
    { key: 'field', name: 'Field and superintendent', points: 2, hours: 48, rate: 80, amount: 3840, sentence: 'The order of work changes after we mobilize.', words: '10% of 480 field hours at $80' },
    { key: 'office', name: 'Their office', points: 1, hours: 12, rate: 80, amount: 960, sentence: 'Pay apps come back for paperwork.', words: '12 office hours at $80' },
  ],
  rowIds: ['o1', 'o2'],
  removed: [],
  points: 3,
  totalUsd: 4800,
  fieldHours: 480,
  laborRate: 80,
  ownCostUsd: 114266,
  carriedUsd: 172400,
  pricedByName: 'Micah',
  pricedAt: '2026-11-15T10:00:00Z',
}

function draw(over: Partial<Parameters<typeof BidDifficultyStrip>[0]> = {}) {
  const onReadIn = vi.fn()
  const onTakeOff = vi.fn()
  render(
    <MemoryRouter>
      <BidDifficultyStrip pin={PIN} standing={STANDING} stale={null} busy={null} failed={null} lastWrite={null} marginPct={30} sent={false} priceVersionWords="price list version 1 · 2026-11-15 by the app" byName="Micah" onReadIn={onReadIn} onTakeOff={onTakeOff} {...over} />
    </MemoryRouter>,
  )
  return { onReadIn, onTakeOff }
}

afterEach(cleanup)

describe('BidDifficultyStrip', () => {
  it('the chip, what it is on the price, and the fold with the lines and the door to the rating', () => {
    draw()
    const chip = screen.getByTestId('bid-difficulty-chip')
    expect(chip.textContent).toContain('Difficulty · 3 points · +$4,800 in cost')
    expect(screen.getByText('about +$6,857 on the price at 30%')).toBeTruthy()
    fireEvent.click(chip)
    const fold = within(screen.getByTestId('bid-difficulty-fold'))
    expect(fold.getByTestId('bid-difficulty-line-field').textContent).toBe('Field and superintendent 2 · $3,840 · 10% of 480 field hours at $80: the order of work changes after we mobilize.')
    expect(fold.getByText('Rated by Robert on 2026-11-14 under criteria version 1.')).toBeTruthy()
    expect(fold.getByText('priced by Micah on 2026-11-15 · price list version 1 · 2026-11-15 by the app')).toBeTruthy()
    expect((fold.getByRole('link', { name: W.openRating }) as HTMLAnchorElement).getAttribute('href')).toBe('/customers/c1#gc-difficulty')
    expect(fold.getByText('Robert: “Moved us from C to A.”')).toBeTruthy()
  })

  it('rated again since the bid was priced: the line and the press that reads it in', () => {
    const { onReadIn } = draw({ stale: { kind: 'higher', words: 'Rated higher since this was priced: 5 points now, 3 when priced, by Taunya on 2026-11-20.' } })
    expect(screen.getByTestId('bid-difficulty-stale').textContent).toContain('Rated higher since this was priced')
    fireEvent.click(screen.getByRole('button', { name: W.readIn }))
    expect(onReadIn).toHaveBeenCalledTimes(1)
  })

  it('take a line off: the press is dead without a reason, then names the line', () => {
    const { onTakeOff } = draw()
    fireEvent.click(screen.getByTestId('bid-difficulty-chip'))
    fireEvent.click(screen.getByRole('button', { name: W.takeOff }))
    const form = within(screen.getByTestId('bid-difficulty-take-off'))
    const press = form.getByRole('button', { name: W.takeOffPress('Field and superintendent') }) as HTMLButtonElement
    expect(press.disabled).toBe(true)
    expect(press.title).toBe(W.takeOffNoReason)
    fireEvent.change(form.getByLabelText(W.takeOffLine), { target: { value: 'office' } })
    fireEvent.change(form.getByLabelText(W.takeOffReason), { target: { value: 'Their office on this one is the good one' } })
    const press2 = form.getByRole('button', { name: W.takeOffPress('Their office') }) as HTMLButtonElement
    expect(press2.disabled).toBe(false)
    fireEvent.click(press2)
    expect(onTakeOff).toHaveBeenCalledWith('office', 'Their office on this one is the good one')
  })

  it('a sent bid reads the lines and the removals, with no door to take one off', () => {
    draw({ sent: true, pin: { ...PIN, lines: [PIN.lines[0]!], points: 2, totalUsd: 3840, removed: [{ key: 'office', name: 'Their office', amount: 960, reason: 'their office on this one is the good one', byName: 'Robert', at: '2026-11-20T10:00:00Z' }] } })
    fireEvent.click(screen.getByTestId('bid-difficulty-chip'))
    expect(screen.getByTestId('bid-difficulty-removed').textContent).toBe('Their office · $960 taken off by Robert on 2026-11-20: their office on this one is the good one')
    expect(screen.queryByRole('button', { name: W.takeOff })).toBeNull()
  })

  it('no pin draws nothing; a write in flight says so', () => {
    const { container } = render(
      <MemoryRouter>
        <BidDifficultyStrip pin={null} standing={STANDING} stale={null} busy={null} failed={null} lastWrite={null} marginPct={30} sent={false} priceVersionWords={null} byName="" onReadIn={() => {}} onTakeOff={() => {}} />
      </MemoryRouter>,
    )
    expect(container.textContent).toBe('')
    cleanup()
    draw({ pin: null, busy: 'writing' })
    expect(screen.getByTestId('bid-difficulty-strip').textContent).toBe(W.writing)
  })
})
