/**
 * A walk while it is being painted (punch list #345): the readings kept so far, why the painting is
 * paused, and what a locked screen did to the line. Pure: a state and the events on it. The phone,
 * the clock and the screen belong to the hook that feeds it (`usePaintedWalk`).
 *
 * What the screens lean on:
 * - A phone's browser hands a page its position only while the page is on the screen. So a locked
 *   phone, a call or another app pauses the painting, and the line has a gap. The walk says so, and
 *   the person chooses: start a new stroke from here, or join the gap with a straight line.
 * - Painting stops by itself: five minutes with no real step pauses it, and an hour ends it.
 * - Every pause closes the stroke. A restart is a new stroke of the same map, unless the person
 *   joins it to the last.
 * - The readings here carry their time, because standing still and a drive are told by it. They
 *   live on the phone alone. What is saved is `walkStrokes`, which hands back shapes.
 */
import { lineLengthMeters } from './paintedLine'
import {
  cleanStroke,
  isPoorFix,
  isRealStep,
  isRoughFix,
  paintingStop,
  strokeHow,
  strokeMarginMeters,
  type PaintedFix,
} from './paintedTrack'
import type { PaintedLineDraft } from './paintedMap'

/** Why the painting is not reading the phone right now. */
export type WalkPause = 'press' | 'hidden' | 'standing' | 'time'

export type WalkState = {
  status: 'painting' | 'paused'
  pausedWhy: WalkPause | null
  /** The strokes already closed, each the readings kept for it. */
  strokes: PaintedFix[][]
  /** The stroke being painted. */
  current: PaintedFix[]
  /** The newest reading, kept or not: where the person is drawn. */
  last: PaintedFix | null
  /** The newest reading was a rough location: Precise Location is off, and nothing can be painted from it. */
  rough: boolean
  startedAtMs: number
  /** The time spent painting, pauses left out, up to the last event. */
  paintedMs: number
  /** When painting last began or began again. */
  resumedAtMs: number
  lastStepAtMs: number
  /** When the page left the screen, while that is where it is. */
  hiddenAtMs: number | null
  /** How long the screen was off, once it is back: the words for the gap. */
  gapMs: number | null
}

/** A reading older than this when it arrives is the phone's memory, not where the person is now. */
export const WALK_STALE_FIX_MS = 10_000
/** A kept walk nobody saved is thrown away after a day. */
export const WALK_KEEP_MS = 24 * 60 * 60_000

export function startWalk(nowMs: number): WalkState {
  return { status: 'painting', pausedWhy: null, strokes: [], current: [], last: null, rough: false, startedAtMs: nowMs, paintedMs: 0, resumedAtMs: nowMs, lastStepAtMs: nowMs, hiddenAtMs: null, gapMs: null }
}

/** The stroke is closed and put with the others. One reading alone is not a stroke, and is dropped. */
function closeStroke(state: WalkState): PaintedFix[][] {
  return state.current.length >= 2 ? [...state.strokes, state.current] : state.strokes
}

function pause(state: WalkState, why: WalkPause, nowMs: number): WalkState {
  if (state.status === 'paused') return state
  return {
    ...state,
    status: 'paused',
    pausedWhy: why,
    strokes: closeStroke(state),
    current: [],
    paintedMs: state.paintedMs + Math.max(0, nowMs - state.resumedAtMs),
    hiddenAtMs: why === 'hidden' ? nowMs : null,
    gapMs: null,
  }
}

/** A reading came off the phone. */
export function walkFix(state: WalkState, fix: PaintedFix, nowMs: number): WalkState {
  if (state.status !== 'painting') return state
  if (nowMs - fix.atMs > WALK_STALE_FIX_MS) return state
  if (isRoughFix(fix.accuracyM)) return { ...state, last: fix, rough: true }
  const lastKept = state.current[state.current.length - 1] ?? null
  if (!isRealStep(lastKept, fix)) return { ...state, last: fix, rough: false }
  return { ...state, last: fix, rough: false, current: [...state.current, fix], lastStepAtMs: nowMs }
}

/** The person pressed Pause. */
export const walkPause = (state: WalkState, nowMs: number): WalkState => pause(state, 'press', nowMs)

/** The page left the screen: the phone locked, a call came, another app is in front. */
export const walkHidden = (state: WalkState, nowMs: number): WalkState => pause(state, 'hidden', nowMs)

/** The page is back on the screen. The painting stays paused, and now knows how long it was away. */
export function walkShown(state: WalkState, nowMs: number): WalkState {
  if (state.pausedWhy !== 'hidden' || state.hiddenAtMs == null) return state
  return { ...state, gapMs: Math.max(0, nowMs - state.hiddenAtMs), hiddenAtMs: null }
}

/** A second went by. Painting stops by itself when the person has stood still or the hour is up. */
export function walkTick(state: WalkState, nowMs: number): WalkState {
  if (state.status !== 'painting') return state
  const stop = paintingStop({ startedAtMs: nowMs - walkPaintedMs(state, nowMs), lastStepAtMs: state.lastStepAtMs, nowMs })
  if (stop === 'time') return pause(state, 'time', nowMs)
  if (stop === 'standing') return pause(state, 'standing', nowMs)
  return state
}

/** May the painting start again? Not once the hour is up: that walk is to be looked over and saved. */
export const canResumeWalk = (state: WalkState): boolean => state.status === 'paused' && state.pausedWhy !== 'time'

/**
 * Painting starts again. `join` takes the last stroke up where it stopped, so the first new reading
 * draws a straight leg across the gap. Without it the next reading starts a new stroke.
 */
export function walkResume(state: WalkState, join: boolean, nowMs: number): WalkState {
  if (!canResumeWalk(state)) return state
  const lastStroke = state.strokes[state.strokes.length - 1]
  const joined = join && lastStroke !== undefined
  return {
    ...state,
    status: 'painting',
    pausedWhy: null,
    strokes: joined ? state.strokes.slice(0, -1) : state.strokes,
    current: joined ? lastStroke : [],
    resumedAtMs: nowMs,
    lastStepAtMs: nowMs,
    hiddenAtMs: null,
    gapMs: null,
  }
}

/** The time spent painting so far, pauses left out: the clock on the bar. */
export function walkPaintedMs(state: WalkState, nowMs: number): number {
  return state.paintedMs + (state.status === 'painting' ? Math.max(0, nowMs - state.resumedAtMs) : 0)
}

/** How sure the phone is right now: the margin of its newest reading, and whether that is too wide to draw as read. */
export function walkSure(state: WalkState): { accuracyM: number | null; poor: boolean } {
  const accuracyM = state.last?.accuracyM ?? null
  return { accuracyM, poor: isPoorFix(accuracyM) }
}

/** A stroke as the map draws it while it is being painted, and as it will be saved. */
export type WalkStroke = PaintedLineDraft & { lengthM: number }

/** One stroke made ready: straightened, its unsure parts marked, walked or driven told from its speed. */
function strokeOf(fixes: ReadonlyArray<PaintedFix>): WalkStroke | null {
  const clean = cleanStroke(fixes)
  if (clean.points.length < 2) return null
  const how = strokeHow(fixes)
  const lengthM = lineLengthMeters(clean.points, clean.poorParts)
  return {
    how,
    points: clean.points,
    poorParts: clean.poorParts,
    fixedByHand: false,
    marginM: strokeMarginMeters({ how, lengthM, startAccuracyM: clean.startAccuracyM, endAccuracyM: clean.endAccuracyM }),
    lengthM,
  }
}

/**
 * Every stroke of the walk as a shape: the closed ones and the one being painted. This is what the
 * map draws, what Look it over shows and what a save writes. No reading's time is in it.
 */
export function walkStrokes(state: WalkState): WalkStroke[] {
  return [...state.strokes, state.current].map(strokeOf).filter((s): s is WalkStroke => s !== null)
}

/** The walk's length so far in metres, its unsure parts left out. */
export const walkLengthMeters = (state: WalkState): number => walkStrokes(state).reduce((sum, s) => sum + s.lengthM, 0)

/** Is there anything to look over? */
export const walkHasLine = (state: WalkState): boolean => walkStrokes(state).length > 0

/**
 * A walk as it is kept on the phone between a reload and the next open, with what the screen that
 * owns it needs to open again (`map`). `state` is null once the walk was looked over: the lines
 * waiting to be saved are the screen's to keep.
 */
export type KeptWalk<M> = { savedAtMs: number; map: M; state: WalkState | null }

/**
 * A kept walk read back, or null when there is none worth offering: nothing kept, something that is
 * not a walk, or a walk more than a day old. A walk that was painting when the page went away comes
 * back paused, as a hidden page: it has a gap, and the person says what happens next.
 */
export function readKeptWalk<M>(raw: string | null | undefined, nowMs: number): KeptWalk<M> | null {
  if (!raw) return null
  try {
    const kept = JSON.parse(raw) as Partial<KeptWalk<M>> | null
    if (!kept || typeof kept.savedAtMs !== 'number' || !kept.map) return null
    if (nowMs - kept.savedAtMs > WALK_KEEP_MS) return null
    const state = kept.state
    if (!state) return { savedAtMs: kept.savedAtMs, map: kept.map, state: null }
    if (!Array.isArray(state.strokes) || !Array.isArray(state.current)) return null
    if (state.status !== 'painting' && state.status !== 'paused') return null
    const back: WalkState = state.status === 'painting' ? { ...pause(state, 'hidden', kept.savedAtMs), hiddenAtMs: null, gapMs: Math.max(0, nowMs - kept.savedAtMs) } : state
    return { savedAtMs: kept.savedAtMs, map: kept.map, state: back }
  } catch {
    return null
  }
}

/** The key a person's kept walk is stored under. One walk at a time, a person. */
export const keptWalkKey = (userId: string): string => `pipetooling-painted-walk:${userId}`
