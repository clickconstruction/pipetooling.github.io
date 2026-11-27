/**
 * The press around the **?** beside the Bridge's rule line (punch list #321, finding 282: the walk of 2026-11-27 read
 * it at 24 by 24 px on a phone 375 px wide, where a thumb's size is 44).
 *
 * The circle is drawn 24 px across at a desk and on a phone alike. On a phone the press around it stands a thumb
 * square, and its margins give back what it grew by, so the line is as tall as it was drawn and the circle stays where
 * it was: `thumbInLine` up and down, the same 10 px off the right, and on the left the press's own clear strip stands
 * in for the row's gap. Pure: `BridgeRule.tsx` draws it.
 */
import type { CSSProperties } from 'react'
import { PHONE_PRESS_MIN_HEIGHT, thumbInLine } from '../phonePress'

/** How wide and tall the circle is drawn, everywhere. */
export const RULE_ASK_DRAWN = 24

/** The gap between the rule's words and the **?** at a desk. */
export const RULE_ASK_DESK_GAP = '0.6rem'

export function ruleAskPress(phone: boolean): { press: CSSProperties; rowGap: string | number } {
  if (!phone) return { press: { width: RULE_ASK_DRAWN, height: RULE_ASK_DRAWN }, rowGap: RULE_ASK_DESK_GAP }
  const grewBy = (PHONE_PRESS_MIN_HEIGHT - RULE_ASK_DRAWN) / 2
  return { press: { ...thumbInLine(RULE_ASK_DRAWN), width: PHONE_PRESS_MIN_HEIGHT, marginRight: -grewBy }, rowGap: 0 }
}
