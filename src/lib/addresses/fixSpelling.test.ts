/**
 * Fix the spelling (punch list #439, piece 2): which jobs and bids a kept spelling rewrites, the caution when a
 * number would drop off, and the words on the button and after the press. Every address here is made up.
 */
import { describe, expect, it } from 'vitest'
import { addressesOnFile, type AddressRow } from './addressesOnFile'
import { fixButtonWords, numberCaution, fixOutcomeWords, openJobWords, spellingFixPlan, thingName } from './fixSpelling'

const ROWS: AddressRow[] = [
  { kind: 'job', id: 'j1', address: '115 E Sample St, Exampleville, TX', developmentId: null, label: 'J1078' },
  { kind: 'job', id: 'j2', address: '115 E Sample St, Exampleville, TX', developmentId: null, label: 'J1114' },
  { kind: 'job', id: 'j3', address: '115 E Sampel St, Exampleville, TX', developmentId: null, label: 'J1098' },
  { kind: 'bid', id: 'b1', address: '115 E Sampel St,  Exampleville, TX', developmentId: null, label: 'B214' },
  { kind: 'job', id: 'j4', address: '8217 Placeholder Creek Blvd, Exampleville, TX', developmentId: null, label: 'J1300' },
  { kind: 'job', id: 'j5', address: '8217 Placeholder Creek Blvd 201, Exampleville, TX', developmentId: null, label: null },
]

const list = addressesOnFile(ROWS, new Map())
const at = (start: string) => {
  const found = list.find((a) => a.address.startsWith(start))
  if (!found) throw new Error(`no address starts ${start}`)
  return found
}

describe('addressesOnFile things', () => {
  it('keeps every job and bid at an address with the address as it writes it', () => {
    expect(at('115 E Sample').things).toEqual([
      { kind: 'job', id: 'j1', label: 'J1078', address: '115 E Sample St, Exampleville, TX' },
      { kind: 'job', id: 'j2', label: 'J1114', address: '115 E Sample St, Exampleville, TX' },
    ])
    expect(at('115 E Sampel').things.map((t) => t.id)).toEqual(['j3', 'b1'])
  })
})

describe('spellingFixPlan', () => {
  const pair = { a: at('115 E Sample'), b: at('115 E Sampel') }

  it('rewrites the other side to the kept spelling, jobs and bids alike', () => {
    const plan = spellingFixPlan(pair, 'a')
    expect(plan.to).toBe('115 E Sample St, Exampleville, TX')
    expect(plan.rows).toEqual([
      { kind: 'job', id: 'j3', label: 'J1098', from: '115 E Sampel St, Exampleville, TX' },
      { kind: 'bid', id: 'b1', label: 'B214', from: '115 E Sampel St, Exampleville, TX' },
    ])
    expect(plan).toMatchObject({ drops: [], adds: [] })
  })

  it('keeps the other side when asked, and then the first side changes', () => {
    const plan = spellingFixPlan(pair, 'b')
    expect(plan.to).toBe('115 E Sampel St, Exampleville, TX')
    expect(plan.rows.map((r) => r.id)).toEqual(['j1', 'j2'])
  })

  it('names a number the kept spelling would drop, and none it would add', () => {
    const units = { a: at('8217 Placeholder Creek Blvd,'), b: at('8217 Placeholder Creek Blvd 201') }
    expect(spellingFixPlan(units, 'a')).toMatchObject({ drops: ['201'], adds: [] })
    expect(spellingFixPlan(units, 'b')).toMatchObject({ drops: [], adds: ['201'] })
    expect(spellingFixPlan(units, 'a').rows).toEqual([{ kind: 'job', id: 'j5', label: 'A job with no number', from: '8217 Placeholder Creek Blvd 201, Exampleville, TX' }])
  })
})

describe('spellingFixPlan numbers', () => {
  const pairOf = (one: string, two: string) => {
    const both = addressesOnFile(
      [
        { kind: 'job', id: 'x1', address: one, developmentId: null, label: 'J1' },
        { kind: 'job', id: 'x2', address: two, developmentId: null, label: 'J2' },
      ],
      new Map(),
    )
    return { a: both[0] as (typeof both)[number], b: both[1] as (typeof both)[number] }
  }

  it('calls a space moved inside a road number no change of number', () => {
    expect(spellingFixPlan(pairOf('11704 FM 1117, Placeholder, TX', '11704 FM1117, Placeholder, TX'), 'a')).toMatchObject({ drops: [], adds: [] })
  })

  it('leaves a zip code only one side has out of the caution', () => {
    expect(spellingFixPlan(pairOf('115 E Sample St, Exampleville, TX 78640', '115 E Sampel St, Exampleville, TX'), 'b')).toMatchObject({ drops: [], adds: [] })
  })

  it('names a house number that differs', () => {
    expect(spellingFixPlan(pairOf('115 E Sample St, Exampleville, TX', '117 E Sample St, Exampleville, TX'), 'a')).toMatchObject({ drops: ['117'], adds: ['115'] })
  })
})

describe('the words', () => {
  it('says which number comes off or goes on, or nothing', () => {
    expect(numberCaution({ drops: [], adds: [] })).toBeNull()
    expect(numberCaution({ drops: ['201'], adds: [] })).toBe('This takes 201 off the address. If that is a unit of its own, press Cancel and answer Not the same.')
    expect(numberCaution({ drops: [], adds: ['201'] })).toBe('This puts 201 on the address. If that is a unit of its own, press Cancel and answer Not the same.')
    expect(numberCaution({ drops: ['16'], adds: ['20'] })).toBe('This takes 16 off the address and puts 20 on it. If that is a unit of its own, press Cancel and answer Not the same.')
  })

  it('counts on the button and leaves the count out at zero', () => {
    expect(fixButtonWords(2)).toBe('Change 2 addresses')
    expect(fixButtonWords(1)).toBe('Change 1 address')
    expect(fixButtonWords(0)).toBe('Change addresses')
  })

  it('says what took and what did not', () => {
    expect(fixOutcomeWords(2, 0)).toMatchObject({ line: 'Changed 2 addresses.', head: null, tone: 'success' })
    expect(fixOutcomeWords(1, 1)).toMatchObject({ line: 'Changed 1 address. 1 did not change.', tone: 'warning' })
    expect(fixOutcomeWords(0, 2).tone).toBe('error')
  })

  it('names a row and its door', () => {
    expect(thingName({ kind: 'bid', label: ' ' })).toBe('A bid with no number')
    expect(thingName({ kind: 'job', label: 'J1078' })).toBe('J1078')
    expect(openJobWords({ label: 'J1078' }, 1)).toBe('Open the job')
    expect(openJobWords({ label: 'J1078' }, 2)).toBe('Open J1078')
    expect(openJobWords({ label: null }, 2)).toBe('Open the job')
  })
})
