// @vitest-environment jsdom
/**
 * Render smoke for the door on the day tile's red line (the owner's pick of 2026-11-18): *N are past their day.
 * Show them ›* is a press that hands the desk the late papers' door. The rule is `lienBoardDayLine.ts`.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render } from '@testing-library/react'
import LienBoard from './LienBoard'
import { buildLienBoard, type LienBoardInput } from '../../lib/jobs/lienBoard'
import { lienBoardLatePick } from '../../lib/jobs/lienBoardDayLine'
import type { LienDeskEntry, LienDeskPile } from '../../lib/jobs/lienDesk'

afterEach(cleanup)

function notice(jobId: string, pile: LienDeskPile, over: Partial<LienDeskEntry> = {}): LienDeskEntry {
  return { jobId, customerId: 'c1', gcCustomerId: 'gc1', openBalance: 1000, hasOwner: true, propertyKind: '', months: [], datedFromCreation: false, dueMonths: ['2026-08'], missedMonths: [], missedUnrecorded: [], affidavitDay: null, affidavitDaysLeft: null, earliestDeadline: '2026-12-15', daysLeft: 30, severity: 'quiet', item: null, policy: 'ask', pile, ...over }
}
const printed = (id: string) => ({ id, status: 'approved', fields: {}, months: [], voided_at: null, printed_at: '2026-11-09T10:00:00Z' }) as unknown as LienDeskEntry['item']
function board(over: Partial<LienBoardInput> = {}) {
  return buildLienBoard({
    todayYmd: '2026-11-15',
    // Two printed notices five days late and one on time: nothing at risk, two past their day.
    notices: [notice('2104', 'printed', { earliestDeadline: '2026-11-10', daysLeft: -5, item: printed('i1') }), notice('2111', 'printed', { earliestDeadline: '2026-11-10', daysLeft: -5, item: printed('i2') }), notice('2118', 'printed', { earliestDeadline: '2026-11-20', daysLeft: 5, item: printed('i3') })],
    affidavits: [],
    retainage: [],
    jobNumber: (id) => id,
    jobName: (id) => `Job ${id}`,
    gcName: () => 'Alder Ridge Builders',
    leaderName: 'Sam',
    ...over,
  })
}
const tile = () => document.querySelector<HTMLElement>('[data-lien-board-tile="by_day"]')!
const press = () => tile().querySelector<HTMLButtonElement>('[data-lien-board-tile-line-press]')

describe('LienBoard · the red line has its door (the owner’s pick of 2026-11-18)', () => {
  it('draws the late line as a press: the red sentence, then Show them › in the link colour, with no underline', () => {
    render(<LienBoard board={board()} isMobile={false} columnsOnly onTile={() => {}} />)
    const line = tile().querySelector<HTMLElement>('[data-lien-board-tile-line]')!
    const door = tile().querySelector<HTMLElement>('[data-lien-board-tile-line-door]')!
    expect(press()?.tagName).toBe('BUTTON')
    expect(press()?.getAttribute('data-lien-board-tile-line-press')).toBe('late')
    expect(line.textContent).toBe('2 are past their day.')
    expect(line.style.color).toBe('var(--text-red-700)')
    expect(door.textContent).toBe('Show them ›')
    expect(door.style.color).toBe('var(--text-link)')
    expect(press()?.textContent).toBe('2 are past their day. Show them ›')
    expect(press()?.style.textDecoration).toBe('')
    // The tile itself still only reads: the line is the one press on it.
    expect(tile().tagName).toBe('DIV')
  })

  it('hands the desk the late door, from the sentence or from the words', () => {
    const onTile = vi.fn()
    render(<LienBoard board={board()} isMobile={false} columnsOnly onTile={onTile} />)
    fireEvent.click(tile().querySelector('[data-lien-board-tile-line]')!)
    fireEvent.click(tile().querySelector('[data-lien-board-tile-line-door]')!)
    expect(onTile.mock.calls).toEqual([[{ kind: 'late' }], [{ kind: 'late' }]])
  })

  it('gives the at-risk line the same shape and its own door', () => {
    const onTile = vi.fn()
    render(<LienBoard board={board({ notices: [notice('2104', 'to_draft', { earliestDeadline: '2026-11-16', daysLeft: 1 })] })} isMobile={false} columnsOnly onTile={onTile} />)
    expect(press()?.getAttribute('data-lien-board-tile-line-press')).toBe('risk')
    expect(press()?.textContent).toMatch(/^1 will not make tomorrow as it stands\. Show them ›$/)
    fireEvent.click(press()!)
    expect(onTile).toHaveBeenCalledWith({ kind: 'risk' })
  })

  it('is words alone with no desk to hand the door to, and absent with nothing late', () => {
    render(<LienBoard board={board()} isMobile={false} columnsOnly />)
    expect(press()).toBeNull()
    expect(tile().querySelector('[data-lien-board-tile-line]')?.textContent).toBe('2 are past their day.')
    expect(tile().querySelector('[data-lien-board-tile-line-door]')).toBeNull()
    cleanup()
    render(<LienBoard board={board({ notices: [notice('2118', 'printed', { earliestDeadline: '2026-11-20', daysLeft: 5, item: printed('i3') })] })} isMobile={false} columnsOnly onTile={() => {}} />)
    expect(tile().querySelector('[data-lien-board-tile-line]')).toBeNull()
  })

  it('is a press a thumb can hit on a phone, and the line under the bins says what the list shows', () => {
    const b = board()
    render(<LienBoard board={b} isMobile onTile={() => {}} onPick={() => {}} pick={lienBoardLatePick(b)} shown={1} />)
    expect(press()?.style.minHeight).toBe('32px')
    expect(document.querySelector('[data-lien-board-pick-words]')?.textContent).toBe('Showing 1 row with a paper past its day.')
    // No bin is lit by this pick.
    expect(document.querySelector('[data-lien-board-bin][data-picked="yes"]')).toBeNull()
  })
})
