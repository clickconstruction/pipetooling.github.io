import { describe, expect, it } from 'vitest'
import { taskPressesUnderWords } from './taskPillStyle'

describe('where a task row’s presses sit (punch list #369)', () => {
  it('beside the words at a desk, for a row that is not the Next card', () => {
    expect(taskPressesUnderWords(false, false)).toBe(false)
  })
  it('under the words on a phone, so the words get the width', () => {
    expect(taskPressesUnderWords(false, true)).toBe(true)
  })
  it('under the words on the Next card at every width, as it was', () => {
    expect(taskPressesUnderWords(true, false)).toBe(true)
    expect(taskPressesUnderWords(true, true)).toBe(true)
  })
})
