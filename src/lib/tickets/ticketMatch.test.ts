import { describe, expect, it } from 'vitest'
import { TICKET_MINUTE_AFTER_MS, TICKET_MINUTE_BEFORE_MS, matchTicket, matchTickets, type MatchCharge, type MatchTicket } from './ticketMatch'

const MIN = 60 * 1000
const HOUR = 60 * MIN
const DAY = 24 * HOUR
/** 2026-11-04 10:00 at the counter. */
const T0 = Date.parse('2026-11-04T16:00:00Z')

function ticket(over: Partial<MatchTicket> = {}): MatchTicket {
  return { id: 't1', takenBy: 'jordan', takenAtMs: T0, takenAtFrom: 'press', total: null, declined: [], ...over }
}

function charge(id: string, over: Partial<MatchCharge> = {}): MatchCharge {
  return { id, cardHolderId: 'jordan', swipeAtMs: T0 - 3 * MIN, amount: -228.58, status: 'pending', ...over }
}

describe('a ticket taken at the counter', () => {
  it('takes the only swipe on the card in the half hour before it, with no press', () => {
    expect(matchTicket(ticket(), [charge('c1')])).toEqual({ kind: 'made', by: 'minute', chargeId: 'c1' })
  })

  it('matches while the charge is still pending and after it settles', () => {
    for (const status of ['pending', 'sent']) expect(matchTicket(ticket(), [charge('c1', { status })]).kind).toBe('made')
  })

  it('holds the window at half an hour before and a few minutes after', () => {
    expect(matchTicket(ticket(), [charge('c1', { swipeAtMs: T0 - TICKET_MINUTE_BEFORE_MS })]).kind).toBe('made')
    expect(matchTicket(ticket(), [charge('c1', { swipeAtMs: T0 + TICKET_MINUTE_AFTER_MS })]).kind).toBe('made')
    expect(matchTicket(ticket(), [charge('c1', { swipeAtMs: T0 + TICKET_MINUTE_AFTER_MS + 1 })])).toEqual({ kind: 'none', why: 'no_charge', chargeIds: [] })
  })

  it('never takes a failed charge, and takes the one that went through', () => {
    const failed = charge('c1', { status: 'failed', swipeAtMs: T0 - 5 * MIN })
    const again = charge('c2', { status: 'pending', swipeAtMs: T0 - 4 * MIN })
    expect(matchTicket(ticket(), [failed])).toEqual({ kind: 'none', why: 'no_charge', chargeIds: [] })
    expect(matchTicket(ticket(), [failed, again])).toEqual({ kind: 'made', by: 'minute', chargeId: 'c2' })
  })

  it('never guesses between two swipes in the half hour', () => {
    const two = [charge('c1', { amount: -125.56 }), charge('c2', { amount: -2, swipeAtMs: T0 - 3 * MIN + 1000 })]
    expect(matchTicket(ticket(), two)).toEqual({ kind: 'none', why: 'several_fit', chargeIds: ['c1', 'c2'] })
  })

  it('lets a typed total tell two swipes apart', () => {
    const two = [charge('c1', { amount: -125.56 }), charge('c2', { amount: -2, swipeAtMs: T0 - 3 * MIN + 1000 })]
    expect(matchTicket(ticket({ total: 125.56 }), two)).toEqual({ kind: 'made', by: 'total', chargeId: 'c1' })
  })

  it('asks instead of matching when the typed total is not the one swipe', () => {
    expect(matchTicket(ticket({ total: 99 }), [charge('c1')])).toEqual({ kind: 'ask', who: 'taker', why: 'late', chargeId: 'c1' })
  })

  it('matches money that came back by its size', () => {
    expect(matchTicket(ticket(), [charge('c1', { amount: 41.17 })])).toEqual({ kind: 'made', by: 'minute', chargeId: 'c1' })
    expect(matchTicket(ticket({ total: 41.17, takenAtMs: T0 + 6 * HOUR }), [charge('c1', { amount: 41.17 })])).toEqual({ kind: 'made', by: 'total', chargeId: 'c1' })
  })
})

describe('a ticket taken later', () => {
  it('matches by a typed total within a day, with no press', () => {
    const t = ticket({ takenAtMs: T0 + 5 * HOUR, total: 228.58 })
    expect(matchTicket(t, [charge('c1'), charge('c2', { amount: -19.99, swipeAtMs: T0 + HOUR })])).toEqual({ kind: 'made', by: 'total', chargeId: 'c1' })
  })

  it('does not match a total typed wrong, and asks about the one charge of the day', () => {
    const t = ticket({ takenAtMs: T0 + 5 * HOUR, total: 228.85 })
    expect(matchTicket(t, [charge('c1')])).toEqual({ kind: 'ask', who: 'taker', why: 'late', chargeId: 'c1' })
  })

  it('asks about the only charge in the twelve hours before, with no total', () => {
    const t = ticket({ takenAtMs: T0 + 5 * HOUR })
    expect(matchTicket(t, [charge('c1')])).toEqual({ kind: 'ask', who: 'taker', why: 'late', chargeId: 'c1' })
    expect(matchTicket(t, [charge('c1', { swipeAtMs: T0 - 8 * HOUR })])).toEqual({ kind: 'none', why: 'no_charge', chargeIds: [] })
  })

  it('lists the charges when several fit, for the office to pick', () => {
    const t = ticket({ takenAtMs: T0 + 5 * HOUR })
    expect(matchTicket(t, [charge('c1'), charge('c2', { swipeAtMs: T0 + HOUR })])).toEqual({ kind: 'none', why: 'several_fit', chargeIds: ['c1', 'c2'] })
  })

  it('asks about the same total from days before', () => {
    const t = ticket({ takenAtMs: T0 + 3 * DAY, total: 228.58 })
    expect(matchTicket(t, [charge('c1')])).toEqual({ kind: 'ask', who: 'taker', why: 'total', chargeId: 'c1' })
  })
})

describe('a PDF or a paper handed in', () => {
  it('is never matched by the time it was added', () => {
    const t = ticket({ takenAtFrom: 'none' })
    expect(matchTicket(t, [charge('c1')])).toEqual({ kind: 'none', why: 'no_charge', chargeIds: [] })
  })

  it('asks when its total is one charge in the two weeks before', () => {
    const t = ticket({ takenAtFrom: 'none', takenAtMs: T0 + 6 * DAY, total: 228.58 })
    expect(matchTicket(t, [charge('c1')])).toEqual({ kind: 'ask', who: 'taker', why: 'total', chargeId: 'c1' })
    expect(matchTicket({ ...t, takenAtMs: T0 + 20 * DAY }, [charge('c1')])).toEqual({ kind: 'none', why: 'no_charge', chargeIds: [] })
  })
})

describe('another person’s card', () => {
  it('is only ever a question, and the office’s', () => {
    const lead = charge('c1', { cardHolderId: 'sam' })
    expect(matchTicket(ticket(), [lead])).toEqual({ kind: 'ask', who: 'office', why: 'other_card', chargeId: 'c1' })
  })

  it('asks about a card tied to no one the same way', () => {
    expect(matchTicket(ticket(), [charge('c1', { cardHolderId: null })])).toEqual({ kind: 'ask', who: 'office', why: 'other_card', chargeId: 'c1' })
  })

  it('narrows two cards at one counter by the total', () => {
    const a = charge('c1', { cardHolderId: 'sam', amount: -228.58 })
    const b = charge('c2', { cardHolderId: 'lee', amount: -40 })
    expect(matchTicket(ticket(), [a, b])).toEqual({ kind: 'none', why: 'several_fit', chargeIds: ['c1', 'c2'] })
    expect(matchTicket(ticket({ total: 228.58 }), [a, b])).toEqual({ kind: 'ask', who: 'office', why: 'other_card', chargeId: 'c1' })
  })

  it('finds the lead’s charge by the total within a day', () => {
    const t = ticket({ takenAtMs: T0 + 4 * HOUR, total: 228.58 })
    expect(matchTicket(t, [charge('c1', { cardHolderId: 'sam' })])).toEqual({ kind: 'ask', who: 'office', why: 'other_card', chargeId: 'c1' })
  })

  it('prefers the taker’s own card', () => {
    const own = charge('c1')
    const lead = charge('c2', { cardHolderId: 'sam' })
    expect(matchTicket(ticket(), [own, lead])).toEqual({ kind: 'made', by: 'minute', chargeId: 'c1' })
  })
})

describe('charges that are never candidates', () => {
  it('skips a charge another live ticket holds', () => {
    expect(matchTicket(ticket(), [charge('c1', { ticketId: 'other' })])).toEqual({ kind: 'none', why: 'no_charge', chargeIds: [] })
  })

  it('never offers a charge the ticket was said not to be', () => {
    expect(matchTicket(ticket({ declined: ['c1'] }), [charge('c1')])).toEqual({ kind: 'none', why: 'no_charge', chargeIds: [] })
    expect(matchTicket(ticket({ declined: ['c1'] }), [charge('c1'), charge('c2', { swipeAtMs: T0 - MIN })])).toEqual({ kind: 'made', by: 'minute', chargeId: 'c2' })
  })

  it('skips a cancelled charge and a charge of nothing', () => {
    expect(matchTicket(ticket(), [charge('c1', { status: 'cancelled' }), charge('c2', { amount: 0 })]).kind).toBe('none')
  })

  it('asks the office when nobody is named as the taker', () => {
    expect(matchTicket(ticket({ takenBy: null }), [charge('c1')])).toEqual({ kind: 'ask', who: 'office', why: 'other_card', chargeId: 'c1' })
  })
})

describe('many tickets at once', () => {
  it('gives a charge to one ticket, the earlier one', () => {
    const a = ticket({ id: 'a', takenAtMs: T0 })
    const b = ticket({ id: 'b', takenAtMs: T0 + MIN })
    const out = matchTickets([b, a], [charge('c1')])
    expect(out.get('a')).toEqual({ kind: 'made', by: 'minute', chargeId: 'c1' })
    expect(out.get('b')).toEqual({ kind: 'none', why: 'no_charge', chargeIds: [] })
  })

  it('lets a ticket that fits two swipes take the one the other ticket left', () => {
    const first = charge('c1', { swipeAtMs: T0 })
    const second = charge('c2', { swipeAtMs: T0 + 20 * MIN })
    const a = ticket({ id: 'a', takenAtMs: T0 + 2 * MIN })
    const b = ticket({ id: 'b', takenAtMs: T0 + 22 * MIN })
    const out = matchTickets([b, a], [first, second])
    expect(out.get('a')).toEqual({ kind: 'made', by: 'minute', chargeId: 'c1' })
    expect(out.get('b')).toEqual({ kind: 'made', by: 'minute', chargeId: 'c2' })
  })

  it('never asks about a charge a match took', () => {
    const a = ticket({ id: 'a', takenAtMs: T0 })
    const late = ticket({ id: 'late', takenAtMs: T0 + 5 * HOUR })
    const out = matchTickets([late, a], [charge('c1')])
    expect(out.get('a')?.kind).toBe('made')
    expect(out.get('late')).toEqual({ kind: 'none', why: 'no_charge', chargeIds: [] })
  })

  it('lets two tickets ask about one charge', () => {
    const a = ticket({ id: 'a', takenAtMs: T0 + 5 * HOUR })
    const b = ticket({ id: 'b', takenAtMs: T0 + 6 * HOUR })
    const out = matchTickets([a, b], [charge('c1')])
    expect(out.get('a')).toEqual({ kind: 'ask', who: 'taker', why: 'late', chargeId: 'c1' })
    expect(out.get('b')).toEqual({ kind: 'ask', who: 'taker', why: 'late', chargeId: 'c1' })
  })

  it('answers every ticket', () => {
    const out = matchTickets([ticket({ id: 'a' }), ticket({ id: 'b', takenBy: 'sam' })], [])
    expect([...out.keys()].sort()).toEqual(['a', 'b'])
  })
})
