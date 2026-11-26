/**
 * The sign that a row swipes (punch list #426, way A of the mock-up of 2026-11-25). The Dashboard's
 * My Bids and Recent Reports put a row away with a swipe to the left and bring one back with a swipe
 * to the right (`swipeAway.ts`). On a device held in the hand a row has no press that says so, so the
 * first row of a card shows it: when the row has stood in full view for half a second, with no finger
 * down and the page still, it slides by itself far enough to read its strip's word, holds, and slides
 * back (`SwipeAwayRow`). The slide stops short of the mark, so the sign can never do the act.
 *
 * How often: once a day at most and three times at most for each way, and never again once the person
 * has made that swipe themselves. The count belongs to the gesture, not to a card: whichever card comes
 * into view first shows it, and the other stays still that day.
 *
 * Where it is kept: with the person, the way a dismissed alert is (`dismissalStore.ts`): the device's
 * own storage, mirrored to `user_dismissals` and seeded onto a new device at sign-in. While View as is
 * on nothing is written, since the person viewed has not seen it.
 *
 * A person who asked their device for less motion gets no slide. The card draws the gesture's words
 * under its heading for that visit instead, and the visit counts the same.
 */
import { pushDismissal } from './dismissalStore'
import { isImpersonationSessionActive } from './impersonationSession'

/** The storage key's prefix: the person's id follows it, as `dismissalStore` seeds it. */
export const SWIPE_SIGN_PREFIX = 'pipetooling.swipeSign.'

/** How many times a way is shown to a person who has not made the swipe themselves. */
export const SWIPE_SIGN_MAX_PLAYS = 3

/** How long the row must stand in full view, with no finger down and the page still, before it shows its strip. */
export const SWIPE_SIGN_STILL_MS = 500

/** The two swipes: `away` is left, on a shown row; `back` is right, on a put-away one. */
export type SwipeSignWay = 'away' | 'back'

type SwipeSignCount = {
  /** How many times the sign has shown this way. */
  plays: number
  /** The company's day it last showed, so it shows once a day at most. */
  lastYmd: string | null
  /** True once the person made this swipe themselves: the sign is done for good. */
  learned: boolean
}

export type SwipeSignState = Record<SwipeSignWay, SwipeSignCount>

const NEW_COUNT: SwipeSignCount = { plays: 0, lastYmd: null, learned: false }

/** A person who has seen nothing yet. */
export function newSwipeSignState(): SwipeSignState {
  return { away: { ...NEW_COUNT }, back: { ...NEW_COUNT } }
}

function readCount(raw: unknown): SwipeSignCount {
  if (!raw || typeof raw !== 'object') return { ...NEW_COUNT }
  const r = raw as Record<string, unknown>
  const plays = typeof r.plays === 'number' && Number.isFinite(r.plays) ? Math.max(0, Math.floor(r.plays)) : 0
  const lastYmd = typeof r.lastYmd === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(r.lastYmd) ? r.lastYmd : null
  return { plays, lastYmd, learned: r.learned === true }
}

/** What storage held, read with care: anything that is not a count reads as nothing seen. */
export function readSwipeSignState(raw: unknown): SwipeSignState {
  if (!raw || typeof raw !== 'object') return newSwipeSignState()
  const r = raw as Record<string, unknown>
  return { away: readCount(r.away), back: readCount(r.back) }
}

/** The person's count on this device. A blocked or unreadable store reads as nothing seen. */
export function loadSwipeSignState(userId: string): SwipeSignState {
  try {
    const raw = localStorage.getItem(SWIPE_SIGN_PREFIX + userId)
    return raw ? readSwipeSignState(JSON.parse(raw)) : newSwipeSignState()
  } catch {
    return newSwipeSignState()
  }
}

/** Keep the count on this device and with the person. Held while View as is on. */
export function saveSwipeSignState(userId: string, state: SwipeSignState): void {
  if (isImpersonationSessionActive()) return
  pushDismissal(SWIPE_SIGN_PREFIX, userId, state)
  try {
    localStorage.setItem(SWIPE_SIGN_PREFIX + userId, JSON.stringify(state))
  } catch {
    /* A blocked store only means the sign may show again: never break the card. */
  }
}

/** Whether the sign may show this way today: not learned, under the cap, and not already shown today. */
export function swipeSignMayPlay(state: SwipeSignState, way: SwipeSignWay, todayYmd: string): boolean {
  const c = state[way]
  return !c.learned && c.plays < SWIPE_SIGN_MAX_PLAYS && c.lastYmd !== todayYmd
}

/** The count after the sign showed this way today. */
export function swipeSignPlayed(state: SwipeSignState, way: SwipeSignWay, todayYmd: string): SwipeSignState {
  return { ...state, [way]: { ...state[way], plays: state[way].plays + 1, lastYmd: todayYmd } }
}

/** The count after the person made this swipe themselves: the sign is done for good, this way. */
export function swipeSignLearned(state: SwipeSignState, way: SwipeSignWay): SwipeSignState {
  return state[way].learned ? state : { ...state, [way]: { ...state[way], learned: true } }
}
