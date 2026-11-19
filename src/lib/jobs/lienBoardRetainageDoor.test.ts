import { describe, expect, it } from 'vitest'
import { lienBoardRetainageLine } from './lienBoard'
import { LIEN_BOARD_RETAINAGE_DOOR, LIEN_BOARD_RETAINAGE_DOOR_HINT, lienBoardRetainageDoor } from './lienBoardRetainageDoor'

describe('lienBoardRetainageDoor — the Retainage line and its door', () => {
  it('keeps the line’s words and names the door Open when the desk hands one', () => {
    expect(lienBoardRetainageDoor('Retainage · 1 to send for approval · 6 look held, not on the job', true)).toEqual({ words: 'Retainage · 1 to send for approval · 6 look held, not on the job', door: 'Open' })
    expect(LIEN_BOARD_RETAINAGE_DOOR).toBe('Open')
    expect(LIEN_BOARD_RETAINAGE_DOOR_HINT).toBe('Open the Retainage list on By paper')
  })

  it('is words alone with no door to hand', () => {
    expect(lienBoardRetainageDoor('Retainage · 2 approved to mail', false)).toEqual({ words: 'Retainage · 2 approved to mail', door: null })
  })

  it('is nothing with no line, so a door never stands alone', () => {
    expect(lienBoardRetainageDoor(null, true)).toBeNull()
    expect(lienBoardRetainageDoor(undefined, true)).toBeNull()
    expect(lienBoardRetainageDoor('  ', true)).toBeNull()
  })

  it('carries a door for every line the Board can write, and none for an empty retainage desk', () => {
    // Retainage nobody recorded alone still writes a line, and its rows are on the same list.
    const unrecorded = lienBoardRetainageLine([], 6)
    expect(unrecorded).toBe('Retainage · 6 look held, not on the job')
    expect(lienBoardRetainageDoor(unrecorded, true)?.door).toBe('Open')
    expect(lienBoardRetainageDoor(lienBoardRetainageLine([], 0), true)).toBeNull()
  })
})
