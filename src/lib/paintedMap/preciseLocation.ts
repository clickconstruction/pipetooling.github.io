/**
 * Is Precise Location on? A page is never told: no browser hands the switch to a website. What a
 * page does get is each reading's margin, and the margin gives the switch away at both ends.
 *
 * - A phone told to give only a rough area hands back the middle of a region a mile or more
 *   across. Apple writes 1 to 20 km for an iPhone, and Android will not go under 200 m. So a margin
 *   at or under 100 m can only come from a phone giving its exact position: the switch is on.
 * - A margin over 1,000 m is that rough area, or a phone with the switch on that can hear a cell
 *   tower and nothing else. The two cannot be told apart from one reading, so the page waits a few
 *   seconds for a better one before it says anything, and then says *looks off*, never *is off*.
 * - Between the two the switch is not the trouble. The signal is.
 *
 * Pure: words and thresholds. The screens are `PreciseLocationLine` and the shared map at `/way`.
 */
import { taskPlaceAccuracyWords } from '../tasks/taskPlace'
import { PAINT_POOR_FIX_METERS, PAINT_ROUGH_FIX_METERS, PAINT_USUAL_FIX_METERS } from './paintedTrack'

/** At or under this, only a phone giving its exact position can be the source: about 330 ft. */
export const PRECISE_PROVEN_METERS = 100
/** A rough reading is called rough only once it has lasted this long with nothing better: a first reading off a cell tower is rough too. */
export const PRECISE_ROUGH_HOLD_MS = 4000
/** From here a margin is worded in miles: half a mile. */
const MILES_FROM_METERS = 804.672
const METERS_PER_MILE = 1609.344

const hasMargin = (m: number | null | undefined): m is number => typeof m === 'number' && Number.isFinite(m) && m >= 0

/**
 * `finding`: no reading yet, or a rough one too new to judge. `on`: sure enough to paint from.
 * `weak`: the phone knows where it is but not well. `rough`: the phone is handing back an area.
 */
export type PreciseState = 'finding' | 'on' | 'weak' | 'rough'

/** What one reading says, with how long the readings have been rough (`null` or 0 for the first). */
export function preciseStateOf(accuracyM: number | null | undefined, roughForMs: number | null = PRECISE_ROUGH_HOLD_MS): PreciseState {
  if (!hasMargin(accuracyM)) return 'finding'
  if (accuracyM > PAINT_ROUGH_FIX_METERS) return (roughForMs ?? 0) >= PRECISE_ROUGH_HOLD_MS ? 'rough' : 'finding'
  return accuracyM > PAINT_POOR_FIX_METERS ? 'weak' : 'on'
}

/** Does this margin prove the switch is on? Only a tight one does. */
export const provesPrecise = (accuracyM: number | null | undefined): boolean => hasMargin(accuracyM) && accuracyM <= PRECISE_PROVEN_METERS

/**
 * `within 15 ft`, `within 1,500 ft`, `within 2 miles`. Feet up to half a mile, then whole miles.
 * Rounded up, so the words never claim more than the phone did. Null when the phone gave no margin.
 */
export function marginWords(accuracyM: number | null | undefined): string | null {
  if (!hasMargin(accuracyM)) return null
  if (accuracyM < MILES_FROM_METERS) return taskPlaceAccuracyWords(accuracyM)
  const miles = Math.max(1, Math.ceil(accuracyM / METERS_PER_MILE))
  return `within ${miles.toLocaleString('en-US')} mile${miles === 1 ? '' : 's'}`
}

/** How wide the rough area is across: `4 miles across`. The picture on the map is this circle. */
export function areaAcrossWords(accuracyM: number | null | undefined): string | null {
  if (!hasMargin(accuracyM)) return null
  const miles = Math.max(1, Math.ceil((accuracyM * 2) / METERS_PER_MILE))
  return `${miles.toLocaleString('en-US')} mile${miles === 1 ? '' : 's'} across`
}

/** What a phone is usually sure of under open sky with the switch on: the other number, beside the live one. */
export const USUAL_MARGIN_WORDS = taskPlaceAccuracyWords(PAINT_USUAL_FIX_METERS) ?? 'within 20 ft'

/** The way the page was opened, as far as the steps to the switch differ. */
export type PhoneKind = 'iphone-safari' | 'iphone-home' | 'iphone-chrome' | 'iphone-other' | 'android' | 'other'

/**
 * Which phone and which browser, from what the browser says of itself. `standalone` is a page
 * opened from its own icon on the Home Screen. An iPad that calls itself a Mac is told by its touch
 * screen. Anything not known is `other`, and gets both sets of steps.
 */
export function phoneKindOf(input: { userAgent: string; standalone?: boolean; touchPoints?: number }): PhoneKind {
  const ua = input.userAgent || ''
  const apple = /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && (input.touchPoints ?? 0) > 1)
  if (apple) {
    if (/CriOS/.test(ua)) return 'iphone-chrome'
    if (/FxiOS|EdgiOS|OPiOS|DuckDuckGo|GSA\//.test(ua)) return 'iphone-other'
    return input.standalone ? 'iphone-home' : 'iphone-safari'
  }
  if (/Android/.test(ua)) return 'android'
  return 'other'
}

/** The switch by the name the phone gives it. */
export const preciseSwitchName = (kind: PhoneKind): string => (kind === 'android' ? 'Use precise location' : 'Precise Location')

/**
 * The steps to the switch, for this phone alone where the page can tell which it is. Each is one
 * press. The last line is for a phone whose switch was already on: a rough reading with the switch
 * on means the phone can hear a cell tower and nothing else.
 */
export function preciseSteps(kind: PhoneKind): string[] {
  const iphone = (row: string) => ['Open the Settings app.', 'Tap Privacy & Security, then Location Services.', `Tap ${row}.`, 'Turn on Precise Location.', 'Come back to this screen.']
  if (kind === 'iphone-safari' || kind === 'iphone-home') return iphone('Safari Websites')
  if (kind === 'iphone-chrome') return iphone('Chrome')
  if (kind === 'iphone-other') return iphone('the browser you are using')
  const android = ['Press and hold the browser’s icon, then tap App info.', 'Tap Permissions, then Location.', 'Turn on Use precise location.', 'Come back to this screen.']
  if (kind === 'android') return android
  return ['iPhone: Settings, Privacy & Security, Location Services, Safari Websites. Turn on Precise Location.', 'Android: hold the browser’s icon, App info, Permissions, Location. Turn on Use precise location.']
}

/** Under the steps: the case where the switch was on all along. */
export const PRECISE_ALREADY_ON_WORDS = 'Already on? Step into the open and wait a moment. The phone may only be hearing a cell tower.'

export type PreciseWords = {
  state: PreciseState
  /** The line a glance takes in. */
  lead: string
  /** What follows it, or null. */
  tail: string | null
}

/**
 * The status line: one sentence that says how the phone is doing, in every state.
 *   `Precise Location is on.` · `Sure within 15 ft.`
 *   `Weak signal here.` · `Your phone is only sure within 120 ft.`
 *   `Precise Location looks off.` · `Your phone is only sure within 2 miles. With it on, a phone is usually sure within 20 ft.`
 * On a device that is not a phone the switch is not named: a desk has none.
 */
export function preciseWords(accuracyM: number | null | undefined, kind: PhoneKind, roughForMs: number | null = PRECISE_ROUGH_HOLD_MS): PreciseWords {
  const state = preciseStateOf(accuracyM, roughForMs)
  const sure = marginWords(accuracyM)
  const name = preciseSwitchName(kind) === 'Use precise location' ? 'Precise location' : 'Precise Location'
  const phone = kind !== 'other'
  if (state === 'finding') return { state, lead: 'Finding you…', tail: 'This takes a few seconds in the open.' }
  if (state === 'on') return { state, lead: phone ? `${name} is on.` : 'Found you.', tail: `Sure ${sure}.` }
  if (state === 'weak') {
    const lead = phone && provesPrecise(accuracyM) ? `${name} is on, but the signal is weak here.` : 'The signal is weak here.'
    return { state, lead, tail: `Your phone is only sure ${sure}.` }
  }
  return {
    state,
    lead: phone ? `${name} looks off.` : 'This device only knows the area it is in.',
    tail: phone ? `Your phone is only sure ${sure}. With it on, a phone is usually sure ${USUAL_MARGIN_WORDS}.` : `It is only sure ${sure}.`,
  }
}

/**
 * The shared map's words for a reader whose phone gives an area. A stranger reads these, so the
 * switch is named only here, where it is the thing to press. `Your phone is only giving the area you are in.`
 */
export function wayRoughWords(accuracyM: number | null | undefined, kind: PhoneKind): { lead: string; tail: string; ask: string } {
  const sure = marginWords(accuracyM)
  return {
    lead: 'Your phone is only giving the area you are in.',
    tail: sure ? `It is only sure ${sure}, so the map cannot show where you stand.` : 'So the map cannot show where you stand.',
    ask: `To see where you stand, turn on ${preciseSwitchName(kind)}:`,
  }
}

/** The phone's two numbers side by side: what it is sure of now, and what a phone is usually sure of with the switch on. */
export function roughCompareWords(accuracyM: number | null | undefined): { now: string; withItOn: string } | null {
  const now = marginWords(accuracyM)
  return now ? { now, withItOn: USUAL_MARGIN_WORDS } : null
}

/** Over the map while the reading is rough: what the blue circle is. */
export function roughCircleWords(accuracyM: number | null | undefined): string | null {
  const across = areaAcrossWords(accuracyM)
  return across ? `You are somewhere in this circle, ${across}.` : null
}
