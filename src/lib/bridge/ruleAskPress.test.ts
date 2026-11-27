import { describe, expect, it } from 'vitest'
import { PHONE_PRESS_MIN_HEIGHT } from '../phonePress'
import { RULE_ASK_DESK_GAP, RULE_ASK_DRAWN, ruleAskPress } from './ruleAskPress'

describe('the press around the Bridge’s ?', () => {
  it('is the 24 px circle itself at a desk, with the row’s own gap', () => {
    expect(ruleAskPress(false)).toEqual({ press: { width: 24, height: 24 }, rowGap: RULE_ASK_DESK_GAP })
  })

  it('stands a thumb square on a phone', () => {
    const { press } = ruleAskPress(true)
    expect(press.minHeight).toBe(PHONE_PRESS_MIN_HEIGHT)
    expect(press.width).toBe(PHONE_PRESS_MIN_HEIGHT)
  })

  it('gives back what it grew by, so the line stays as tall and the circle stays where it was', () => {
    const { press, rowGap } = ruleAskPress(true)
    const grewBy = (PHONE_PRESS_MIN_HEIGHT - RULE_ASK_DRAWN) / 2
    expect(press.marginTop).toBe(-grewBy)
    expect(press.marginBottom).toBe(-grewBy)
    expect(press.marginRight).toBe(-grewBy)
    // The press's own clear strip on the left is the gap now: 10 px where the desk draws 0.6rem.
    expect(rowGap).toBe(0)
    expect(PHONE_PRESS_MIN_HEIGHT + Number(press.marginTop) + Number(press.marginBottom)).toBe(RULE_ASK_DRAWN)
  })
})
