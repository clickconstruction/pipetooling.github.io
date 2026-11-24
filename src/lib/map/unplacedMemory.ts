/**
 * The words and the press behind an address the map cannot place (punch list #408, step 3). Pure.
 *
 * Step 2 made the app remember such an address, so no screen asks about it again until its days are
 * up. This is what a person reads about it: the day it was last checked and the day the app asks
 * again by itself, the door from a card's count line to the Map page's list, and what **Try again**
 * found. **Try again** asks the map services past the memory (`retry: true`), once, for one address.
 */
import { calendarYmdInAppTzFromIso } from '../../utils/dateUtils'
import { val } from '../valuesInPlace'
import { geocodeMissAsksAgainAt } from '../../../supabase/functions/_shared/geocodeMissMemory'
import { mapGeocodeErrorMessage } from './geocodeErrorMessage'

/** The Map page opens its list of records it cannot place when its address carries this. */
export const UNPLACED_DOOR_PARAM = 'unplaced'

/** Where a card's *N jobs have no map location yet* line goes: the Map page, with the list open. */
export const UNPLACED_DOOR_PATH = `/map?${UNPLACED_DOOR_PARAM}=1`

/** The door's hint, for the cards that carry it. */
export const UNPLACED_DOOR_TITLE = 'Open the list on the Map page: why each one could not be placed, and Try again'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/** A stamp as a short day in the app's zone: *Nov 20*, with the year when it is not `nowIso`'s. '' when unreadable. */
export function missDayWords(iso: string | null | undefined, nowIso: string): string {
  const ymd = iso ? calendarYmdInAppTzFromIso(iso) : ''
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd)
  if (!m) return ''
  const day = `${MONTHS[Number(m[2]) - 1] ?? ''} ${Number(m[3])}`
  return calendarYmdInAppTzFromIso(nowIso).slice(0, 4) === m[1] ? day : `${day}, ${m[1]}`
}

/**
 * *Checked ⟪Nov 20⟫. The app asks again by itself on ⟪Dec 20⟫.* Each day is marked as a value, so the
 * sheet draws it apart from the words. '' when the day it was checked is unknown: a miss nobody kept.
 */
export function missCheckedSentence(checkedAt: string | null | undefined, nowIso: string): string {
  const checked = missDayWords(checkedAt, nowIso)
  if (!checked) return ''
  const again = missDayWords(geocodeMissAsksAgainAt(checkedAt)?.toISOString(), nowIso)
  return again ? `Checked ${val('day', checked)}. The app asks again by itself on ${val('day', again)}.` : `Checked ${val('day', checked)}.`
}

/** What one **Try again** found. */
export type TryAgainOutcome =
  /** A service placed it: the point is saved and the map reloads. */
  | { kind: 'placed' }
  /** Not placed. `checkedAt` is the day the function kept the miss again; null when it kept nothing. */
  | { kind: 'missed'; reason: string; checkedAt: string | null }
  /** The ask itself failed: no signal, a refusal, an answer nobody can read. */
  | { kind: 'failed'; reason: string }

type BatchAnswer = {
  results?: Array<{ address_normalized?: unknown }>
  failures?: Array<{ address_normalized?: unknown; error_code?: unknown; detail?: unknown; checked_at?: unknown }>
}

/**
 * Reads `geocode-address-batch`'s answer for the one address asked. A failure that carries
 * `checked_at` is a miss the function kept again, on that day (v2.8484). One without it kept nothing:
 * Google or the Census did not answer, or the write was refused, as it is for a training account.
 */
export function tryAgainOutcome(data: unknown, addressKey: string): TryAgainOutcome {
  const answer = (data && typeof data === 'object' ? data : {}) as BatchAnswer
  const results = Array.isArray(answer.results) ? answer.results : []
  if (results.some((r) => r?.address_normalized === addressKey)) return { kind: 'placed' }
  const failures = Array.isArray(answer.failures) ? answer.failures : []
  const f = failures.find((x) => x?.address_normalized === addressKey)
  if (!f || typeof f.error_code !== 'string') return { kind: 'failed', reason: 'The map services sent no answer for this address.' }
  const reason = mapGeocodeErrorMessage(f.error_code, typeof f.detail === 'string' ? f.detail : undefined)
  const kept = typeof f.checked_at === 'string' && Number.isFinite(Date.parse(f.checked_at)) ? f.checked_at : null
  return { kind: 'missed', reason, checkedAt: kept }
}

/** The words under the row after a **Try again**. The row's own line carries the new day. */
export function tryAgainWords(outcome: TryAgainOutcome): string {
  switch (outcome.kind) {
    case 'placed':
      return 'Placed. The map is reloading with it.'
    case 'missed':
      return outcome.checkedAt
        ? 'Still no match. Open the record and fix the address to place it.'
        : `Not placed. Nothing was kept, so the app asks again on the next open. ${outcome.reason}`
    case 'failed':
      return `Could not ask the map services. ${outcome.reason}`
  }
}

/** After the list's *Nothing waiting on an address.* when nothing is left to fix: what that good state means. */
export const UNPLACED_NOTHING_TAIL = 'Every record with an address is on the map, and none is far from the office.'
