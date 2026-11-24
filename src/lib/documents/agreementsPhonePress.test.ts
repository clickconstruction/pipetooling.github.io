import { describe, expect, it } from 'vitest'
import { PHONE_PRESS_MIN_HEIGHT } from '../phonePress'
import { PARTY_PICKER_CLOSE_DRAWN, paperChipFloor, paperNamePress, paperPressFloor, partyPickerClosePress } from './agreementsPhonePress'

describe('the Agreements presses on a phone', () => {
  it('stands every press a fingertip tall at a phone width, by the app\'s one height', () => {
    expect(PHONE_PRESS_MIN_HEIGHT).toBe(44)
    expect(paperPressFloor(true)).toEqual({ minHeight: 44, boxSizing: 'border-box' })
    expect(paperChipFloor(true).minHeight).toBe(44)
    expect(paperNamePress(true).minHeight).toBe(44)
    expect(partyPickerClosePress(true).minHeight).toBe(44)
  })

  it('adds nothing at a desk, so the look there is the caller\'s own', () => {
    for (const style of [paperPressFloor(false), paperChipFloor(false), paperNamePress(false), partyPickerClosePress(false)]) {
      expect(style).toEqual({})
    }
    // Spread over a caller's style, a desk's answer changes no key.
    const drawn = { padding: '0.3rem 0.7rem', fontSize: '0.8125rem' }
    expect({ ...drawn, ...paperPressFloor(false) }).toEqual(drawn)
  })

  it('keeps a short chip a pill: as wide as it is tall', () => {
    expect(paperChipFloor(true).minWidth).toBe(paperChipFloor(true).minHeight)
  })

  it('centres a name\'s words in the press, level with the tag beside them', () => {
    expect(paperNamePress(true)).toEqual({ display: 'inline-flex', alignItems: 'center', minHeight: 44 })
  })

  it('makes the picker\'s × a thumb\'s square and gives back what it grew by, so the title row does not move', () => {
    const press = partyPickerClosePress(true)
    expect(press.minWidth).toBe(44)
    // Up and down: the row stays as tall as the × was drawn.
    expect(Number(press.minHeight) + Number(press.marginTop) + Number(press.marginBottom)).toBe(PARTY_PICKER_CLOSE_DRAWN.height)
    // Side to side: the × keeps its place, and the title beside it its width.
    expect(Number(press.minWidth) + Number(press.marginLeft) + Number(press.marginRight)).toBe(PARTY_PICKER_CLOSE_DRAWN.width)
    expect(press.marginLeft).toBe(press.marginRight)
  })
})
