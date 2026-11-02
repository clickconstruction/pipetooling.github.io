import { describe, expect, it } from 'vitest'
import { EXCERPT_WIDTH, excerptOf, excerptTokens, type Excerpt } from '../../../supabase/functions/_shared/excerpt'

const marked = (ex: Excerpt): string[] => ex.marks.map(([a, b]) => ex.text.slice(a, b))

const filler = (n: number) => Array.from({ length: n }, (_, i) => `word${i}`).join(' ')

describe('excerpt (v2.6306)', () => {
  it('reads the searched words as Drive matches them', () => {
    expect(excerptTokens(' Rock  clause ')).toEqual(['rock', 'clause'])
    expect(excerptTokens('“permit”, (final) a')).toEqual(['permit', 'final'])
    expect(excerptTokens('x')).toEqual([])
  })

  it('cuts one line around the words, on word boundaries, with the words marked', () => {
    const text = `${filler(60)} The owner agreed to the rock clause as written in the bid. ${filler(60)}`
    const ex = excerptOf(text, 'rock clause')!
    expect(ex.text.startsWith('…')).toBe(true)
    expect(ex.text.endsWith('…')).toBe(true)
    expect(ex.text).toContain('agreed to the rock clause as written')
    expect(ex.text.length).toBeLessThanOrEqual(EXCERPT_WIDTH + 2)
    expect(ex.text.slice(1, 2)).not.toBe(' ')
    expect(marked(ex)).toEqual(['rock clause'])
  })

  it('a match at the start has no leading ellipsis, and at the end no trailing one', () => {
    const head = excerptOf(`Permit 2026-0412 was issued on Oct 14. ${filler(80)}`, 'permit')!
    expect(head.text.startsWith('Permit')).toBe(true)
    expect(head.text.endsWith('…')).toBe(true)
    expect(marked(head)).toEqual(['Permit'])
    const tail = excerptOf(`${filler(80)} and the final permit was issued.`, 'permit')!
    expect(tail.text.startsWith('…')).toBe(true)
    expect(tail.text.endsWith('issued.')).toBe(true)
  })

  it('prefers the place where all the words sit together over the first word alone', () => {
    const text = `A rock was found early. ${filler(120)} Later the rock clause was agreed. ${filler(20)}`
    const ex = excerptOf(text, 'rock clause')!
    expect(ex.text).toContain('rock clause was agreed')
    expect(ex.text).not.toContain('found early')
    expect(marked(ex)).toEqual(['rock clause'])
  })

  it('marks every occurrence inside the cut and merges overlaps', () => {
    const ex = excerptOf('The permit, the permit fee and the permit number all matter.', 'permit fee')!
    expect(marked(ex)).toEqual(['permit', 'permit fee', 'permit'])
  })

  it('folds whitespace and answers null when the words are not there', () => {
    expect(excerptOf('one\n\n  two   three', 'two three')!.text).toBe('one two three')
    expect(excerptOf('nothing here', 'permit')).toBeNull()
    expect(excerptOf('   ', 'permit')).toBeNull()
    expect(excerptOf('some text', 'a')).toBeNull()
  })
})
