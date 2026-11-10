import { describe, expect, it } from 'vitest'
import type { ResearchPermitRow } from './permitResearch'
import type { SkimContext } from './permitSkim'
import { firstPassReason, isSecondLookCode, passedByWords, secondLookAnsweredWords, secondLookCaughtUpWords, secondLookCount, secondLookDeck, secondLookVerdict, waitsOnSecondLook } from './permitSecondLook'

// Every name, street and number here is made up.
function row(over: Partial<ResearchPermitRow> = {}): ResearchPermitRow {
  return {
    id: 'p1',
    city: 'San Antonio',
    source: 'sa-applied',
    permit_number: 'COM-PRJ-APP26-00000001',
    permit_type: 'Commercial Project Application',
    stage: 'applied',
    residential: false,
    work_type: 'Commercial project',
    project_name: null,
    address: '100 SAMPLE ST',
    zip: '78245',
    lat: 29.5,
    lng: -98.6,
    submitted_on: '2026-11-06',
    issued_on: null,
    filed_on: '2026-11-06',
    declared_value: null,
    area_sf: null,
    contact: 'Tall Pine Development',
    plumber: null,
    plumber_permit_on: null,
    verdict: null,
    verdict_reason: null,
    verdict_look_again_on: null,
    verdict_prospect_id: null,
    verdict_by: null,
    verdict_by_name: null,
    verdict_at: null,
    ...over,
  }
}
/** A permit Sam passed on the skim. */
function passed(over: Partial<ResearchPermitRow> = {}): ResearchPermitRow {
  return row({ verdict: 'not_for_us', verdict_reason: 'Passed on the skim.', verdict_reason_code: null, verdict_by: 'sam', verdict_by_name: 'Sam', verdict_at: '2026-11-09T15:00:00Z', ...over })
}
const ctx: SkimContext = { todayYmd: '2026-11-10', office: { lat: 29.42, lng: -98.49 }, history: new Map() }

describe('which permits wait on a second look (punch list #302)', () => {
  it('a permit someone else passed waits on mine, and never on theirs', () => {
    expect(waitsOnSecondLook(passed(), 'eve')).toBe(true)
    expect(waitsOnSecondLook(passed(), 'sam')).toBe(false)
    // A pass typed on the ledger counts the same, and so does one nobody is named on.
    expect(waitsOnSecondLook(passed({ verdict_reason: 'A parking lot.', verdict_by: null, verdict_by_name: null }), 'eve')).toBe(true)
  })

  it('a second look is one look: a permit two people passed waits on nobody', () => {
    const twice = passed({ verdict_reason: 'Passed on a second look.', verdict_reason_code: 'sl_none', verdict_by: 'eve', verdict_by_name: 'Eve' })
    expect(waitsOnSecondLook(twice, 'sam')).toBe(false)
    expect(waitsOnSecondLook(twice, 'kim')).toBe(false)
    expect(isSecondLookCode('sl_too_far')).toBe(true)
    expect(isSecondLookCode('too_far')).toBe(false)
    expect(isSecondLookCode(null)).toBe(false)
  })

  it('leaves out what is not a pass: waiting, kept, pursued, dropped after a closer look, and a permit a plumber has', () => {
    expect(waitsOnSecondLook(row(), 'eve')).toBe(false)
    expect(waitsOnSecondLook(passed({ verdict: 'look' }), 'eve')).toBe(false)
    expect(waitsOnSecondLook(passed({ verdict: 'approach' }), 'eve')).toBe(false)
    expect(waitsOnSecondLook(passed({ verdict_reason_code: 'np_no_answer' }), 'eve')).toBe(false)
    expect(waitsOnSecondLook(passed({ plumber_permit_on: '2026-11-08' }), 'eve')).toBe(false)
    expect(waitsOnSecondLook(passed({ verdict: 'taken' }), 'eve')).toBe(false)
  })

  it("deals the deck in the skim's own order, above the floor, and counts it", () => {
    const rows = [
      passed({ id: 'plain', permit_number: 'B' }),
      passed({ id: 'big', permit_number: 'C', declared_value: 2_000_000, work_type: 'New commercial' }),
      passed({ id: 'small', permit_number: 'D', declared_value: 9_000 }),
      passed({ id: 'mine', permit_number: 'E', verdict_by: 'eve' }),
      row({ id: 'waiting', permit_number: 'F' }),
    ]
    expect(secondLookDeck(rows, ctx, 25_000, 'eve').map((c) => c.row.id)).toEqual(['big', 'plain'])
    expect(secondLookCount(rows, 25_000, 'eve')).toBe(2)
    expect(secondLookCount(rows, 0, 'eve')).toBe(3)
    expect(secondLookCount(rows, 25_000, 'sam')).toBe(1)
  })
})

describe('the words on a second-look card', () => {
  it('says who passed, when, and why when a reason was given', () => {
    expect(passedByWords(passed(), '2026-11-10')).toBe('Passed by Sam, yesterday')
    expect(passedByWords(passed({ verdict_reason: 'Passed on the skim: too far.', verdict_reason_code: 'too_far' }), '2026-11-10')).toBe('Passed by Sam, yesterday: too far')
    expect(passedByWords(passed({ verdict_reason: 'A parking lot, no building.', verdict_at: '2026-11-10T09:00:00Z' }), '2026-11-10')).toBe('Passed by Sam, today: A parking lot, no building.')
    expect(passedByWords(passed({ verdict_by_name: null, verdict_at: '2026-11-03T09:00:00Z' }), '2026-11-10')).toBe('Passed by someone, 7 days ago')
    expect(firstPassReason(passed())).toBeNull()
    expect(firstPassReason(passed({ verdict_reason: null }))).toBeNull()
  })
})

describe('the two answers of a second look', () => {
  it('Keep sends it to Kept with who passed first; Pass closes it for good with an sl_ code', () => {
    expect(secondLookVerdict('keep', null, 'Sam')).toEqual({ verdict: 'look', reason: 'Kept on a second look, after Sam passed.', reasonCode: null })
    expect(secondLookVerdict('keep', 'too_far', null)).toEqual({ verdict: 'look', reason: 'Kept on a second look, after someone passed.', reasonCode: null })
    expect(secondLookVerdict('pass', null, 'Sam')).toEqual({ verdict: 'not_for_us', reason: 'Passed on a second look.', reasonCode: 'sl_none' })
    expect(secondLookVerdict('pass', 'too_far', 'Sam')).toEqual({ verdict: 'not_for_us', reason: 'Passed on a second look: too far.', reasonCode: 'sl_too_far' })
  })

  it('what a second pass writes is what takes the permit off every second look', () => {
    const v = secondLookVerdict('pass', 'not_our_work', 'Sam')
    const after = passed({ verdict: v.verdict, verdict_reason: v.reason, verdict_reason_code: v.reasonCode, verdict_by: 'eve', verdict_by_name: 'Eve' })
    expect(waitsOnSecondLook(after, 'sam')).toBe(false)
    expect(waitsOnSecondLook(after, 'kim')).toBe(false)
  })

  it('reads the bar and the caught-up state', () => {
    expect(secondLookAnsweredWords('keep')).toBe('Kept for a closer look.')
    expect(secondLookAnsweredWords('pass')).toBe('Passed again. Why?')
    expect(secondLookCaughtUpWords(0, 0)).toBe('Every permit someone else passed has had a second look.')
    expect(secondLookCaughtUpWords(2, 5)).toBe('You answered 7 just now: 2 kept, 5 passed again.')
  })
})
