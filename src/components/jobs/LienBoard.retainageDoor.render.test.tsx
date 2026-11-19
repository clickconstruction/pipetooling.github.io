// @vitest-environment jsdom
/**
 * Render smoke for the door on the Board's Retainage line (the owner's pick of 2026-11-18): the line ends in
 * *Open ›* when the desk hands a door. The words are `lienBoardRetainageDoor.ts`; the desk's side is in
 * `LienDesk.render.test.tsx`.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render } from '@testing-library/react'
import LienBoard from './LienBoard'
import { buildLienBoard, type LienBoardInput } from '../../lib/jobs/lienBoard'
import type { LienDeskEntry, LienDeskPile } from '../../lib/jobs/lienDesk'

afterEach(cleanup)

function notice(jobId: string, pile: LienDeskPile, over: Partial<LienDeskEntry> = {}): LienDeskEntry {
  return { jobId, customerId: 'c1', gcCustomerId: 'gc1', openBalance: 1000, hasOwner: true, propertyKind: '', months: [], datedFromCreation: false, dueMonths: ['2026-08'], missedMonths: [], missedUnrecorded: [], affidavitDay: null, affidavitDaysLeft: null, earliestDeadline: '2026-12-15', daysLeft: 30, severity: 'quiet', item: null, policy: 'ask', pile, ...over }
}
function board(over: Partial<LienBoardInput> = {}) {
  return buildLienBoard({
    todayYmd: '2026-11-15',
    notices: [notice('2104', 'to_draft')],
    affidavits: [],
    retainage: [],
    // Six jobs whose retainage looks held and is not on the job: the line with no pile in it.
    retainageUnrecorded: 6,
    jobNumber: (id) => id,
    jobName: (id) => `Job ${id}`,
    gcName: () => 'Alder Ridge Builders',
    leaderName: 'Sam',
    ...over,
  })
}
const row = () => document.querySelector<HTMLElement>('[data-lien-board-retainage-row]')
const door = () => document.querySelector<HTMLButtonElement>('[data-lien-board-retainage-door]')

describe('LienBoard · the Retainage line has its door (the owner’s pick of 2026-11-18)', () => {
  it('ends the line in Open ›, a press in the link colour that opens the desk’s door', () => {
    const onRetainage = vi.fn()
    render(<LienBoard board={board()} isMobile={false} columnsOnly onRetainage={onRetainage} />)
    expect(row()?.textContent).toBe('Retainage · 6 look held, not on the job · Open ›')
    // The words keep their own mark and their own text, so what read the line still reads it.
    expect(document.querySelector('[data-lien-board-column="notice"] [data-lien-board-retainage]')?.textContent).toBe('Retainage · 6 look held, not on the job')
    expect(door()?.tagName).toBe('BUTTON')
    expect(door()?.textContent).toBe('Open ›')
    expect(door()?.style.color).toBe('var(--text-link)')
    expect(door()?.getAttribute('aria-label')).toBe('Open the Retainage list on By paper')
    fireEvent.click(door()!)
    expect(onRetainage).toHaveBeenCalledTimes(1)
  })

  it('is words alone with no door to hand', () => {
    render(<LienBoard board={board()} isMobile={false} columnsOnly />)
    expect(row()?.textContent).toBe('Retainage · 6 look held, not on the job')
    expect(door()).toBeNull()
  })

  it('draws no line and no door with nothing on the retainage desk', () => {
    render(<LienBoard board={board({ retainageUnrecorded: 0 })} isMobile={false} columnsOnly onRetainage={() => {}} />)
    expect(row()).toBeNull()
    expect(door()).toBeNull()
  })

  it('is a press a thumb can hit on a phone', () => {
    render(<LienBoard board={board()} isMobile onRetainage={() => {}} />)
    expect(door()?.style.minHeight).toBe('32px')
  })
})
