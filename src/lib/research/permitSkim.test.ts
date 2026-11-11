import { describe, expect, it } from 'vitest'
import type { ContactHistory, ResearchPermitRow } from './permitResearch'
import { answeredWords, caughtUpWords, daysBetween, digInWords, filedWords, milesFromOffice, milesWords, skimDeck, skimKeyAct, skimMoney, skimScore, skimTitle, skimVerdict, type SkimContext } from './permitSkim'

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

const office = { lat: 29.42, lng: -98.49 }
const won: ContactHistory = { key: 'ridgewaybuilders', bids: 5, won: 3, last_bid_on: '2026-06-01', on_deck: false }
function ctx(over: Partial<SkimContext> = {}): SkimContext {
  return { todayYmd: '2026-11-10', office, history: new Map([[won.key, won]]), ...over }
}

describe('the lines a skim card reads (punch list #302)', () => {
  it('estimates the miles from the office, and says nothing without a point or an office', () => {
    const miles = milesFromOffice(row(), office)
    expect(miles).toBeGreaterThan(8)
    expect(miles).toBeLessThan(14)
    expect(milesFromOffice(row({ lat: null }), office)).toBeNull()
    expect(milesFromOffice(row(), null)).toBeNull()
    expect(milesWords(14)).toBe('14 miles from the office')
    expect(milesWords(1)).toBe('1 mile from the office')
    expect(milesWords(null)).toBeNull()
  })

  it('says when it was filed in days', () => {
    expect(daysBetween('2026-11-06', '2026-11-10')).toBe(4)
    expect(daysBetween(null, '2026-11-10')).toBeNull()
    expect(filedWords(row(), '2026-11-10')).toBe('applied 4 days ago')
    expect(filedWords(row({ stage: 'issued', filed_on: '2026-11-10' }), '2026-11-10')).toBe('issued today')
    expect(filedWords(row({ filed_on: '2026-11-09' }), '2026-11-10')).toBe('applied yesterday')
    expect(filedWords(row({ filed_on: null }), '2026-11-10')).toBe('applied')
  })

  it("titles a card with the feed's project name when it says something, else the work and its size", () => {
    expect(skimTitle(row({ project_name: 'Sample Retail, shell', area_sf: 6200 }))).toBe('Sample Retail, shell, 6,200 sq ft')
    expect(skimTitle(row({ project_name: 'Building No: N/A; Unit No: N/A', work_type: 'New commercial', area_sf: 6200 }))).toBe('New commercial, 6,200 sq ft')
    expect(skimTitle(row({ project_name: '100 sample st' }))).toBe('Commercial project')
    expect(skimMoney(row({ declared_value: 1_400_000 }))).toBe('$1.4M declared')
    expect(skimMoney(row())).toBe('Value not declared')
  })
})

describe('best first', () => {
  it('lifts a builder we won with, a big value and a short drive, and says why', () => {
    const card = skimScore(row({ contact: 'Ridgeway Builders', declared_value: 1_400_000, work_type: 'New commercial' }), ctx())
    expect(card.score).toBeGreaterThanOrEqual(10)
    expect(card.why).toBe('No plumber yet · a builder we won with · $1.4M')
    expect(card.hint.tone).toBe('warm')
  })

  it('sinks site work a long way out, and a builder marked Avoid, and says why', () => {
    const far = skimScore(row({ work_type: 'Commercial site work', lat: 30.4, lng: -97.7 }), ctx())
    expect(far.score).toBeLessThan(0)
    expect(far.why).toMatch(/^Near the end: site work · \d+ miles away$/)
    const avoid = skimScore(row({ id: 'p9' }), ctx({ marks: new Map([['p9', 'avoid']]) }))
    expect(avoid.why).toBe('Near the end: a builder marked Avoid')
    expect(avoid.mark).toBe('avoid')
    const runner = skimScore(row({ id: 'p8' }), ctx({ filesForOthers: new Set(['p8']) }))
    expect(runner.why).toContain('the name only files for others')
  })

  it('in a city that is all a long drive, the miles stay on the card and off the score', () => {
    const far = row({ lat: 30.27, lng: -97.74 })
    const counted = skimScore(far, ctx())
    const left = skimScore(far, ctx({ scoreMiles: false }))
    expect(counted.why).toMatch(/miles away/)
    expect(left.why).toBe('No plumber yet')
    expect(left.miles).toBe(counted.miles)
    expect(left.score).toBeGreaterThan(counted.score)
  })

  it('a plain card with nothing known still reads no plumber yet', () => {
    expect(skimScore(row({ lat: null, lng: null }), ctx()).why).toBe('No plumber yet')
  })

  it('holds the deck to what waits, above the floor, best first, the newest first among equals', () => {
    const deck = skimDeck(
      [
        row({ id: 'kept', verdict: 'look' }),
        row({ id: 'taken', plumber_permit_on: '2026-11-05' }),
        row({ id: 'small', declared_value: 9_000 }),
        row({ id: 'plain-old', filed_on: '2026-11-01' }),
        row({ id: 'plain-new', filed_on: '2026-11-06' }),
        row({ id: 'best', contact: 'Ridgeway Builders', declared_value: 2_000_000 }),
        row({ id: 'worst', work_type: 'Commercial site work', lat: 30.4, lng: -97.7 }),
      ],
      ctx(),
      25_000,
    )
    expect(deck.map((c) => c.row.id)).toEqual(['best', 'plain-new', 'plain-old', 'worst'])
    // With no floor the small one is in the deck too.
    expect(skimDeck([row({ id: 'small', declared_value: 9_000 })], ctx(), 0).map((c) => c.row.id)).toEqual(['small'])
  })
})

describe('the two answers', () => {
  it("writes Keep as the ledger's look and Pass as its not_for_us, with words a reader can read", () => {
    expect(skimVerdict('keep', null)).toEqual({ verdict: 'look', reason: 'Marked to investigate on the skim.' })
    expect(skimVerdict('pass', null)).toEqual({ verdict: 'not_for_us', reason: 'Passed on the skim.' })
    expect(skimVerdict('pass', 'too_far')).toEqual({ verdict: 'not_for_us', reason: 'Passed on the skim: too far.' })
    expect(skimVerdict('keep', 'too_far').reason).toBe('Marked to investigate on the skim.')
    expect(answeredWords('keep')).toBe('Marked to investigate.')
    expect(answeredWords('pass')).toBe('Passed. Why?')
  })

  it('reads the keys a desk uses', () => {
    expect(skimKeyAct('ArrowRight')).toEqual({ act: 'keep' })
    expect(skimKeyAct('ArrowLeft')).toEqual({ act: 'pass' })
    expect(skimKeyAct('z')).toEqual({ act: 'undo' })
    expect(skimKeyAct('Enter')).toEqual({ act: 'open' })
    expect(skimKeyAct('2')).toEqual({ act: 'reason', code: 'too_far' })
    expect(skimKeyAct('5')).toBeNull()
    expect(skimKeyAct('a')).toBeNull()
  })

  it('says so when nothing is left', () => {
    expect(caughtUpWords(9, 32)).toBe('You answered 41 just now: 9 to investigate, 32 passed. The next pull is tomorrow at 5:30 AM.')
    expect(caughtUpWords(0, 0)).toBe('Every permit the feed brought has an answer. The next pull is tomorrow at 5:30 AM.')
    expect(digInWords(14)).toBe('Dig in · 14 to investigate')
    expect(digInWords(0)).toBeNull()
  })
})
