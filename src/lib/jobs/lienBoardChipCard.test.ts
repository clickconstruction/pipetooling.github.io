import { describe, expect, it } from 'vitest'
import type { LienDeskEntry, LienDeskPile } from './lienDesk'
import type { LienAffidavitEntry, LienAffidavitGate, LienAffidavitPile } from './lienDeskAffidavits'
import { plainWordsFailures } from '../plainWords'
import { buildLienBoard, lienBoardChipFor, lienBoardStagesLeft } from './lienBoard'
import { LIEN_BOARD_CARD_EDGE_PX, LIEN_BOARD_CARD_HEIGHT_PX, LIEN_BOARD_CARD_STAGE_PX, lienBoardCardHeight, lienBoardCardPlace, lienBoardChipCard, type LienBoardChipFacts } from './lienBoardChipCard'

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

const facts = (over: Partial<LienBoardChipFacts> = {}): LienBoardChipFacts => ({ todayYmd: TODAY, jobName: 'ZZ Service Visit, 9703 Sample Hl', address: '9703 Sample Hl, Schertz, TX', customer: 'ZZ Homeowner', gc: 'ZZ Builders', detail: 'September 2026', leader: 'Sam', ...over })

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
      stage: 'To send for Master approval',
      detail: 'September 2026',
      day: 'Due Mon Nov 16 · 1 day left',
      urgency: 'day',
      risk: 'Will not make its day as it stands. Still to do, with 1 working day left:',
      left: ['Send it for approval', 'Sam approves and signs it', 'Print it, mail it and enter its mail number'],
      owes: '$5,402 unpaid',
      other: 'Its lien affidavit is in Needs the property facts.',
      door: 'Press to open the notice.',
    })
  })

  it('the affidavit’s chip of the same job reads its own column, and names the notice as the other paper', () => {
    const b = board()
    const card = lienBoardChipCard(lienBoardChipFor(b, 'j858', 'affidavit')!, b, facts({ detail: 'The property record has no county and legal description.' }))
    expect([card.paper, card.stage, card.day, card.risk]).toEqual(['Lien affidavit', 'Needs the property facts', 'Due Tue Dec 15 · 30 days left', null])
    // It will make its day, so the card names no stages: the bin and the press already say what is next.
    expect(card.left).toEqual([])
    expect(card.other).toBe('Its monthly notice is in To send for Master approval.')
    expect(card.door).toBe('Press to open the property record at the legal description.')
  })

  it('a paper past its day says so; one with no day, nothing open and no second paper leaves those lines out', () => {
    const b = board()
    const late = lienBoardChipCard(lienBoardChipFor(b, 'j258', 'affidavit')!, b, facts())
    expect(late.day).toBe('Was due Tue Nov 10 · 5 days late')
    expect(late.other).toBeNull()
    const waiting = lienBoardChipCard(lienBoardChipFor(b, 'j804', 'notice')!, b, facts({ detail: '  ' }))
    expect([waiting.stage, waiting.day, waiting.owes, waiting.detail, waiting.urgency]).toEqual(['Awaiting Master approval', null, null, null, 'waiting'])
    // A notice that went has no day to race.
    expect(lienBoardChipCard(lienBoardChipFor(b, 'j700', 'notice')!, b, facts()).day).toBeNull()
  })

  it('a job with no name, address or customer on it still has a card; the GC is left out when it is the customer', () => {
    const b = board()
    const bare = lienBoardChipCard(lienBoardChipFor(b, 'j858', 'notice')!, b, facts({ jobName: null, address: ' ', customer: undefined, gc: null }))
    expect([bare.title, bare.address, bare.customer, bare.gc]).toEqual(['858', null, null, null])
    expect(lienBoardChipCard(lienBoardChipFor(b, 'j858', 'notice')!, b, facts({ customer: 'ZZ Builders', gc: 'zz builders' })).gc).toBeNull()
  })

  it('a held paper says so after the name of the bin it stands in, and its other paper’s card says it is held there (v2.7783)', () => {
    const closed = [gate('owner', true), gate('legal', true), gate('homestead_answer', false)]
    const approved = { id: 'a1', status: 'approved', fields: {}, months: [], voided_at: null } as unknown as LienAffidavitEntry['item']
    const b = buildLienBoard({ todayYmd: TODAY, notices: [notice('j858', 'sent')], affidavits: [affidavit('j858', 'held', { item: approved, ready: false, gates: closed })], retainage: [], jobNumber: (id) => id.slice(1), jobName: () => 'ZZ Service Visit', gcName: () => 'ZZ Builders', leaderName: 'Sam' })
    const held = lienBoardChipCard(lienBoardChipFor(b, 'j858', 'affidavit')!, b, facts({ detail: 'Nobody has answered whether this home is a homestead. The approval stands.' }))
    expect(held.stage).toBe('Ready to file · held')
    expect(held.door).toBe('Press to open the property record at the homestead question.')
    expect(lienBoardChipCard(lienBoardChipFor(b, 'j858', 'notice')!, b, facts()).other).toBe('Its lien affidavit is held in Ready to file.')
  })
  it('a paper that will not make its day names the stages left, as many as the Board counted, with the job’s leader by name (v2.7419)', () => {
    const b = board()
    const chip = lienBoardChipFor(b, 'j858', 'notice')!
    const card = lienBoardChipCard(chip, b, facts())
    // Taunya's ask of 2026-11-15: *3 stages left* did not say which three.
    expect(card.risk).not.toMatch(/stages? left/)
    expect(card.left).toHaveLength(chip.stepsLeft)
    expect(card.left).toEqual(lienBoardStagesLeft(chip, 'Sam'))
    // No leader known on the job: the stage still reads, and nobody is named who is not known.
    expect(lienBoardChipCard(chip, b, facts({ leader: ' ' })).left[1]).toBe('The leader approves and signs it')
    // The same day with nothing to work in: due on a Sunday, read on the Saturday.
    const weekend = buildLienBoard({ todayYmd: '2026-11-14', notices: [notice('j1', 'to_draft', { earliestDeadline: '2026-11-15', daysLeft: 1 })], affidavits: [], retainage: [], jobNumber: (id) => id.slice(1), jobName: () => '', gcName: () => '' })
    expect(lienBoardChipCard(lienBoardChipFor(weekend, 'j1', 'notice')!, weekend, facts({ todayYmd: '2026-11-14' })).risk).toBe('Will not make its day as it stands. Still to do, with no working days left:')
  })

  it('a card that names stages is taken to stand taller, so it is placed over a chip it would not fit under', () => {
    expect(lienBoardCardHeight({ left: [] })).toBe(LIEN_BOARD_CARD_HEIGHT_PX)
    expect(lienBoardCardHeight({ left: ['a', 'b', 'c'] })).toBe(LIEN_BOARD_CARD_HEIGHT_PX + 3 * LIEN_BOARD_CARD_STAGE_PX)
    const chip = { left: 40, top: 520, width: 60, height: 22 }
    const roomBelow = LIEN_BOARD_CARD_HEIGHT_PX + 20
    expect(lienBoardCardPlace({ chip, hostWidth: 1392, roomBelow }).above).toBe(false)
    expect(lienBoardCardPlace({ chip, hostWidth: 1392, roomBelow, cardHeight: lienBoardCardHeight({ left: ['a', 'b', 'c'] }) }).above).toBe(true)
  })

  it('the sentences the card writes keep to plain words', () => {
    const b = board()
    const card = lienBoardChipCard(lienBoardChipFor(b, 'j858', 'notice')!, b, facts())
    for (const s of [card.risk!, card.other!, card.door, ...card.left]) expect(plainWordsFailures(s)).toEqual([])
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
    // The card's own top: its height and the gap over the chip.
    expect(lienBoardCardPlace({ chip: { ...chip, top: 520 }, hostWidth: 1392, roomBelow: 80 })).toEqual({ left: 40, top: 520 - 6 - LIEN_BOARD_CARD_HEIGHT_PX, above: true })
  })

  it('is placed by its real height once it is drawn: a tall card on a short screen goes over its chip, not off the bottom (v2.7425)', () => {
    // A chip in To send for Master approval at 1280 x 720, as measured on 2026-11-15: 270 px of screen under it, 430 over, and a card 338 px tall.
    const toSend = { left: 54, top: 290, width: 44, height: 22 }
    // By the old guess of 230 px it went under, and ran 72 px off the screen.
    expect(lienBoardCardPlace({ chip: toSend, hostWidth: 1232, roomBelow: 270, roomAbove: 430 })).toEqual({ left: 54, top: 318, above: false })
    const placed = lienBoardCardPlace({ chip: toSend, hostWidth: 1232, roomBelow: 270, roomAbove: 430, cardHeight: 338 })
    expect(placed).toEqual({ left: 54, top: 290 - 6 - 338, above: true })
    // A card that fits under stays under, as it always was.
    expect(lienBoardCardPlace({ chip: toSend, hostWidth: 1232, roomBelow: 270, roomAbove: 430, cardHeight: 244 })).toEqual({ left: 54, top: 318, above: false })
  })

  it('with room on neither side it stands beside its chip, inside what can show it, and the chip stays in view', () => {
    // A late notice in To send for Master approval at 1280 x 720, as measured on 2026-11-15: the list's frame leaves 272 px under the
    // chip and 331 over, and the card with its three named stages stands 395 px tall.
    const toSend = { left: 54, top: 290, width: 44, height: 22 }
    const placed = lienBoardCardPlace({ chip: toSend, hostWidth: 1232, roomBelow: 272, roomAbove: 331, cardHeight: 395 })
    // To the right of the chip, a gap away.
    expect(placed).toMatchObject({ left: 54 + 44 + 6, above: false, beside: true })
    // From top to bottom inside what shows it, 8 px from each edge at the least.
    const viewTop = toSend.top - 331
    const viewBottom = toSend.top + toSend.height + 272
    expect(placed.top).toBeGreaterThanOrEqual(viewTop + LIEN_BOARD_CARD_EDGE_PX)
    expect(placed.top + 395).toBeLessThanOrEqual(viewBottom - LIEN_BOARD_CARD_EDGE_PX)
    // A chip at the Board's right edge has no room on its right: the card stands on its left.
    const last = { left: 1180, top: 290, width: 44, height: 22 }
    expect(lienBoardCardPlace({ chip: last, hostWidth: 1232, roomBelow: 272, roomAbove: 331, cardHeight: 395 })).toMatchObject({ left: 1180 - 6 - 320, beside: true })
    // A view shorter than the card keeps the card's head in view, where it starts.
    expect(lienBoardCardPlace({ chip: toSend, hostWidth: 1232, roomBelow: 100, roomAbove: 100, cardHeight: 395 }).top).toBe(toSend.top - 100 + LIEN_BOARD_CARD_EDGE_PX)
  })
})
