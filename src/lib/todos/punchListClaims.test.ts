import { describe, expect, it } from 'vitest'
import { plainSentence, sentenceParts } from '../valuesInPlace'
import {
  QUIET_AFTER_MS,
  agoWords,
  claimFreshAt,
  claimLines,
  isQuiet,
  readClaims,
  takenByOthers,
  type CardClaims,
  type ClaimCard,
} from './punchListClaims'
import type { PunchTick } from './punchListTicks'

// Every name here is made up.
const ANA = 'user-ana'
const BEN = 'user-ben'
const CAL = 'user-cal'
const HOUR = 3_600_000
const NOW = Date.parse('2026-11-22T18:00:00.000Z')
const ago = (hours: number) => new Date(NOW - hours * HOUR).toISOString()

const tick = (over: Partial<PunchTick> = {}): PunchTick => ({
  userId: ANA,
  cardNumber: 412,
  section: 'ready',
  boardVersion: 'v2.8226',
  claimerName: 'ZZ Ana',
  tickedAt: ago(1),
  ...over,
})
const card = (over: Partial<ClaimCard> = {}): ClaimCard => ({ number: 412, group: 'ready', slug: 'a-card', ...over })

const read = (ticks: PunchTick[], me: string | null, over: Partial<Parameters<typeof readClaims>[0]> = {}) =>
  readClaims({ ticks, cards: [card()], boardVersion: 'v2.8226', me, touched: {}, nowMs: NOW, ...over })
const on = (ticks: PunchTick[], me: string | null, over: Partial<Parameters<typeof readClaims>[0]> = {}): CardClaims | undefined => read(ticks, me, over).byCard.get(412)
const said = (ticks: PunchTick[], me: string | null, over: Partial<Parameters<typeof readClaims>[0]> = {}) =>
  claimLines(on(ticks, me, over), NOW).map((l) => plainSentence(l.text))

describe('fresh and quiet', () => {
  it('a claim is fresh for 12 hours after the tick and quiet from the twelfth', () => {
    expect(isQuiet(NOW - 11 * HOUR - 59 * 60_000, NOW)).toBe(false)
    expect(isQuiet(NOW - QUIET_AFTER_MS, NOW)).toBe(true)
    expect(isQuiet(NOW - 30 * HOUR, NOW)).toBe(true)
    // Two clocks: a tick stamped a moment in the future is fresh, not quiet.
    expect(isQuiet(NOW + 60_000, NOW)).toBe(false)
  })

  it('counts from the newest of what the person said and the card’s last change', () => {
    const tickedAt = ago(20)
    const touchedSec = Math.floor((NOW - 2 * HOUR) / 1000)
    expect(claimFreshAt(tickedAt, undefined)).toBe(NOW - 20 * HOUR)
    expect(claimFreshAt(tickedAt, touchedSec)).toBe(touchedSec * 1000)
    // A card last changed before the tick does not pull the claim back.
    expect(claimFreshAt(ago(1), Math.floor((NOW - 50 * HOUR) / 1000))).toBe(NOW - HOUR)
    // A time that cannot be read counts as never.
    expect(claimFreshAt('', undefined)).toBe(0)
  })

  it('a Still on it press is a newer time on the row, and the claim is fresh again', () => {
    expect(on([tick({ tickedAt: ago(13) })], BEN)?.wentQuiet).toHaveLength(1)
    expect(on([tick({ tickedAt: ago(0) })], BEN)?.held).toHaveLength(1)
  })

  it('a change of the card file keeps an old claim fresh, by the card’s slug', () => {
    const old = [tick({ tickedAt: ago(40) })]
    expect(on(old, BEN)?.wentQuiet).toHaveLength(1)
    const touched = { 'a-card': Math.floor((NOW - 3 * HOUR) / 1000), 'another-card': Math.floor(NOW / 1000) }
    expect(on(old, BEN, { touched })?.held).toHaveLength(1)
    expect(on(old, BEN, { touched: { 'another-card': Math.floor(NOW / 1000) } })?.wentQuiet).toHaveLength(1)
    // A build that read no git has no last changes at all.
    expect(on(old, BEN, { touched: undefined })?.wentQuiet).toHaveLength(1)
  })
})

describe('who sees what', () => {
  it('another person’s fresh claim is on the card for everyone else, by name', () => {
    const claims = on([tick()], BEN)
    expect(claims?.mine).toBeNull()
    expect(claims?.held.map((c) => c.name)).toEqual(['ZZ Ana'])
    expect(takenByOthers(claims)).toBe(true)
    expect(read([tick()], BEN).ticked.size).toBe(0)
    expect(said([tick()], BEN)).toEqual(['ZZ Ana is working on this. Last update 1 h ago.'])
  })

  it('the claimer sees their own tick, and the card is not taken from them', () => {
    const claims = on([tick()], ANA)
    expect(claims?.mine?.quiet).toBe(false)
    expect(takenByOthers(claims)).toBe(false)
    expect(read([tick()], ANA).ticked.has(412)).toBe(true)
    expect(said([tick()], ANA)).toEqual(['You are working on this. Last update 1 h ago.'])
  })

  it('after 12 quiet hours the card is free to everyone else, with who had it and when it went quiet', () => {
    const rows = [tick({ tickedAt: ago(15) })]
    expect(takenByOthers(on(rows, BEN))).toBe(false)
    expect(said(rows, BEN)).toEqual(['Free to pick up. ZZ Ana had it and went quiet 3 h ago.'])
  })

  it('the claimer’s own tick stays after 12 quiet hours, marked as gone quiet with Still on it', () => {
    const rows = [tick({ tickedAt: ago(15) })]
    const mine = read(rows, ANA)
    expect(mine.ticked.has(412)).toBe(true)
    expect(mine.wiped).toEqual([])
    const lines = claimLines(mine.byCard.get(412), NOW)
    expect(lines).toHaveLength(1)
    expect(lines[0]!.stillOn).toBe(true)
    expect(lines[0]!.tone).toBe('quiet')
    expect(plainSentence(lines[0]!.text)).toBe('Your claim went quiet 3 h ago. Others see this card as free to pick up.')
  })

  it('the one word that flips it: a quiet tick is wiped for its claimer too', () => {
    const rows = [tick({ tickedAt: ago(15) }), tick({ cardNumber: 412, userId: BEN, claimerName: 'ZZ Ben', tickedAt: ago(1) })]
    const mine = read(rows, ANA, { ownTickAfterQuiet: 'wiped' })
    expect(mine.ticked.size).toBe(0)
    expect(mine.wiped).toEqual([412])
    expect(mine.byCard.get(412)?.mine).toBeNull()
    // A fresh tick is never wiped, and nobody else's row is ever in the list.
    expect(read([tick()], ANA, { ownTickAfterQuiet: 'wiped' }).wiped).toEqual([])
    expect(read(rows, CAL, { ownTickAfterQuiet: 'wiped' }).wiped).toEqual([])
  })

  it('a second person may take over a card whose claim has gone quiet', () => {
    const rows = [tick({ tickedAt: ago(15) }), tick({ userId: BEN, claimerName: 'ZZ Ben', tickedAt: ago(0) })]
    // A third person sees the new claimer, and not the one who went quiet.
    expect(said(rows, CAL)).toEqual(['ZZ Ben is working on this. Last update just now.'])
    // The first person still sees their own quiet tick, under the new claimer's line, and the card is not called free.
    expect(said(rows, ANA)).toEqual(['ZZ Ben is working on this. Last update just now.', 'Your claim went quiet 3 h ago.'])
    expect(read(rows, ANA).ticked.has(412)).toBe(true)
    // The new claimer sees their own.
    expect(said(rows, BEN)).toEqual(['You are working on this. Last update just now.'])
  })

  it('two fresh claims on one card are both named', () => {
    const rows = [tick({ tickedAt: ago(5) }), tick({ userId: BEN, claimerName: 'ZZ Ben', tickedAt: ago(2) })]
    expect(said(rows, CAL)).toEqual(['ZZ Ben and ZZ Ana are working on this. Last update 2 h ago.'])
    expect(said(rows, ANA)).toEqual(['You and ZZ Ben are working on this. Last update 2 h ago.'])
    const three = [...rows, tick({ userId: CAL, claimerName: 'ZZ Cal', tickedAt: ago(1) })]
    expect(said(three, 'user-dee')).toEqual(['ZZ Cal, ZZ Ben and ZZ Ana are working on this. Last update 1 h ago.'])
  })

  it('a card nobody ticked says nothing', () => {
    expect(on([], ANA)).toBeUndefined()
    expect(claimLines(undefined, NOW)).toEqual([])
  })

  it('a row with no name reads as Someone', () => {
    expect(said([tick({ claimerName: '  ' })], BEN)).toEqual(['Someone is working on this. Last update 1 h ago.'])
  })
})

describe('a move still ends a claim', () => {
  it('a card that moved to another section shows nobody’s claim, fresh or not', () => {
    const rows = [tick({ section: 'ready' }), tick({ userId: BEN, claimerName: 'ZZ Ben', section: 'ready' })]
    const moved = { cards: [card({ group: 'close' })], boardVersion: 'v2.8300' }
    expect(on(rows, CAL, moved)).toBeUndefined()
    expect(read(rows, ANA, moved).ticked.size).toBe(0)
  })

  it('a card gone from the list has no claim', () => {
    expect(read([tick({ cardNumber: 9 })], BEN).byCard.size).toBe(0)
  })

  it('a made-up card whose section changes between two reads loses its claim on the second', () => {
    const rows = [tick()]
    expect(said(rows, BEN, { cards: [card({ group: 'ready' })] })).toHaveLength(1)
    expect(said(rows, BEN, { cards: [card({ group: 'close' })] })).toEqual([])
  })
})

describe('the words', () => {
  it('says how long ago in the fewest words', () => {
    expect(agoWords(NOW - 20_000, NOW)).toBe('just now')
    expect(agoWords(NOW - 25 * 60_000, NOW)).toBe('25 min ago')
    expect(agoWords(NOW - 3 * HOUR - 59 * 60_000, NOW)).toBe('3 h ago')
    expect(agoWords(NOW - 47 * HOUR, NOW)).toBe('47 h ago')
    expect(agoWords(NOW - 50 * HOUR, NOW)).toBe('2 days ago')
    expect(agoWords(NOW + 5000, NOW)).toBe('just now')
  })

  it('marks the name and the time as values, so the screen draws them apart from the words', () => {
    const [line] = claimLines(on([tick()], BEN), NOW)
    expect(sentenceParts(line!.text)).toEqual([
      { kind: 'who', text: 'ZZ Ana' },
      ' is working on this. Last update ',
      { kind: 'when', text: '1 h ago' },
      '.',
    ])
    expect(line!.tone).toBe('taken')
    expect(claimLines(on([tick()], ANA), NOW)[0]!.tone).toBe('mine')
    expect(claimLines(on([tick({ tickedAt: ago(15) })], BEN), NOW)[0]!.tone).toBe('free')
  })
})
