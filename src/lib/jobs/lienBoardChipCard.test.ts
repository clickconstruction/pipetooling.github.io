import { describe, expect, it } from 'vitest'
import type { LienDeskEntry, LienDeskPile } from './lienDesk'
import type { LienAffidavitEntry, LienAffidavitGate, LienAffidavitPile } from './lienDeskAffidavits'
import { plainWordsFailures } from '../plainWords'
import { buildLienBoard, lienBoardChipFor } from './lienBoard'
import { lienBoardCardPlace, lienBoardChipCard, type LienBoardChipFacts } from './lienBoardChipCard'

/** A Sunday; the 15th rolls to Monday the 16th. */
const TODAY = '2026-11-15'

function notice(jobId: string, pile: LienDeskPile, over: Partial<LienDeskEntry> = {}): LienDeskEntry {
  return { jobId, customerId: 'c1', gcCustomerId: 'gc1', openBalance: 5402, hasOwner: pile !== 'needs_owner', propertyKind: '', months: [], datedFromCreation: false, dueMonths: ['2026-09'], missedMonths: [], missedUnrecorded: [], affidavitDay: null, affidavitDaysLeft: null, earliestDeadline: '2026-11-16', daysLeft: 1, severity: 'red', item: null, sentItem: null, pile, ...over } as LienDeskEntry
}
const gate = (key: LienAffidavitGate['key'], ok: boolean): LienAffidavitGate => ({ key, ok, label: key })
function affidavit(jobId: string, pile: LienAffidavitPile, over: Partial<LienAffidavitEntry> = {}): LienAffidavitEntry {
  return { jobId, isSub: true, lastMonth: '2026-07', lastMonthFromCreation: false, deadline: '2026-12-15', daysLeft: 30, severity: 'quiet', openBalance: 5402, customerId: 'c1', gcCustomerId: 'gc1', propertyKind: '', gates: [gate('owner', true), gate('legal', true)], ready: true, item: null, pile, ...over } as LienAffidavitEntry
}

const board = () =>
  buildLienBoard({
    todayYmd: TODAY,
    notices: [notice('j858', 'to_draft'), notice('j804', 'awaiting', { earliestDeadline: null, daysLeft: null as unknown as number, openBalance: 0 }), notice('j700', 'sent')],
    affidavits: [affidavit('j858', 'needs_property', { gates: [gate('owner', true), gate('legal', false)] }), affidavit('j258', 'ready', { deadline: '2026-11-10', daysLeft: -5 })],
    retainage: [],
    jobNumber: (id) => id.slice(1),
    jobName: () => 'ZZ Service Visit',
    gcName: () => 'ZZ Builders',
    leaderName: 'Sam',
  })

const facts = (over: Partial<LienBoardChipFacts> = {}): LienBoardChipFacts => ({ todayYmd: TODAY, jobName: 'ZZ Service Visit, 9703 Sample Hl', address: '9703 Sample Hl, Schertz, TX', customer: 'ZZ Homeowner', gc: 'ZZ Builders', detail: 'September 2026', ...over })

describe('lienBoardChipCard', () => {
  it('says which job the number is: its name, its address and its customer, then the paper’s status in the Board’s words', () => {
    const b = board()
    const card = lienBoardChipCard(lienBoardChipFor(b, 'j858', 'notice')!, b, facts())
    expect(card).toEqual({
      title: '858 · ZZ Service Visit, 9703 Sample Hl',
      address: '9703 Sample Hl, Schertz, TX',
      customer: 'ZZ Homeowner',
      gc: 'ZZ Builders',
      paper: 'Monthly notice',
      stage: 'To send',
      detail: 'September 2026',
      day: 'Due Mon Nov 16 · 1 day left',
      urgency: 'day',
      risk: 'Will not make its day as it stands. 3 stages left and 1 working day.',
      owes: '$5,402 unpaid',
      other: 'Its lien affidavit is in Needs the property facts.',
      door: 'Press to open the notice.',
    })
  })

  it('the affidavit’s chip of the same job reads its own column, and names the notice as the other paper', () => {
    const b = board()
    const card = lienBoardChipCard(lienBoardChipFor(b, 'j858', 'affidavit')!, b, facts({ detail: 'The property record has no county and legal description.' }))
    expect([card.paper, card.stage, card.day, card.risk]).toEqual(['Lien affidavit', 'Needs the property facts', 'Due Tue Dec 15 · 30 days left', null])
    expect(card.other).toBe('Its monthly notice is in To send.')
    expect(card.door).toBe('Press to open the property record at the legal description.')
  })

  it('a paper past its day says so; one with no day, nothing open and no second paper leaves those lines out', () => {
    const b = board()
    const late = lienBoardChipCard(lienBoardChipFor(b, 'j258', 'affidavit')!, b, facts())
    expect(late.day).toBe('Was due Tue Nov 10 · 5 days late')
    expect(late.other).toBeNull()
    const waiting = lienBoardChipCard(lienBoardChipFor(b, 'j804', 'notice')!, b, facts({ detail: '  ' }))
    expect([waiting.stage, waiting.day, waiting.owes, waiting.detail, waiting.urgency]).toEqual(['Awaiting approval', null, null, null, 'waiting'])
    // A notice that went has no day to race.
    expect(lienBoardChipCard(lienBoardChipFor(b, 'j700', 'notice')!, b, facts()).day).toBeNull()
  })

  it('a job with no name, address or customer on it still has a card; the GC is left out when it is the customer', () => {
    const b = board()
    const bare = lienBoardChipCard(lienBoardChipFor(b, 'j858', 'notice')!, b, facts({ jobName: null, address: ' ', customer: undefined, gc: null }))
    expect([bare.title, bare.address, bare.customer, bare.gc]).toEqual(['858', null, null, null])
    expect(lienBoardChipCard(lienBoardChipFor(b, 'j858', 'notice')!, b, facts({ customer: 'ZZ Builders', gc: 'zz builders' })).gc).toBeNull()
  })

  it('the sentences the card writes keep to plain words', () => {
    const b = board()
    const card = lienBoardChipCard(lienBoardChipFor(b, 'j858', 'notice')!, b, facts())
    for (const s of [card.risk!, card.other!, card.door]) expect(plainWordsFailures(s)).toEqual([])
  })
})

describe('lienBoardCardPlace', () => {
  const chip = { left: 40, top: 120, width: 60, height: 22 }

  it('stands under the chip, flush with its left edge', () => {
    expect(lienBoardCardPlace({ chip, hostWidth: 1392, roomBelow: 600 })).toEqual({ left: 40, top: 148, above: false })
  })

  it('is held inside the Board at its right edge', () => {
    expect(lienBoardCardPlace({ chip: { ...chip, left: 1300 }, hostWidth: 1392, roomBelow: 600 }).left).toBe(1072)
    expect(lienBoardCardPlace({ chip: { ...chip, left: 10 }, hostWidth: 200, roomBelow: 600 }).left).toBe(0)
  })

  it('stands over the chip when the screen has no room under it, and there is room over it', () => {
    expect(lienBoardCardPlace({ chip: { ...chip, top: 520 }, hostWidth: 1392, roomBelow: 80 })).toEqual({ left: 40, top: 514, above: true })
    // No room either way: under it, where the page can scroll.
    expect(lienBoardCardPlace({ chip, hostWidth: 1392, roomBelow: 80 }).above).toBe(false)
  })
})
