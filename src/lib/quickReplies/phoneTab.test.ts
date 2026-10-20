/**
 * The Phone tab over the residential prototype's lines for customers (v0.8, branch spike/gc-mode): On our way, Running
 * late, What we found, the water is off, Done for today and the photo ask, in the prototype's places 1 to 6, with
 * Rosa's own line and a trade partner's line that never reach the phone.
 */
import { describe, expect, it } from 'vitest'
import { plainWordsFailures } from '../plainWords'
import { PHONE_ONLY_CUSTOMERS, type QuickReply } from './kernel'
import { OFF_THE_PHONE, PHONE_TAB_WORDS, movePhone, nextPhonePlace, phoneTabLines, phoneTick, reachesPhone } from './phoneTab'

const line = (id: string, set: Partial<QuickReply>): QuickReply => ({
  id,
  text: `${id}'s words`,
  for: 'customer',
  stepId: null,
  scope: 'team',
  addedBy: 'rosa',
  addedAt: 0,
  removed: false,
  uses: {},
  lastUsed: null,
  textEs: null,
  phoneOrder: null,
  phoneName: null,
  ...set,
})

const LINES: QuickReply[] = [
  line('r3', { stepId: 'onway', phoneOrder: 2, text: '{first}, we are running behind this morning.' }),
  line('r2', { stepId: 'onway', phoneOrder: 1, text: '{first}, this is {me} with Click Plumbing. We are on our way.' }),
  line('r4', { stepId: 'found', phoneOrder: 3, text: '{first}, here is what we found: {found}.' }),
  line('r6', { stepId: 'working', phoneOrder: 4 }),
  line('r7', { stepId: 'working', phoneOrder: 5 }),
  line('r10', { phoneOrder: 6, text: '{first}, could you send a photo of {thing}?' }),
  line('r1', { stepId: 'booked' }),
  line('r13', { scope: 'mine', phoneOrder: 7 }),
  line('q1', { for: 'trade', stepId: 'ask', phoneOrder: 8 }),
  line('r8', { stepId: 'billed', phoneOrder: 9, removed: true }),
]
const ids = (rows: readonly { id: string }[]) => rows.map((q) => q.id)

describe('the Phone tab’s list', () => {
  it('holds the team’s live lines for customers with a place, by their place', () => {
    expect(ids(phoneTabLines(LINES))).toEqual(['r2', 'r3', 'r4', 'r6', 'r7', 'r10'])
  })

  it('breaks a tie by id, as the phone does, and is not capped at six', () => {
    const more = [...LINES, line('r11', { phoneOrder: 7 }), line('r12', { phoneOrder: 2 })]
    expect(ids(phoneTabLines(more))).toEqual(['r2', 'r12', 'r3', 'r4', 'r6', 'r7', 'r10', 'r11'])
    expect([5, 6].map(reachesPhone)).toEqual([true, false])
  })
})

describe('moving a line on the phone', () => {
  it('swaps two neighbours in two saves', () => {
    expect(movePhone(LINES, 'r4', -1)).toEqual([
      { id: 'r4', phoneOrder: 2 },
      { id: 'r3', phoneOrder: 3 },
    ])
    expect(movePhone(LINES, 'r2', 1)).toEqual([
      { id: 'r3', phoneOrder: 1 },
      { id: 'r2', phoneOrder: 2 },
    ])
  })

  it('does nothing past either end, or for a line not on the phone', () => {
    expect(movePhone(LINES, 'r2', -1)).toEqual([])
    expect(movePhone(LINES, 'r10', 1)).toEqual([])
    expect(movePhone(LINES, 'r1', 1)).toEqual([])
    expect(movePhone(LINES, 'r13', -1)).toEqual([])
  })

  it('numbers a list with gaps 1 to n again in passing', () => {
    const gaps = [line('a', { phoneOrder: 2 }), line('b', { phoneOrder: 5 }), line('c', { phoneOrder: 9 })]
    expect(movePhone(gaps, 'c', -1)).toEqual([
      { id: 'a', phoneOrder: 1 },
      { id: 'c', phoneOrder: 2 },
      { id: 'b', phoneOrder: 3 },
    ])
  })
})

describe('putting a line on the phone, and taking it off', () => {
  it('puts a ticked line after the last, and the first at 1', () => {
    expect(nextPhonePlace(LINES)).toBe(7)
    expect(nextPhonePlace([line('r1', {})])).toBe(1)
    expect(OFF_THE_PHONE).toBe(0)
  })

  it('lets only the team’s lines for customers on the phone', () => {
    expect(phoneTick({ for: 'customer', scope: 'team' })).toEqual({ can: true, why: null })
    expect(phoneTick({ for: 'customer', scope: 'mine' })).toEqual({ can: false, why: PHONE_ONLY_CUSTOMERS })
    expect(phoneTick({ for: 'trade', scope: 'team' })).toEqual({ can: false, why: PHONE_ONLY_CUSTOMERS })
  })
})

describe('plain words', () => {
  it('holds every sentence the tab and the phone fields say', () => {
    const sentences = [...Object.values(PHONE_TAB_WORDS), PHONE_ONLY_CUSTOMERS]
    expect(sentences.flatMap((s) => plainWordsFailures(s))).toEqual([])
  })
})
