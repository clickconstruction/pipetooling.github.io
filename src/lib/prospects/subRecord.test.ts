import { describe, expect, it } from 'vitest'
import { NEW_RECORD, SUB_RECORD_ORDER, SUB_RECORD_WORDS, recordFact, recordFromCounts, recordTone, subRecordOf, subRecords } from './subRecord'

const calls = [
  { prospect_id: 'a', interaction_type: 'answered' },
  { prospect_id: 'a', interaction_type: 'answered' },
  { prospect_id: 'b', interaction_type: 'didnt_answer' },
  { prospect_id: 'b', interaction_type: 'answered' },
  { prospect_id: 'c', interaction_type: 'didnt_answer' },
  { prospect_id: 'c', interaction_type: 'didnt_answer' },
  { prospect_id: 'c', interaction_type: 'didnt_answer' },
  { prospect_id: 'd', interaction_type: 'didnt_answer' },
  { prospect_id: 'e', interaction_type: 'user_comment' },
]

describe('subRecord', () => {
  it('judges at the bench’s thresholds: two calls the least, answers at three in four, hit or miss at two in five', () => {
    expect(recordFromCounts(0, 0)).toBe('new')
    expect(recordFromCounts(1, 1)).toBe('new')
    expect(recordFromCounts(2, 2)).toBe('reliable')
    expect(recordFromCounts(4, 3)).toBe('reliable')
    expect(recordFromCounts(2, 1)).toBe('mixed')
    expect(recordFromCounts(5, 2)).toBe('mixed')
    expect(recordFromCounts(3, 0)).toBe('silent')
    expect(recordFromCounts(5, 1)).toBe('silent')
  })

  it('reads every prospect’s record from the call rows, a note counting for nothing', () => {
    const r = subRecords({ calls })
    expect(subRecordOf(r, 'a')).toEqual({ calls: 2, answered: 2, record: 'reliable' })
    expect(subRecordOf(r, 'b')).toEqual({ calls: 2, answered: 1, record: 'mixed' })
    expect(subRecordOf(r, 'c')).toEqual({ calls: 3, answered: 0, record: 'silent' })
    expect(subRecordOf(r, 'd')).toEqual({ calls: 1, answered: 0, record: 'new' })
    expect(subRecordOf(r, 'e')).toBe(NEW_RECORD)
    expect(subRecordOf(r, 'nobody')).toBe(NEW_RECORD)
  })

  it('counts a text or an email back on the thread as an answer', () => {
    const r = subRecords({ calls, inbound: new Set(['c', 'z']) })
    expect(subRecordOf(r, 'c')).toEqual({ calls: 4, answered: 1, record: 'silent' })
    expect(subRecordOf(r, 'z')).toEqual({ calls: 1, answered: 1, record: 'new' })
  })

  it('speaks the bench’s words, in the bench’s order, with the fact under the chip', () => {
    expect(SUB_RECORD_WORDS).toEqual({ new: 'new to us', reliable: 'answers', mixed: 'hit or miss', silent: 'often silent' })
    expect([...Object.entries(SUB_RECORD_ORDER)].sort((a, b) => a[1] - b[1]).map((e) => e[0])).toEqual(['reliable', 'mixed', 'new', 'silent'])
    expect(recordFact({ calls: 0, answered: 0, record: 'new' })).toBe('never called')
    expect(recordFact({ calls: 1, answered: 0, record: 'new' })).toBe('answered 0 of 1 call')
    expect(recordFact({ calls: 2, answered: 1, record: 'mixed' })).toBe('answered 1 of 2 calls')
    expect(recordTone('reliable')).toBe('green')
    expect(recordTone('silent')).toBe('red')
    expect(recordTone('new')).toBe('grey')
  })
})
