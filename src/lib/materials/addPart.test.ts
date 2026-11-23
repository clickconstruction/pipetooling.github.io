import { describe, expect, it } from 'vitest'
import { plainWordsFailures } from '../plainWords'
import { ADD_COUNT_NOTE, ADD_PART_ALREADY_MAX, ADD_PART_NOTE, ADD_PART_PRESS, FIRST_PART_NEEDS_WORDS, addAnotherLabel, addBoxWithPartLabel, addIsItsCount, addPartChoices, addPartDoneWords, addPartMovement, addPartPressLabel, addPartRows, boxKeptPartHeldWords, boxWithPartDoneWords, chipAdds, firstPartCount, firstPartOf, partSearchWords, pickForWords } from './addPart'
import type { ContainerLine } from './onSite'
import type { OnHandName } from './onSiteNames'

describe('Add a part from the office’s desk', () => {
  it('names the press, and names its box where several cards each have one', () => {
    expect(ADD_PART_PRESS).toBe('Add a part')
    expect(addPartPressLabel('G100')).toBe('Add a part to G100')
  })

  it('writes the row the Tally writes: delivered into the box, added on site, in the person’s name', () => {
    expect(addPartMovement({ jobId: 'j1', containerId: 'c1', part: { partId: null, partName: 'ZZ test elbow', manufacturer: null }, quantity: 1, byUserId: 'u1', byName: 'Dana' })).toEqual({
      jobId: 'j1', partId: null, partName: 'ZZ test elbow', manufacturer: null, quantity: 1, reason: 'delivered', fromContainerId: null, toContainerId: 'c1', note: 'added on site', byUserId: 'u1', byName: 'Dana',
    })
    // a part of the parts book keeps its id and its maker
    expect(addPartMovement({ jobId: 'j1', containerId: 'c1', part: { partId: 'p9', partName: '3/4 elbow', manufacturer: 'Nibco' }, quantity: 12, byUserId: null, byName: 'the office' })).toMatchObject({ partId: 'p9', manufacturer: 'Nibco', quantity: 12, note: ADD_PART_NOTE, byUserId: null })
  })

  it('says what was added and where', () => {
    expect(addPartDoneWords(3, 'ZZ test elbow', 'G100')).toBe('3 ZZ test elbow added to G100.')
  })

  it('sends the parts book plain words: lower case, with no comma or bracket', () => {
    expect(partSearchWords('  Elbow, 3/4 (Brass)  ')).toBe('elbow 3/4 brass')
    expect(partSearchWords(' ,() ')).toBe('')
  })
})

const name = (partName: string, pieces: number, partId: string | null = null, manufacturer: string | null = null): OnHandName => ({ key: partId ? `id:${partId}` : `words:${partName.toLowerCase()}`, partId, partName, manufacturer, pieces, boxes: ['G1'] })
const names = [name('Hangers', 94), name('3/4 Elbow', 50, 'p9', 'Nibco'), name('Black paint rust', 4)]
const line = (containerId: string, partName: string, onHand: number, partId: string | null = null): ContainerLine => ({ containerId, partKey: partId ? `id:${partId}` : `name:${partName.toLowerCase()}`, partId, partName, manufacturer: null, onHand, lastCountDiff: null, cannotFindSinceCount: 0 } as ContainerLine)

describe('the sheet opens with choices (v2.8284)', () => {
  it('words that are a name the job holds become that name, case and spacing aside', () => {
    expect(pickForWords(names, '  hangers ')).toEqual({ partId: null, partName: 'Hangers', manufacturer: null })
    expect(pickForWords(names, '3/4  elbow')).toEqual({ partId: 'p9', partName: '3/4 Elbow', manufacturer: 'Nibco' })
    expect(pickForWords(names, 'Wax  ring')).toEqual({ partId: null, partName: 'Wax ring', manufacturer: null })
  })

  it('with nothing typed it offers the box’s own words, then the job’s names, about eight', () => {
    const many = Array.from({ length: 12 }, (_, i) => name(`Part ${i}`, 100 - i))
    const open = addPartChoices({ term: ' ', names: many, matches: [], boxSaid: 'hangers' })
    expect(open.asTyped).toBeNull()
    expect(open.boxSays).toEqual({ partId: null, partName: 'hangers', manufacturer: null })
    expect(open.already).toHaveLength(ADD_PART_ALREADY_MAX)
    expect(open.already[0]!.partName).toBe('Part 0')
    // the box's words are matched to a name the job holds
    expect(addPartChoices({ term: '', names, matches: [], boxSaid: 'HANGERS' }).boxSays).toEqual({ partId: null, partName: 'Hangers', manufacturer: null })
    // a box with no line offers none
    expect(addPartChoices({ term: '', names, matches: [], boxSaid: null }).boxSays).toBeNull()
  })

  it('with something typed the words as typed come first, and are left out when a listed name is those words', () => {
    expect(addPartChoices({ term: 'wax ring', names, matches: [], boxSaid: 'hangers' })).toEqual({ asTyped: 'wax ring', boxSays: null, already: [] })
    expect(addPartChoices({ term: 'hang', names, matches: [names[0]!], boxSaid: null }).asTyped).toBe('hang')
    expect(addPartChoices({ term: 'hangers', names, matches: [names[0]!], boxSaid: null }).asTyped).toBeNull()
  })
})

describe('how many (v2.8284)', () => {
  it('a chip on the opening 1 gives its own number, and after that adds', () => {
    expect(chipAdds(1, 25, false)).toBe(25)
    expect(chipAdds(25, 25, true)).toBe(50)
    expect(chipAdds(27, 10, true)).toBe(37)
    expect(chipAdds(9990, 100, true)).toBe(9999)
    expect(addAnotherLabel(40)).toBe('Add 40 and another part')
  })
})

describe('a part put into an empty line is counted at that moment (v2.8284)', () => {
  const lines = [line('g1', 'Hangers', 40), line('g2', 'Hangers', 0), line('g1', '3/4 Elbow', 12, 'p9')]
  it('the add is the line’s count when the box held none of that part', () => {
    expect(addIsItsCount(lines, 'g1', { partId: null, partName: 'Wax ring' })).toBe(true)
    // a line at none, and the same part in another box, are both none here
    expect(addIsItsCount(lines, 'g2', { partId: null, partName: 'Hangers' })).toBe(true)
    expect(addIsItsCount([], 'g9', { partId: 'p9', partName: '3/4 Elbow' })).toBe(true)
  })

  it('and is no count when the box already held some: the person counted only what they added', () => {
    expect(addIsItsCount(lines, 'g1', { partId: null, partName: 'hangers' })).toBe(false)
    expect(addIsItsCount(lines, 'g1', { partId: 'p9', partName: 'anything' })).toBe(false)
  })

  it('writes the delivery, then the count a millisecond later, through the row Count writes', () => {
    const now = new Date('2026-11-22T15:00:00.000Z')
    const rows = addPartRows({ jobId: 'j1', containerId: 'g2', part: { partId: null, partName: 'Hangers', manufacturer: null }, quantity: 40, byUserId: 'u1', byName: 'Dana', lines, now })
    expect(rows).toEqual([
      { jobId: 'j1', partId: null, partName: 'Hangers', manufacturer: null, quantity: 40, reason: 'delivered', fromContainerId: null, toContainerId: 'g2', note: ADD_PART_NOTE, byUserId: 'u1', byName: 'Dana', at: '2026-11-22T15:00:00.000Z' },
      { jobId: 'j1', partId: null, partName: 'Hangers', manufacturer: null, quantity: 40, reason: 'counted', fromContainerId: 'g2', toContainerId: null, note: ADD_COUNT_NOTE, byUserId: 'u1', byName: 'Dana', at: '2026-11-22T15:00:00.001Z' },
    ])
    // into a line that held some: the delivery alone
    expect(addPartRows({ jobId: 'j1', containerId: 'g1', part: { partId: null, partName: 'Hangers', manufacturer: null }, quantity: 5, byUserId: 'u1', byName: 'Dana', lines, now }).map((r) => r.reason)).toEqual(['delivered'])
  })
})

describe('a new box takes its first part in the same press (v2.8284)', () => {
  it('How many is nothing, a count, or said to be wrong', () => {
    expect(firstPartCount('  ')).toEqual({ kind: 'none' })
    expect(firstPartCount(' 40 ')).toEqual({ kind: 'count', n: 40 })
    for (const bad of ['0', '-3', '4.5', 'forty', '10000']) expect(firstPartCount(bad).kind).toBe('bad')
  })

  it('the words in What is in it are the part, matched to a name the job holds', () => {
    expect(firstPartOf(names, 'hangers', { kind: 'count', n: 40 })).toEqual({ part: { partId: null, partName: 'Hangers', manufacturer: null }, n: 40 })
    expect(firstPartOf(names, 'Toilets', { kind: 'count', n: 2 })).toEqual({ part: { partId: null, partName: 'Toilets', manufacturer: null }, n: 2 })
    // no count is the box alone, and a count with no words has no part to go on
    expect(firstPartOf(names, 'hangers', { kind: 'none' })).toBeNull()
    expect(firstPartOf(names, null, { kind: 'count', n: 40 })).toBeNull()
  })

  it('the press and the toasts say the box and its part', () => {
    expect(addBoxWithPartLabel('G101', 40, 'Hangers')).toBe('Add G101 with 40 Hangers')
    expect(boxWithPartDoneWords('G101', 40, 'Hangers')).toBe('G101 added, with 40 Hangers in it.')
    expect(boxKeptPartHeldWords('G101', 40, 'Hangers', 'The office said no.')).toBe('G101 was added. Its 40 Hangers were not: The office said no. Add them from the box.')
    expect(plainWordsFailures(FIRST_PART_NEEDS_WORDS)).toEqual([])
  })
})
