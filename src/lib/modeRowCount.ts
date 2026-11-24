/**
 * The mode row's five seconds (punch list #433).
 *
 * On a phone's Dashboard the row shows on each visit, a bar on its lower edge runs out, and the row
 * slides up and away. This file is that count and nothing else: one state and one step function. It
 * is pure. `ModeRow` holds the state, feeds it what happened with the time it happened, and sets one
 * timer for the next moment the state names (`modeRowCountDeadline`).
 *
 * The rules, in the owner's order (2026-11-24):
 *
 * - **Five seconds.** A visit shows the row for `MODE_ROW_SHOW_MS`.
 * - **A finger holds it.** While a finger rests on the row, or a keyboard's focus is inside it, the
 *   count waits. When the last hold lifts the count starts whole again, never where it stopped: a row
 *   that leaves a moment after a thumb let go is the fault this guards.
 * - **A press gets a fresh five seconds**, so the way back is under the thumb.
 * - **A swipe up sends it away at once.**
 * - **The strip it uncovers is dead for a moment.** `leaving` lasts the slide and then
 *   `MODE_ROW_DEAD_MS` more. The row's place keeps taking presses for that long and does nothing with
 *   them, so a thumb aimed at a third does not land on the header that was under it.
 */

/** How long a visit shows the row. */
export const MODE_ROW_SHOW_MS = 5000
/** The slide down, when a pull, the handle or a change of page brought the row. */
export const MODE_ROW_IN_MS = 180
/** The slide up and out. */
export const MODE_ROW_OUT_MS = 240
/** How long the uncovered strip takes no press, once the row is out of sight. */
export const MODE_ROW_DEAD_MS = 300
/** How far up a finger travels on the row before the row is sent away. */
export const MODE_ROW_SWIPE_PX = 16

/** What is holding the row: a finger on it, or a keyboard's focus inside it. */
export type ModeRowHold = 'finger' | 'focus'

/**
 * `showing` counts every whole start of the five seconds. The bar is drawn again for each, so it
 * always starts full.
 */
export type ModeRowCount =
  | { phase: 'gone'; showing: number }
  | { phase: 'showing'; showing: number; slideIn: boolean; endsAt: number }
  | { phase: 'held'; showing: number; slideIn: boolean; holds: readonly ModeRowHold[] }
  | { phase: 'leaving'; showing: number; goneAt: number }

export const MODE_ROW_GONE: ModeRowCount = { phase: 'gone', showing: 0 }

export type ModeRowCountEvent =
  /** A visit, the handle or a pull. `slideIn` is whether the row should slide down or be drawn in place. */
  | { type: 'arrive'; now: number; slideIn: boolean }
  | { type: 'touch'; now: number; hold: ModeRowHold }
  | { type: 'release'; now: number; hold: ModeRowHold }
  /** A third was pressed and the page switched. */
  | { type: 'press'; now: number }
  | { type: 'swipe'; now: number }
  /** The timer rang. */
  | { type: 'time'; now: number }
  /** The page is no longer the row's, or the phone was put away. */
  | { type: 'hide' }

/** A whole five seconds from `now`. */
function whole(showing: number, slideIn: boolean, now: number): ModeRowCount {
  return { phase: 'showing', showing: showing + 1, slideIn, endsAt: now + MODE_ROW_SHOW_MS }
}

function leaving(showing: number, now: number): ModeRowCount {
  return { phase: 'leaving', showing, goneAt: now + MODE_ROW_OUT_MS + MODE_ROW_DEAD_MS }
}

export function modeRowCountStep(state: ModeRowCount, event: ModeRowCountEvent): ModeRowCount {
  switch (event.type) {
    case 'arrive':
      // A held row is already on the page and stays held: the hold decides when its count starts.
      if (state.phase === 'held') return state
      // A row already showing is not slid in again.
      return whole(state.showing, state.phase === 'showing' ? state.slideIn : event.slideIn, event.now)
    case 'touch':
      if (state.phase === 'showing') return { phase: 'held', showing: state.showing, slideIn: state.slideIn, holds: [event.hold] }
      if (state.phase === 'held' && !state.holds.includes(event.hold)) return { ...state, holds: [...state.holds, event.hold] }
      return state
    case 'release': {
      if (state.phase !== 'held' || !state.holds.includes(event.hold)) return state
      const holds = state.holds.filter((h) => h !== event.hold)
      return holds.length > 0 ? { ...state, holds } : whole(state.showing, state.slideIn, event.now)
    }
    case 'press':
      // Under a hold the release starts the count. A row on its way out takes no press.
      return state.phase === 'showing' ? whole(state.showing, state.slideIn, event.now) : state
    case 'swipe':
      return state.phase === 'showing' || state.phase === 'held' ? leaving(state.showing, event.now) : state
    case 'time':
      if (state.phase === 'showing' && event.now >= state.endsAt) return leaving(state.showing, event.now)
      if (state.phase === 'leaving' && event.now >= state.goneAt) return { phase: 'gone', showing: state.showing }
      return state
    case 'hide':
      return state.phase === 'gone' ? state : { phase: 'gone', showing: state.showing }
  }
}

/** The next moment the timer should ring, or none while the row is gone or held. */
export function modeRowCountDeadline(state: ModeRowCount): number | null {
  if (state.phase === 'showing') return state.endsAt
  if (state.phase === 'leaving') return state.goneAt
  return null
}

/** Whether the row, or the dead strip it leaves for a moment, is on the page. */
export function modeRowOnScreen(state: ModeRowCount): boolean {
  return state.phase !== 'gone'
}

/** Whether a press on a third counts. A row on its way out takes none. */
export function modeRowTakesPress(state: ModeRowCount): boolean {
  return state.phase === 'showing' || state.phase === 'held'
}
