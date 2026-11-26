/**
 * The job form's question about a place (punch list #439, piece 2, its last part). An address being typed may be
 * written differently from one on file and still sit at the same spot on the map: a unit, a building, a barn
 * beside the house. Words alone cannot say whether that is one place. So once the map has a point for the typed
 * address, the form asks, once: **Same place, use that spelling**, **Same place, keep mine** or **Not the same**.
 *
 * It asks about exactly the pairs the list of look-alikes would show after the job is saved, by the same reach:
 * 75 m for two addresses written alike, 40 m for different words, and never at a point four or more addresses
 * share, which is a town's or a road's centre. An answer kept here is the list's answer, in the same table, so
 * the pair is not asked again there.
 *
 * Pure: no React, no supabase. The reads and the write are `hooks/useSameSpotOnFile.ts`.
 */
import { normalizeAddressKey } from '../developments/notInIt'
import { val } from '../valuesInPlace'
import { onFileCountWords, type AddressOnFile } from './addressesOnFile'
import {
  PILE_OF_ADDRESSES,
  SAME_SPOT_ALIKE_METERS,
  SAME_SPOT_DIFFERENT_METERS,
  mapPointKey,
  metersBetween,
  pairId,
  samePlaceKeys,
  writtenAlike,
  type MapPoint,
  type PlaceAnswer,
} from './lookAlikes'

/** One address on file the typed one may be the same place as, and how far apart the map puts them. */
export type SameSpotOnFile = { entry: AddressOnFile; meters: number }

/**
 * Half the side of the box of map points the form reads around the typed address, in degrees. A thousandth of a
 * degree is about 111 m north to south and never less than 85 m east to west below 40° of latitude, so the box
 * holds every point within the longer reach.
 */
export const SAME_SPOT_BOX_DEGREES = 0.001

/** Who may keep an answer: the office, the roles the answers' table lets write (`is_office_staff`). */
export const PLACE_ANSWER_ROLES: readonly string[] = ['dev', 'master_technician', 'assistant', 'controller']

/** True for a role that may answer, so the form asks only someone whose answer would be kept. */
export function mayAnswerPlace(role: string | null | undefined): boolean {
  return role != null && PLACE_ANSWER_ROLES.includes(role)
}

const finite = (p: MapPoint | null | undefined): p is MapPoint => p != null && Number.isFinite(p.lat) && Number.isFinite(p.lng)
const spot = (p: MapPoint): string => `${p.lat},${p.lng}`
const used = (a: AddressOnFile): number => a.jobs + a.bids

/**
 * The addresses on file to ask about for a typed address with its map point, the nearest first. Nothing when the
 * typed address is on file itself, has no point, or sits on a point four or more addresses share.
 * A pair already answered either way is left out, and so is an address the answers already join to the typed one.
 * `points` is the map's own cache around the typed point, a point under each address as written. `skipKeys` are
 * cleaned keys the form has already asked about another way.
 */
export function sameSpotOnFile(
  list: ReadonlyArray<AddressOnFile>,
  typed: string,
  typedPoint: MapPoint | null,
  points: ReadonlyMap<string, MapPoint>,
  answers: ReadonlyArray<PlaceAnswer>,
  skipKeys: ReadonlySet<string> = new Set(),
): SameSpotOnFile[] {
  const key = normalizeAddressKey(typed)
  if (!key || !finite(typedPoint) || list.some((a) => a.key === key)) return []

  const pointOf = new Map<string, MapPoint>()
  for (const entry of list) {
    for (const spelling of entry.spellings) {
      const p = points.get(mapPointKey(spelling))
      if (finite(p)) {
        pointOf.set(entry.key, p)
        break
      }
    }
  }
  // The typed address counts at its own point, as it will once the job is saved.
  const sharers = new Map<string, number>([[spot(typedPoint), 1]])
  for (const p of pointOf.values()) sharers.set(spot(p), (sharers.get(spot(p)) ?? 0) + 1)
  if ((sharers.get(spot(typedPoint)) ?? 0) >= PILE_OF_ADDRESSES) return []

  const answered = new Set(answers.map((a) => pairId(a.keyA, a.keyB)))
  const joined = samePlaceKeys(key, answers)
  const out: SameSpotOnFile[] = []
  for (const entry of list) {
    const p = pointOf.get(entry.key)
    if (!p || (sharers.get(spot(p)) ?? 0) >= PILE_OF_ADDRESSES) continue
    if (skipKeys.has(entry.key) || joined.has(entry.key) || answered.has(pairId(key, entry.key))) continue
    const meters = metersBetween(typedPoint, p)
    const reach = writtenAlike(key, entry.key) ? SAME_SPOT_ALIKE_METERS : SAME_SPOT_DIFFERENT_METERS
    if (meters <= reach) out.push({ entry, meters: Math.round(meters) })
  }
  return out.sort((a, b) => a.meters - b.meters || used(b.entry) - used(a.entry) || a.entry.address.localeCompare(b.entry.address))
}

/**
 * The addresses on file the answers already make one place with a typed address that is not on file itself, the
 * busiest first. What the quiet line under the box names after **Same place, keep mine**.
 */
export function samePlaceOnFile(list: ReadonlyArray<AddressOnFile>, typed: string, answers: ReadonlyArray<PlaceAnswer>): AddressOnFile[] {
  const key = normalizeAddressKey(typed)
  if (!key || list.some((a) => a.key === key)) return []
  const joined = samePlaceKeys(key, answers)
  if (joined.size < 2) return []
  return list.filter((a) => joined.has(a.key)).sort((a, b) => used(b) - used(a) || a.address.localeCompare(b.address))
}

/** The words of the question under the box. */
export const SAME_SPOT_WORDS = {
  title: 'Is this the same place?',
  use: 'Same place, use that spelling',
  keep: 'Same place, keep mine',
  notSame: 'Not the same',
  foot: 'Your answer is kept, so nobody is asked again. It changes no other address.',
} as const

/** `at this spot`, or `30 m from here`: where the address on file is, read from the typed one. */
function whereWords(meters: number): string {
  return meters < 1 ? 'at this spot' : `${Math.round(meters)} m from here`
}

/** The line of the question: `3 jobs are on file at this spot as 412 Sample Canyon Dr Building 20.` */
export function sameSpotSentence(found: SameSpotOnFile): string {
  const many = used(found.entry) !== 1
  return `${val('count', onFileCountWords(found.entry))} ${many ? 'are' : 'is'} on file ${whereWords(found.meters)} as ${val('address', found.entry.address)}.`
}

/** The quiet line once the answers join the typed address to one on file: `Kept as the same place as …. 3 jobs are there.` */
export function samePlaceSentence(entry: AddressOnFile): string {
  const many = used(entry) !== 1
  return `Kept as the same place as ${val('address', entry.address)}. ${val('count', onFileCountWords(entry))} ${many ? 'are' : 'is'} there.`
}
