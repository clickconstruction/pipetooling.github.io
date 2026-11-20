/**
 * Is Precise Location on? (punch list #402) A page is never told: no browser hands the switch to a
 * website. What a page does get is each reading's margin, and the margin gives the switch away at
 * both ends.
 *
 * - A phone told to give only a rough area hands back the middle of a region a mile or more across.
 *   Apple writes 1 to 20 km for an iPhone, and Android will not go under 200 m. So a margin at or
 *   under 100 m can only come from a phone giving its exact position: the switch is on.
 * - A margin over 1,000 m is that rough area, or a phone with the switch on that can hear a cell
 *   tower and nothing else. One reading cannot tell the two apart. So a screen that follows the
 *   phone waits 4 seconds for a better reading before it says anything, and then it says *looks
 *   off*, never *is off*.
 * - Between the two the switch is not the trouble. The signal is.
 *
 * Pure: thresholds and words. No browser and no clock. A screen that follows the phone counts the
 * 4 seconds itself and hands the answer in as `roughHeld`. A screen that asks once, on a press, has
 * nothing to wait for and hands in `true`.
 *
 * What each screen does about a weak or a rough reading is that screen's own sentence, kept with the
 * screen. The one exception is the shared map at `/way`, whose reader is a stranger: its words are
 * here, because they are the same line said to someone who was never told what the switch is.
 */
import { METERS_PER_MILE } from '../map/mapCanvasTypes'
import { taskPlaceAccuracyWords } from '../tasks/taskPlace'
import { PAINT_USUAL_FIX_METERS, isPoorFix, isRoughFix } from './paintedTrack'

/** At or under this, only a phone giving its exact position can be the source: about 330 ft. */
export const PRECISE_PROVEN_METERS = 100
/** The readings must stay rough this long before a screen says so: a first reading off a cell tower is rough too. */
export const PRECISE_ROUGH_HOLD_MS = 4000
/** From here a margin is worded in miles: half a mile. */
const MILES_FROM_METERS = METERS_PER_MILE / 2

const hasMargin = (m: number | null | undefined): m is number => typeof m === 'number' && Number.isFinite(m) && m >= 0

/**
 * `finding`: no reading yet, or a rough one the screen is still waiting on. `on`: sure enough to
 * paint from. `weak`: the phone knows where it is, but not well. `rough`: the phone is handing back
 * an area, and has been for the whole wait.
 */
export type PreciseState = 'finding' | 'on' | 'weak' | 'rough'

/**
 * What one reading says. The edges are `paintedTrack.ts`'s own: over 20 m is weak and over 1,000 m
 * is rough, so a reading of exactly 20 m is sure and one of exactly 1,000 m is only weak. A rough
 * reading counts as rough once `roughHeld`, and reads as still finding until then.
 */
export function preciseStateOf(accuracyM: number | null | undefined, roughHeld: boolean): PreciseState {
  if (!hasMargin(accuracyM)) return 'finding'
  if (isRoughFix(accuracyM)) return roughHeld ? 'rough' : 'finding'
  return isPoorFix(accuracyM) ? 'weak' : 'on'
}

/** Does this margin prove the switch is on? Only a tight one does: no rough area is this small. */
export const provesPrecise = (accuracyM: number | null | undefined): boolean => hasMargin(accuracyM) && accuracyM <= PRECISE_PROVEN_METERS

/** `within 15 ft` under half a mile, `within 2 miles` from there. Rounded up either way. */
function withinWords(meters: number): string {
  const feet = meters < MILES_FROM_METERS ? taskPlaceAccuracyWords(meters) : null
  if (feet) return feet
  const miles = Math.max(1, Math.ceil(meters / METERS_PER_MILE))
  return `within ${miles.toLocaleString('en-US')} mile${miles === 1 ? '' : 's'}`
}

/**
 * `within 15 ft`, `within 2,640 ft`, `within 2 miles`: feet up to half a mile, the way
 * `taskPlaceAccuracyWords` words them, then whole miles. Rounded up, so the words never claim more
 * than the phone did. Null when the phone gave no margin.
 */
export function marginWords(accuracyM: number | null | undefined): string | null {
  return hasMargin(accuracyM) ? withinWords(accuracyM) : null
}

/** What a phone is usually sure of under open sky with the switch on: the other number, beside the live one. */
export const USUAL_MARGIN_WORDS = withinWords(PAINT_USUAL_FIX_METERS)

/**
 * How wide a rough area is from side to side: `4 miles across`. Rounded up. Null for a reading that
 * is not rough, whose circle is a margin around a spot and not an area to stand somewhere in.
 */
export function areaAcrossWords(accuracyM: number | null | undefined): string | null {
  if (!hasMargin(accuracyM) || !isRoughFix(accuracyM)) return null
  // A rough margin is over 1,000 m, so the area is over a mile and a quarter across: never one mile.
  return `${Math.ceil((accuracyM * 2) / METERS_PER_MILE).toLocaleString('en-US')} miles across`
}

/** Over the map while the reading is rough: what the dashed circle is. */
export function roughCircleWords(accuracyM: number | null | undefined): string | null {
  const across = areaAcrossWords(accuracyM)
  return across ? `You are somewhere in this circle, ${across}.` : null
}

/** The way the page was opened, as far as the steps to the switch differ. */
export type PhoneKind = 'iphone-safari' | 'iphone-home' | 'iphone-chrome' | 'iphone-other' | 'android' | 'other'

/** Every kind, for a screen or a test that walks them all. */
export const PHONE_KINDS: ReadonlyArray<PhoneKind> = ['iphone-safari', 'iphone-home', 'iphone-chrome', 'iphone-other', 'android', 'other']

/**
 * Which phone and which browser, from what the browser says of itself. `standalone` is a page
 * opened from its own icon on the Home Screen. An iPad that calls itself a Mac is told by its touch
 * screen, and reads as an iPhone here: its switch is in the same place.
 *
 * On an iPhone every browser is asked by name, since each has its own row in Location Services. A
 * page inside another app's own window does not call itself Safari, and is `iphone-other` with the
 * browsers that are named. A desk, or a phone the page cannot tell, is `other` and gets one line
 * for each kind of phone.
 */
export function phoneKindOf(input: { userAgent: string; standalone?: boolean; touchPoints?: number }): PhoneKind {
  const ua = input.userAgent || ''
  const apple = /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && (input.touchPoints ?? 0) > 1)
  if (apple) {
    if (/CriOS/.test(ua)) return 'iphone-chrome'
    if (/FxiOS|EdgiOS|OPiOS|OPT\/|DuckDuckGo|GSA\//.test(ua)) return 'iphone-other'
    if (input.standalone) return 'iphone-home'
    return /Safari\//.test(ua) ? 'iphone-safari' : 'iphone-other'
  }
  if (/Android/.test(ua)) return 'android'
  return 'other'
}

/** The switch by the name the phone's settings give it. Null where the page cannot tell the phone, or there is none. */
export function preciseSwitchName(kind: PhoneKind): string | null {
  if (kind === 'other') return null
  return kind === 'android' ? 'Use precise location' : 'Precise Location'
}

/** The thing the switch turns on, as a sentence names it: Android writes it with a small l. */
function preciseName(kind: PhoneKind): string | null {
  if (kind === 'other') return null
  return kind === 'android' ? 'Precise location' : 'Precise Location'
}

/**
 * The steps to the switch, for this phone alone where the page can tell which it is. Each is one
 * press, said as a command, and the last brings the person back. A desk, or a phone the page cannot
 * tell, gets one line for each kind of phone.
 */
export function preciseSteps(kind: PhoneKind): string[] {
  const iphone = (row: string) => ['Open the Settings app.', 'Tap Privacy & Security, then Location Services.', `Tap ${row}.`, 'Turn on Precise Location.', 'Come back to this screen.']
  if (kind === 'iphone-safari' || kind === 'iphone-home') return iphone('Safari Websites')
  if (kind === 'iphone-chrome') return iphone('Chrome')
  if (kind === 'iphone-other') return iphone('the browser you are using')
  if (kind === 'android') return ['Press and hold the browser’s icon, then tap App info.', 'Tap Permissions, then Location.', 'Turn on Use precise location.', 'Come back to this screen.']
  return [
    'iPhone: Settings, Privacy & Security, Location Services, Safari Websites. Turn on Precise Location.',
    'Android: hold the browser’s icon, App info, Permissions, Location. Turn on Use precise location.',
  ]
}

/** The one press the steps sit behind, on a sheet whose map needs the room they would take. */
export const PRECISE_STEPS_FOLD_WORDS = 'Show the steps'

/** Under the steps: the case where the switch was on all along. A rough reading with the switch on means the phone can hear a cell tower and nothing else. */
export const PRECISE_ALREADY_ON_WORDS = 'Already on? Step into the open and wait a moment. The phone may only be hearing a cell tower.'

export type PreciseWords = {
  state: PreciseState
  /** The sentence a glance takes in. */
  lead: string
  /** What follows it. Null on a phone whose switch looks off, where the two numbers side by side say it (`roughCompareWords`). */
  tail: string | null
}

/**
 * The status line: how the phone is doing, in every state.
 *   `Finding you…` · `This takes a few seconds in the open.`
 *   `Precise Location is on.` · `Sure within 15 ft.`
 *   `Precise Location is on, but the signal is weak here.` · `Your phone is only sure within 120 ft.`
 *   `The signal is weak here.` · `Your phone is only sure within 990 ft.`
 *   `Precise Location looks off.`
 * The switch is called on only by a margin that proves it, and never called off: *looks off* is all
 * a page can know. Where the page cannot tell the phone the switch is not named at all, since a
 * desk has none: `Found you.` and `This device only knows the area it is in.`
 */
export function preciseWords(accuracyM: number | null | undefined, kind: PhoneKind, roughHeld: boolean): PreciseWords {
  const state = preciseStateOf(accuracyM, roughHeld)
  const sure = marginWords(accuracyM)
  const name = preciseName(kind)
  const whose = name ? 'Your phone' : 'This device'
  if (state === 'finding' || !sure) return { state: 'finding', lead: 'Finding you…', tail: 'This takes a few seconds in the open.' }
  if (state === 'on') return { state, lead: name ? `${name} is on.` : 'Found you.', tail: `Sure ${sure}.` }
  if (state === 'weak') {
    const lead = name && provesPrecise(accuracyM) ? `${name} is on, but the signal is weak here.` : 'The signal is weak here.'
    return { state, lead, tail: `${whose} is only sure ${sure}.` }
  }
  if (name) return { state, lead: `${name} looks off.`, tail: null }
  return { state, lead: 'This device only knows the area it is in.', tail: `It is only sure ${sure}.` }
}

/**
 * The phone's two numbers side by side, for a rough reading: what it is sure of now, and what a
 * phone is usually sure of with the switch on. Null where no switch is named, and for a reading
 * that is not rough: a weak signal is not the switch's doing, so nothing is set beside it.
 */
export function roughCompareWords(accuracyM: number | null | undefined, kind: PhoneKind): { nowLabel: string; now: string; onLabel: string; on: string } | null {
  const name = preciseSwitchName(kind)
  const now = marginWords(accuracyM)
  if (!name || !now || !isRoughFix(accuracyM)) return null
  return { nowLabel: 'Your phone now', now, onLabel: `With ${name} on`, on: USUAL_MARGIN_WORDS }
}

/**
 * The shared map's words for a reader whose signal is weak. A stranger reads these, so the switch
 * is not named: it is not the trouble, and they were never told what it is.
 */
export function wayWeakWords(accuracyM: number | null | undefined, kind: PhoneKind): { lead: string; tail: string | null } {
  const sure = marginWords(accuracyM)
  const whose = kind === 'other' ? 'This device' : 'Your phone'
  return { lead: 'The signal is weak here.', tail: sure ? `${whose} is only sure ${sure}.` : null }
}

/**
 * The shared map's words for a reader whose phone gives an area. The switch is named here and
 * nowhere else on that page, because here it is the thing to press. `ask` ends on a colon: the
 * steps follow it.
 */
export function wayRoughWords(accuracyM: number | null | undefined, kind: PhoneKind): { lead: string; tail: string; ask: string } {
  const sure = marginWords(accuracyM)
  const name = preciseSwitchName(kind)
  return {
    lead: name ? 'Your phone is only giving the area you are in.' : 'This device only knows the area it is in.',
    tail: sure ? `It is only sure ${sure}, so the map cannot show where you stand.` : 'The map cannot show where you stand.',
    ask: name ? `To see where you stand, turn on ${name}:` : 'To see where you stand, turn on precise location on your phone:',
  }
}
