import { describe, expect, it } from 'vitest'
import { APP_SETTINGS_KEY_MESSAGES_ASSIGN_RULE_V1 } from '../appSettingsKeys'
import { ASSIGN_RULE_KEY } from '../followUp/assignSeats'
import { whoGetsIt } from '../followUp/queue'
import { plainWordsFailures } from '../plainWords'
import {
  ASSIGN_RULE_AFTER,
  ASSIGN_RULE_FIRST,
  NO_SEATS,
  SEAT_GONE,
  SEATS_SAVED_TOAST,
  assignRuleRows,
  assignSeatsText,
  canSeePhoneAndTexts,
  canSetAssignSeats,
  parseAssignSeats,
  sameSeats,
  seatOptions,
} from './assignRule'

const ROSA = '00000000-0000-4000-8000-0000000000a1'
const ROBERT = '00000000-0000-4000-8000-0000000000a2'
const NAMES: Record<string, string> = { [ROSA]: 'Rosa', [ROBERT]: 'Robert' }
const nameOf = (id: string) => NAMES[id] ?? null

describe('Who gets a new message (cut 2, PR D)', () => {
  it('reads the seats the migration writes, and anything else as empty seats', () => {
    expect(parseAssignSeats('{"customer": null, "trade": null, "arch": null}')).toEqual(NO_SEATS)
    expect(parseAssignSeats(`{"customer": "${ROSA}", "trade": "${ROBERT}", "arch": null}`)).toEqual({ customer: ROSA, trade: ROBERT, arch: null })
    expect(parseAssignSeats(`{"customer": " ${ROSA} ", "trade": "Robert", "arch": 7}`)).toEqual({ customer: ROSA, trade: null, arch: null })
    for (const bad of [null, undefined, '', '  ', 'not json', '[]', '"x"', 'null']) expect(parseAssignSeats(bad)).toEqual(NO_SEATS)
  })

  it('writes the three keys back as it reads them', () => {
    const seats = { customer: ROSA, trade: ROBERT, arch: null }
    expect(assignSeatsText(seats)).toBe(`{"customer":"${ROSA}","trade":"${ROBERT}","arch":null}`)
    expect(parseAssignSeats(assignSeatsText(seats))).toEqual(seats)
    expect(sameSeats(seats, { ...seats })).toBe(true)
    expect(sameSeats(seats, { ...seats, arch: ROSA })).toBe(false)
  })

  it('the owner and a dev set the seats; the office team sees them', () => {
    expect((['master_technician', 'dev'] as const).map(canSetAssignSeats)).toEqual([true, true])
    expect((['assistant', 'controller', 'estimator', 'superintendent', 'primary', null] as const).map(canSetAssignSeats)).toEqual([false, false, false, false, false, false])
    expect((['dev', 'master_technician', 'assistant', 'controller', 'estimator'] as const).every(canSeePhoneAndTexts)).toBe(true)
    expect((['superintendent', 'primary', 'subcontractor', null] as const).some(canSeePhoneAndTexts)).toBe(false)
  })

  it('a seat is someone on the office team with a name, by name', () => {
    const team = [
      { id: ROBERT, name: 'Robert', role: 'estimator' },
      { id: 's1', name: 'Sam', role: 'superintendent' },
      { id: ROSA, name: 'Rosa', role: 'assistant' },
      { id: 'n1', name: '  ', role: 'assistant' },
    ]
    expect(seatOptions(team).map((t) => t.name)).toEqual(['Robert', 'Rosa'])
  })

  it('says the rule with the seats’ names, an architect sharing the trade partners’ seat when it has none', () => {
    expect(assignRuleRows({ customer: ROSA, trade: ROBERT, arch: null }, nameOf)).toEqual([
      { key: 'customer', who: 'A customer, a lead, a sub, a supply house or a candidate', goesTo: 'Rosa' },
      { key: 'trade', who: 'A trade partner', goesTo: 'Robert' },
      { key: 'arch', who: 'An architect', goesTo: "Robert, the trade partners' seat" },
      { key: 'unknown', who: 'A number nobody knows', goesTo: 'Nobody. Whoever answers first takes it.' },
    ])
    expect(assignRuleRows({ customer: null, trade: null, arch: ROSA }, nameOf).map((r) => r.goesTo)).toEqual([
      'Nobody. Whoever answers first takes it.',
      'Nobody. Whoever answers first takes it.',
      'Rosa',
      'Nobody. Whoever answers first takes it.',
    ])
    expect(assignRuleRows({ customer: '00000000-0000-4000-8000-0000000000ff', trade: null, arch: null }, nameOf)[0]!.goesTo).toBe(SEAT_GONE)
  })

  it('says what whoGetsIt does with the same seats', () => {
    const seats = { customer: ROSA, trade: ROBERT, arch: null }
    const rows = assignRuleRows(seats, nameOf)
    const got = (kind: 'customer' | 'lead' | 'sub' | 'supply_house' | 'candidate' | 'trade' | 'arch' | 'unknown') => whoGetsIt({ kind, answeredLastBy: null, hereToday: new Set(), seats })
    expect([got('customer'), got('trade'), got('arch'), got('unknown')].map((id) => (id ? NAMES[id] : null))).toEqual(['Rosa', 'Robert', 'Robert', null])
    // The first row names the four kinds the Customers seat takes with a customer (v2.5501).
    expect([got('lead'), got('sub'), got('supply_house'), got('candidate')].map((id) => (id ? NAMES[id] : null))).toEqual(['Rosa', 'Rosa', 'Rosa', 'Rosa'])
    expect(rows.map((r) => r.goesTo.split(',')[0])).toEqual(['Rosa', 'Robert', 'Robert', 'Nobody. Whoever answers first takes it.'])
  })

  it('keeps its words plain', () => {
    const words = [ASSIGN_RULE_FIRST, ASSIGN_RULE_AFTER, SEATS_SAVED_TOAST, ...assignRuleRows(NO_SEATS, nameOf).map((r) => `${r.who} goes to ${r.goesTo}`)]
    for (const w of words) expect(plainWordsFailures(w)).toEqual([])
  })
})

describe('the seats’ key, as the server reads it (R5’s push)', () => {
  it('is the client’s key, so the two copies cannot drift', () => {
    expect(ASSIGN_RULE_KEY).toBe(APP_SETTINGS_KEY_MESSAGES_ASSIGN_RULE_V1)
  })
})
