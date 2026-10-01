import { describe, expect, it } from 'vitest'
import {
  firstName,
  forMeByBid,
  fromMeByBid,
  isSenderRequestShown,
  normalizeBidMarkNote,
  personInitial,
  receiverHeading,
  receiverLine,
  senderStateWords,
  senderTone,
  suggestedPeople,
  unseenForMeCount,
  type BidMarkRequest,
} from './bidMarkRequests'

const NOW = new Date(2026, 9, 1, 15, 0, 0) // Thu Oct 1, 2026, local
const at = (m: number, d: number, h = 9) => new Date(2026, m, d, h).toISOString()

function req(over: Partial<BidMarkRequest> & { id: string }): BidMarkRequest {
  return {
    bid_id: 'b1',
    for_user_id: 'robert',
    from_user_id: 'wendi',
    note: '',
    created_at: at(9, 1),
    seen_at: null,
    closed_at: null,
    outcome: null,
    ...over,
  }
}

describe('names', () => {
  it('first name and initial, with a fallback for an empty name', () => {
    expect(firstName('Wendi Carter')).toBe('Wendi')
    expect(firstName('  ')).toBe('Someone')
    expect(personInitial('robert')).toBe('R')
    expect(personInitial(null)).toBe('?')
  })
})

describe('the receiver', () => {
  it('collects open requests for me by bid, newest first, and counts the unseen', () => {
    const rows = [
      req({ id: 'a', created_at: at(8, 30) }),
      req({ id: 'b', from_user_id: 'malachi', created_at: at(9, 1), seen_at: at(9, 1, 10) }),
      req({ id: 'c', bid_id: 'b2' }),
      req({ id: 'd', closed_at: at(9, 1), outcome: 'done' }),
      req({ id: 'e', for_user_id: 'malachi', from_user_id: 'robert' }),
    ]
    const mine = forMeByBid(rows, 'robert')
    expect(mine.get('b1')?.map((r) => r.id)).toEqual(['b', 'a'])
    expect(mine.get('b2')?.map((r) => r.id)).toEqual(['c'])
    expect(mine.size).toBe(2)
    expect(unseenForMeCount(rows, 'robert')).toBe(2)
    expect(forMeByBid(rows, null).size).toBe(0)
  })

  it('the row line carries the note, or says who marked it', () => {
    expect(receiverLine(req({ id: 'a', note: ' Reprice the trim. ' }), 'Wendi Carter')).toBe('Wendi: Reprice the trim.')
    expect(receiverLine(req({ id: 'a' }), 'Wendi')).toBe('Wendi marked this for you')
    expect(receiverHeading(req({ id: 'a', created_at: at(8, 28) }), 'Wendi', NOW)).toBe('Wendi marked this for you Mon')
  })
})

describe('the sender', () => {
  it('shows open requests, finished ones for three days, never a taken-back one', () => {
    expect(isSenderRequestShown(req({ id: 'a' }), NOW)).toBe(true)
    expect(isSenderRequestShown(req({ id: 'a', closed_at: at(8, 29), outcome: 'done' }), NOW)).toBe(true)
    expect(isSenderRequestShown(req({ id: 'a', closed_at: at(8, 27), outcome: 'done' }), NOW)).toBe(false)
    expect(isSenderRequestShown(req({ id: 'a', closed_at: at(9, 1), outcome: 'taken_back' }), NOW)).toBe(false)
  })

  it('keeps the newest shown request per bid', () => {
    const rows = [
      req({ id: 'old', created_at: at(8, 29), closed_at: at(8, 30), outcome: 'done' }),
      req({ id: 'new', for_user_id: 'malachi', created_at: at(9, 1) }),
      req({ id: 'gone', bid_id: 'b2', closed_at: at(9, 1), outcome: 'taken_back' }),
      req({ id: 'not-mine', bid_id: 'b3', from_user_id: 'robert', for_user_id: 'wendi' }),
    ]
    const sent = fromMeByBid(rows, 'wendi', NOW)
    expect([...sent.entries()].map(([b, r]) => `${b}:${r.id}`)).toEqual(['b1:new'])
  })

  it('words and tone for each state', () => {
    expect(senderStateWords(req({ id: 'a' }), 'Robert', NOW)).toBe('for Robert · not seen yet')
    expect(senderStateWords(req({ id: 'a', seen_at: at(8, 29) }), 'Robert', NOW)).toBe('for Robert · seen Tue')
    expect(senderStateWords(req({ id: 'a', seen_at: at(8, 29), closed_at: at(8, 28), outcome: 'done' }), 'Robert', NOW)).toBe('Robert is done · Mon')
    expect(senderStateWords(req({ id: 'a', closed_at: at(9, 1), outcome: 'not_for_me' }), 'Robert', NOW)).toBe('Robert passed it back · today')
    expect(senderTone(req({ id: 'a' }))).toBe('waiting')
    expect(senderTone(req({ id: 'a', seen_at: at(9, 1) }))).toBe('seen')
    expect(senderTone(req({ id: 'a', closed_at: at(9, 1), outcome: 'done' }))).toBe('done')
    expect(senderTone(req({ id: 'a', closed_at: at(9, 1), outcome: 'not_for_me' }))).toBe('passed')
  })
})

describe('suggestedPeople', () => {
  const roster = [
    { id: 'robert', name: 'Robert', role: 'dev' },
    { id: 'wendi', name: 'Wendi', role: 'assistant' },
    { id: 'malachi', name: 'Malachi', role: 'master_technician' },
    { id: 'taunya', name: 'Taunya', role: 'assistant' },
  ]

  it('the bid people first, never me, then everyone else by name', () => {
    const out = suggestedPeople(roster, { estimator_id: 'robert', account_manager_id: 'wendi' }, 'wendi')
    expect(out.onBid.map((p) => `${p.name}:${p.label}`)).toEqual(['Robert:Estimator'])
    expect(out.others.map((p) => p.name)).toEqual(['Malachi', 'Taunya'])
  })

  it('one person in both seats is listed once, and an unknown id is skipped', () => {
    const out = suggestedPeople(roster, { estimator_id: 'malachi', account_manager_id: 'malachi' }, 'wendi')
    expect(out.onBid.map((p) => `${p.name}:${p.label}`)).toEqual(['Malachi:Estimator and Account Man'])
    expect(suggestedPeople(roster, { estimator_id: 'ghost' }, 'wendi').onBid).toEqual([])
  })
})

it('normalizeBidMarkNote trims and caps the note', () => {
  expect(normalizeBidMarkNote('  hi  ')).toBe('hi')
  expect(normalizeBidMarkNote('x'.repeat(400))).toHaveLength(280)
})
