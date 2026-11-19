import { describe, expect, it } from 'vitest'
import { buildLienBoard, lienBoardLeaderPick, lienBoardPick, lienBoardPickWords, lienBoardRiskPick, type LienBoardInput } from './lienBoard'
import { LIEN_BOARD_TILE_DOOR, lienBoardTileDoorWords, lienBoardTilePicked } from './lienBoardTileDoor'
import type { LienDeskEntry, LienDeskPile } from './lienDesk'
import type { LienAffidavitEntry, LienAffidavitPile } from './lienDeskAffidavits'

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
    // One notice awaiting the leader, one printed and waiting on its mail number, one affidavit awaiting him.
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
const tile = (b: ReturnType<typeof board>, key: string) => b.tiles.find((t) => t.key === key)!

describe('lienBoardTileDoorWords — what a tile’s press says it does', () => {
  it('names the two doors the tiles have, and says nothing for a tile that only reads', () => {
    expect(lienBoardTileDoorWords({ kind: 'leader' })).toBe('Show them')
    expect(lienBoardTileDoorWords({ kind: 'run' })).toBe('Open the run')
    expect(lienBoardTileDoorWords(null)).toBeNull()
    expect(lienBoardTileDoorWords(undefined)).toBeNull()
  })

  it('leaves the red line’s door to the line itself', () => {
    expect(lienBoardTileDoorWords({ kind: 'risk' })).toBeNull()
  })

  it('says the way back while the list is narrowed, in the words of the press under the bins', () => {
    const b = board()
    expect(lienBoardTileDoorWords({ kind: 'leader' }, true)).toBe('Show every row')
    expect(LIEN_BOARD_TILE_DOOR.leaderPicked).toBe(lienBoardPickWords(lienBoardLeaderPick(b, 'Sam'), 2).clear)
    // The run opens a window: it has no second state.
    expect(lienBoardTileDoorWords({ kind: 'run' }, true)).toBe('Open the run')
  })

  it('gives words to every tile of a real board that is a press, and to no other', () => {
    const b = board()
    expect(b.tiles.map((t) => [t.key, Boolean(t.destination), lienBoardTileDoorWords(t.destination)])).toEqual([
      ['by_day', false, null],
      ['waiting', true, 'Show them'],
      ['in_mail', true, 'Open the run'],
      ['unpaid', false, null],
    ])
    // With nothing waiting and nothing to print, both tiles only read, and neither has words.
    const quiet = board({ notices: [notice('2104', 'to_draft')], affidavits: [] })
    expect(quiet.tiles.map((t) => lienBoardTileDoorWords(t.destination))).toEqual([null, null, null, null])
  })
})

describe('lienBoardTilePicked — whether the list shows this tile’s papers', () => {
  it('is true for the second tile under the leader’s pick, whatever the leader is called', () => {
    const b = board()
    expect(lienBoardTilePicked(tile(b, 'waiting'), lienBoardLeaderPick(b, 'Sam'))).toBe(true)
    const unnamed = board({ leaderName: null })
    expect(tile(unnamed, 'waiting').label).toBe('waiting on the leader')
    expect(lienBoardTilePicked(tile(unnamed, 'waiting'), lienBoardLeaderPick(unnamed, null))).toBe(true)
  })

  it('is false with no pick, under a pressed bin and under the red line’s pick', () => {
    const b = board()
    expect(lienBoardTilePicked(tile(b, 'waiting'), null)).toBe(false)
    expect(lienBoardTilePicked(tile(b, 'waiting'), lienBoardPick(b, ['notice:awaiting', 'affidavit:awaiting']))).toBe(false)
    expect(lienBoardTilePicked(tile(b, 'waiting'), lienBoardRiskPick(b))).toBe(false)
  })

  it('is false for every other tile under the leader’s pick', () => {
    const b = board()
    const pick = lienBoardLeaderPick(b, 'Sam')
    expect(b.tiles.filter((t) => lienBoardTilePicked(t, pick)).map((t) => t.key)).toEqual(['waiting'])
  })
})
