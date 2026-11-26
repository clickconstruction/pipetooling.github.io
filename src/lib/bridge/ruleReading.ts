/**
 * The Bridge's rule line: when the long reading behind its **?** is open (punch list #321, finding 275).
 *
 * The reading opens three ways: the pointer rests on the line, the **?** takes the keyboard's focus, or the **?** is
 * pressed. One `open` flag with all three writing it made a press do two things: the pointer's arrival or the focus
 * opened the reading, and the same press's click toggled it shut. On a phone a tap is an arrival and then a click, so
 * the first tap showed nothing.
 *
 * So a press is kept apart from a look. A look (hover, focus) opens the reading, and the look ending shuts it, as
 * before. A press on a reading no press has taken yet keeps it open, whether or not a look had opened it, and the
 * next press shuts it, however the pointer got there. Pure: `BridgeRule.tsx` feeds it events.
 */

export type RuleReading = {
  /** The reading is drawn. */
  open: boolean
  /** A press has taken it: the next press shuts it. Without this the click after a look would shut what the look opened. */
  held: boolean
}

export type RuleReadingEvent =
  /** The pointer came onto the line, or the ? took focus. */
  | 'look'
  /** The pointer left the line, or the ? lost focus. */
  | 'lookEnded'
  /** The ? was pressed: a click, a tap, Enter or Space. */
  | 'press'
  /** Escape, or a press anywhere off the line and its reading. It shuts the reading as the look ending does. */
  | 'dismiss'

export const RULE_READING_SHUT: RuleReading = { open: false, held: false }

export function ruleReadingAfter(state: RuleReading, event: RuleReadingEvent): RuleReading {
  switch (event) {
    case 'look':
      return state.open ? state : { open: true, held: state.held }
    case 'press':
      // The first press keeps it open, whether or not a look had opened it already. The second shuts it, and it
      // stays shut though the pointer still rests there, until the next look or press.
      return state.held ? RULE_READING_SHUT : { open: true, held: true }
    case 'lookEnded':
    case 'dismiss':
      return state.open || state.held ? RULE_READING_SHUT : state
  }
}
