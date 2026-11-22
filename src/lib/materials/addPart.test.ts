import { describe, expect, it } from 'vitest'
import { ADD_PART_NOTE, ADD_PART_PRESS, addPartDoneWords, addPartMovement, addPartPressLabel, partSearchWords } from './addPart'

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
