// @vitest-environment jsdom
/**
 * Render smoke for the words on the Board's tiles that are presses (the owner's pick of 2026-11-18): *Show them ›* on
 * the second tile and *Open the run ›* on the third. The words are `lienBoardTileDoor.ts`; this is the wiring.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render } from '@testing-library/react'
import LienBoard from './LienBoard'
import { buildLienBoard, lienBoardLeaderPick, lienBoardPick, type LienBoardInput } from '../../lib/jobs/lienBoard'
import { lienBoardNoticePrint } from '../../lib/jobs/lienBoardPrints'
import type { LienDeskEntry, LienDeskPile } from '../../lib/jobs/lienDesk'
import type { LienAffidavitEntry, LienAffidavitPile } from '../../lib/jobs/lienDeskAffidavits'

afterEach(cleanup)

function notice(jobId: string, pile: LienDeskPile, over: Partial<LienDeskEntry> = {}): LienDeskEntry {
  return { jobId, customerId: 'c1', gcCustomerId: 'gc1', openBalance: 1000, hasOwner: true, propertyKind: '', months: [], datedFromCreation: false, dueMonths: ['2026-08'], missedMonths: [], missedUnrecorded: [], affidavitDay: null, affidavitDaysLeft: null, earliestDeadline: '2026-12-15', daysLeft: 30, severity: 'quiet', item: null, policy: 'ask', pile, ...over }
}
function affidavit(jobId: string, pile: LienAffidavitPile, over: Partial<LienAffidavitEntry> = {}): LienAffidavitEntry {
  return { jobId, isSub: true, lastMonth: '2026-07', lastMonthFromCreation: false, deadline: '2026-12-15', daysLeft: 30, severity: 'quiet', openBalance: 1000, customerId: 'c1', gcCustomerId: 'gc1', propertyKind: '', gates: [{ key: 'owner', ok: true, label: 'owner' }], ready: true, item: null, pile, ...over }
}
const printed = { id: 'i3', status: 'approved', fields: {}, months: [], voided_at: null, printed_at: '2026-11-14T10:00:00Z' } as unknown as LienDeskEntry['item']
function board(over: Partial<LienBoardInput> = {}) {
  return buildLienBoard({
    todayYmd: '2026-11-15',
    notices: [notice('2104', 'awaiting'), notice('2111', 'printed', { item: printed })],
    affidavits: [affidavit('2118', 'awaiting')],
    retainage: [],
    jobNumber: (id) => id,
    jobName: (id) => `Job ${id}`,
    gcName: () => 'Alder Ridge Builders',
    leaderName: 'Sam',
    ...over,
  })
}
const tileEl = (key: string) => document.querySelector<HTMLElement>(`[data-lien-board-tile="${key}"]`)!
const door = (key: string) => tileEl(key).querySelector<HTMLElement>('[data-lien-board-tile-door]')

describe('LienBoard · a tile that is a press says where it goes (the owner’s pick of 2026-11-18)', () => {
  it('writes Show them › on the second tile and Open the run › on the third, in the link colour, and nothing on the other two', () => {
    render(<LienBoard board={board()} isMobile={false} columnsOnly onTile={() => {}} />)
    expect(door('waiting')?.textContent).toBe('Show them ›')
    expect(door('waiting')?.getAttribute('data-lien-board-tile-door')).toBe('leader')
    expect(door('in_mail')?.textContent).toBe('Open the run ›')
    expect(door('in_mail')?.style.color).toBe('var(--text-link)')
    expect(door('by_day')).toBeNull()
    expect(door('unpaid')).toBeNull()
  })

  it('keeps the words inside the press, so the whole tile still opens the door', () => {
    const onTile = vi.fn()
    render(<LienBoard board={board()} isMobile={false} columnsOnly onTile={onTile} />)
    expect(tileEl('waiting').tagName).toBe('BUTTON')
    fireEvent.click(door('waiting')!)
    expect(onTile).toHaveBeenCalledWith({ kind: 'leader' })
    fireEvent.click(door('in_mail')!)
    expect(onTile).toHaveBeenLastCalledWith({ kind: 'run' })
  })

  it('writes no words on a tile that only reads: no handler, or nothing waiting', () => {
    render(<LienBoard board={board()} isMobile={false} columnsOnly />)
    expect(document.querySelector('[data-lien-board-tile-door]')).toBeNull()
    cleanup()
    render(<LienBoard board={board({ notices: [notice('2104', 'to_draft')], affidavits: [] })} isMobile={false} columnsOnly onTile={() => {}} />)
    expect(tileEl('waiting').getAttribute('data-static')).toBe('yes')
    expect(document.querySelector('[data-lien-board-tile-door]')).toBeNull()
  })

  it('says Show every row › on the second tile while the list is narrowed to the leader’s papers, and Show them › under a pressed bin', () => {
    const b = board()
    const { rerender } = render(<LienBoard board={b} isMobile={false} columnsOnly onTile={() => {}} onPick={() => {}} pick={lienBoardLeaderPick(b, 'Sam')} shown={2} />)
    expect(door('waiting')?.textContent).toBe('Show every row ›')
    expect(tileEl('waiting').getAttribute('aria-pressed')).toBe('true')
    expect(door('in_mail')?.textContent).toBe('Open the run ›')
    expect(tileEl('in_mail').hasAttribute('aria-pressed')).toBe(false)
    rerender(<LienBoard board={b} isMobile={false} columnsOnly onTile={() => {}} onPick={() => {}} pick={lienBoardPick(b, ['notice:awaiting'])} shown={1} />)
    expect(door('waiting')?.textContent).toBe('Show them ›')
    expect(tileEl('waiting').getAttribute('aria-pressed')).toBe('false')
  })

  it('on a phone, words the second tile and leaves the third alone where the print stands under the tiles', () => {
    const b = board()
    const side = lienBoardNoticePrint({ toPrint: 0, waits: 0, printed: 1 })
    expect(side).not.toBeNull()
    expect(b.tiles.find((t) => t.key === 'in_mail')?.destination).toEqual({ kind: 'run' })
    render(<LienBoard board={b} isMobile onTile={() => {}} prints={{ notice: side, affidavit: null, onPress: () => {}, onLeft: () => {}, onNote: () => {} }} />)
    expect(door('waiting')?.textContent).toBe('Show them ›')
    // The third tile only reads there: the print is the same door, right under it.
    expect(tileEl('in_mail').getAttribute('data-static')).toBe('yes')
    expect(door('in_mail')).toBeNull()
  })

  it('on a phone a tile’s door ends the line it acts on, and the day’s label is the day and then its parts (the owner’s go of 2026-11-23)', () => {
    const onTile = vi.fn()
    const b = board()
    render(<LienBoard board={b} isMobile onTile={onTile} />)
    // The second tile: *2 to approve · Show them ›* on one line, no door at the top corner.
    const waiting = door('waiting')!
    expect(waiting.getAttribute('data-place')).toBe('line')
    expect(waiting.style.position).toBe('')
    expect(waiting.closest('[data-lien-board-tile-line]')).toBeTruthy()
    expect(tileEl('waiting').querySelector('[data-lien-board-tile-line]')!.textContent).toBe(`${b.tiles.find((t) => t.key === 'waiting')!.line} · Show them ›`)
    expect(tileEl('waiting').style.position).toBe('')
    // The third tile has no print under it here, so it is a press, and its door ends its line too.
    expect(door('in_mail')!.getAttribute('data-place')).toBe('line')
    // The press is the whole tile still.
    fireEvent.click(waiting)
    expect(onTile).toHaveBeenCalledWith({ kind: 'leader' })
    // The first tile: the day, then its parts, each on a line of its own.
    const day = tileEl('by_day')
    const whole = b.tiles.find((t) => t.key === 'by_day')!.label
    expect(whole).toContain(' · ')
    expect(day.querySelector('[data-lien-board-tile-label]')!.textContent).toBe(whole.slice(0, whole.indexOf(' · ')))
    expect(day.querySelector('[data-lien-board-tile-parts]')!.textContent).toBe(whole.slice(whole.indexOf(' · ') + 3))
    cleanup()
    // A computer's tile is as it was: one label, and the door at the top right.
    render(<LienBoard board={b} isMobile={false} columnsOnly onTile={() => {}} />)
    expect(tileEl('by_day').querySelector('[data-lien-board-tile-label]')!.textContent).toBe(whole)
    expect(document.querySelector('[data-lien-board-tile-parts]')).toBeNull()
    expect(door('waiting')!.style.position).toBe('absolute')
    expect(door('waiting')!.hasAttribute('data-place')).toBe(false)
    expect(tileEl('waiting').querySelector('[data-lien-board-tile-line]')!.textContent).toBe(b.tiles.find((t) => t.key === 'waiting')!.line)
  })
})
