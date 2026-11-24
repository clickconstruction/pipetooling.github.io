/**
 * The mode row's five seconds (punch list #433).
 *
 * When the app opens on a phone the row shows over the top of the Dashboard, a bar on its lower edge
 * runs out, and the row shrinks into the gear, where the same three modes are listed from then on.
 * This file is that count and nothing else: one state and one step function. It is pure. `ModeRow`
 * holds the state, feeds it what happened with the time it happened, and sets one timer for the next
 * moment the state names (`modeRowCountDeadline`).
 *
 * The rules, in the owner's order (2026-11-24, and the look on a real phone the same day):
 *
 * - **Five seconds.** An opening shows the row for `MODE_ROW_SHOW_MS`.
 * - **A finger holds it.** While a finger rests on the row, or a keyboard's focus is inside it, the
 *   count waits. When the last hold lifts the count starts whole again, never where it stopped: a row
 *   that leaves a moment after a thumb let go is the fault this guards.
 * - **A press closes it.** A third was pressed, the lit one too: the choice is made, so the row
 *   shrinks into the gear at once. A press on the row Task Mode holds, which is a line of the page,
 *   draws the row for that way out alone.
 * - **A swipe up sends it away at once**, the same way.
 * - **The strip it uncovers is dead for a moment.** `leaving` lasts the way out and then
 *   `MODE_ROW_DEAD_MS` more, while the gear answers. The row's place keeps taking presses for that
 *   long and does nothing with them, so a thumb aimed at a third does not land on the header that
 *   was under it.
 *
 * What counts as an opening is at the foot. The row's first draw after the app loads is one, and
 * `ModeRow` sees that by itself. The one it cannot see that way is here: coming back to the app
 * after a while away.
 */

/** How long a visit shows the row. */
export const MODE_ROW_SHOW_MS = 5000
/** The slide down, when coming back to the app brought the row. */
export const MODE_ROW_IN_MS = 180
/** The way out: the row shrinking into the gear. Long enough for an eye to follow it there. */
export const MODE_ROW_OUT_MS = 380
/** How long the uncovered strip takes no press, once the row is out of sight. The gear answers for as long. */
export const MODE_ROW_DEAD_MS = 300
/** How far up a finger travels on the row before the row is sent away. */
export const MODE_ROW_SWIPE_PX = 16
/** How long the app is out of sight before coming back to it is an opening. A glance at a text is not one. */
export const MODE_ROW_AWAY_MS = 60_000

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
  /** The app opened, or came back after a while away. `slideIn` is whether the row should slide down or be drawn in place. */
  | { type: 'arrive'; now: number; slideIn: boolean }
  | { type: 'touch'; now: number; hold: ModeRowHold }
  | { type: 'release'; now: number; hold: ModeRowHold }
  /** A third was pressed: the choice is made and the row closes. */
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
      // The choice is made. From `gone` it is a press on the row Task Mode holds: the row is drawn for its way out alone.
      return state.phase === 'leaving' ? state : leaving(state.showing, event.now)
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

/* ------------------------------------------------------------------ what counts as an opening */

/** Coming back to the app is an opening once it was out of sight for `MODE_ROW_AWAY_MS`. `hiddenAt` is null when it never left. */
export function modeRowBackIsVisit(hiddenAt: number | null, now: number): boolean {
  return hiddenAt !== null && now - hiddenAt >= MODE_ROW_AWAY_MS
}

/* ------------------------------------------------------------------ the way out, into the gear */

/** A box on the screen, as `getBoundingClientRect` gives it. */
export interface ModeRowBox {
  left: number
  top: number
  width: number
  height: number
}

/**
 * How the row gets from where it lies to the gear: how far its middle travels, and how small it ends,
 * across and down, so that it ends the gear's own size on the gear. None when there is no gear on the
 * screen, or either box has no size: the row then slides up as it did before.
 */
export function modeRowFlight(row: ModeRowBox, gear: ModeRowBox | null): { x: number; y: number; sx: number; sy: number } | null {
  if (!gear || !(row.width > 0) || !(row.height > 0) || !(gear.width > 0) || !(gear.height > 0)) return null
  const round = (n: number) => Math.round(n * 1000) / 1000
  return {
    x: round(gear.left + gear.width / 2 - (row.left + row.width / 2)),
    y: round(gear.top + gear.height / 2 - (row.top + row.height / 2)),
    sx: round(Math.min(1, gear.width / row.width)),
    sy: round(Math.min(1, gear.height / row.height)),
  }
}
