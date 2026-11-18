/**
 * A job's own list of places (punch list #393, reading C): points of interest kept on the job and
 * not on one painted map, such as the gate, the meter or an open trench. The list sits under the
 * job's address with its painted maps, and every painted map of the job draws its places.
 *
 * Pure: words, letters and which maps are lists. No map, no network, no React.
 *
 * The rules the screens lean on:
 * - The list is kept as a painted map that holds places only and is marked `jobList`. So a place
 *   on it has everything a place has, and nothing here is a second kind of place.
 * - The table holds a job to no count of lists, since a job that goes leaves its maps standing and
 *   two jobs can be combined. So a job may have two. The app writes to the oldest and reads every
 *   one as one list.
 * - A place on the job wears a letter, and a map's own place wears a number, so the two are never
 *   taken for each other on a map that shows both. A letter is the place's own across every map:
 *   it is its turn in the whole list, oldest first.
 * - A link or a copy of a painted map carries that map's own places and not the job's. The job's
 *   list has a link, a picture and a page of its own.
 */
import { numberedPlaces, type PaintedMap, type PaintedPlace } from './paintedMap'

/** Every word of the list, in one spot: what it is called is the owner's to change (the card's call 1). */
export const JOB_LIST_WORDS = {
  /** The list's name, as stored on its map and as its window and its line read. */
  name: 'Places on this job',
  /** The press under a job's address. */
  add: '＋ Place on this job',
  /** Under the list's own map. */
  onEvery: 'These are on every painted map of this job.',
  /** A list with nothing on it yet. */
  none: 'Nothing is kept on this job yet. Press ＋ Place to set the first place.',
  /** The heading over the job's places on one of its painted maps. */
  heading: 'On this job',
  /** Under those rows: where they are changed, and what a link carries. */
  kept: 'These are kept on the job, so they are on every map of it.',
  open: 'Open Places on this job',
  notOnALink: 'A link or a copy of this map does not carry them. To send them, share Places on this job itself.',
  throwAway: { title: 'Throw this list away?', body: 'Every place kept on this job goes for everyone, with its photo. This cannot be undone.', confirm: 'Throw the list away', cancel: 'Cancel', press: 'Throw this list away' },
} as const

/** `3 places`, `1 place`: what the line under a job's address says of its list. */
export function jobListCountWords(count: number): string {
  return `${count} place${count === 1 ? '' : 's'}`
}

/** The letter a place on the job wears, by its turn in the list: A to Z, then AA, AB, as a spreadsheet's columns go. */
export function placeLetter(turn: number): string {
  let n = Math.max(1, Math.floor(turn))
  let out = ''
  while (n > 0) {
    const r = (n - 1) % 26
    out = String.fromCharCode(65 + r) + out
    n = Math.floor((n - 1) / 26)
  }
  return out
}

/** A job's lists among some maps, the oldest first. The first is the one the app writes to. */
export function jobListsOf<T extends Pick<PaintedMap, 'id' | 'jobId' | 'jobList' | 'createdAt'>>(maps: ReadonlyArray<T>, jobId: string | null | undefined): T[] {
  if (!jobId) return []
  return maps
    .filter((m) => m.jobList === true && m.jobId === jobId)
    .slice()
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id))
}

export type JobPlace = PaintedPlace & { number: number; letter: string }

/**
 * Every place of a job's lists as one list, each with its letter. The order is the order they
 * were set in, across every list, so a letter never moves when another place is added.
 */
export function jobListPlaces(lists: ReadonlyArray<{ places: ReadonlyArray<PaintedPlace> }>): JobPlace[] {
  return numberedPlaces(lists.flatMap((l) => l.places)).map((p) => ({ ...p, letter: placeLetter(p.number) }))
}
