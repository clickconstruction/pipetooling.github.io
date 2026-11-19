/** What a removed answer said, read from the row as it stood. */
import { describe, expect, it, vi } from 'vitest'

vi.mock('../supabase', () => ({ supabase: {} }))

import { removedAnswerWords } from './sitePeopleTrailIo'

describe('removedAnswerWords', () => {
  it('reads a tie as its two names, and says when they were kept apart', () => {
    expect(removedAnswerWords('tie', { a_name: '2 PVC 90', b_name: '2 inch 90', verdict: 'same' })).toBe('2 PVC 90 and 2 inch 90')
    expect(removedAnswerWords('tie', { a_name: '2 PVC 90', b_name: '2 inch 90', verdict: 'different' })).toBe('2 PVC 90 and 2 inch 90, kept apart')
    expect(removedAnswerWords('tie', { a_name: ' ', b_name: '2 inch 90' })).toBe('2 inch 90')
  })

  it('reads a price as its row and its dollars, a number or the text the database sends', () => {
    expect(removedAnswerWords('price', { row_name: '2 PVC 90', kind: 'price', unit_price: 4.5 })).toBe('2 PVC 90, $4.50')
    expect(removedAnswerWords('price', { row_name: '2 PVC 90', kind: 'price', unit_price: '1204.5000' })).toBe('2 PVC 90, $1,204.50')
    expect(removedAnswerWords('price', { row_name: 'Scrap', kind: 'left_out', unit_price: null })).toBe('Scrap, left out')
    expect(removedAnswerWords('price', { kind: 'left_out' })).toBe('a row left out')
  })

  it('says nothing for a row with nothing in it', () => {
    expect(removedAnswerWords('tie', null)).toBe('')
    expect(removedAnswerWords('price', {})).toBe('')
  })
})
