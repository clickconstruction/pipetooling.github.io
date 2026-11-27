/**
 * Throwing a painted map away, and the copy a test map keeps (punch list #443, row 15).
 *
 * **Throw this map away** deletes the map's row from the client. Its lines, places, links and link opens go with it
 * by their keys, and the client then sweeps the map's photos out of the bucket. Nothing kept a copy, so a map a walk
 * threw away was gone for good. `throw_away_test_painted_map` is the one door that keeps one: for a developer, on a
 * test map, it copies the map whole into the deleted-records archive and then deletes it, and Recently deleted
 * (Settings, Data & recovery) puts it back. This is the rule for which door a press takes, and the words of the door
 * that keeps a copy. Pure: the call is `paintedMapIo.ts` (`throwAwayTestPaintedMap`), the press is in
 * `components/paintedMap/PaintedMapWindow.tsx`.
 *
 * - The copy is kept for a dev and for nobody else. View as a sample account is that account, so it takes today's door.
 * - Only a test map keeps one: its name starts with ZZ (`isZzTestName`), the one mark a map carries.
 * - A job's own list of places stays on today's door. The app gives it a fixed name, so it is never a test map by name.
 * - Everyone else, and a dev on a real map, get today's delete and today's words, untouched.
 * - The door that keeps a copy leaves the photos in the bucket, so a place put back still finds its photo.
 * - There is no fall back. When the function refuses, the map stays and the refusal is shown as its own sentence: a
 *   fall back to today's delete would sweep the photos the confirm said stay.
 */
import { isZzTestName } from '../../../supabase/functions/_shared/zzTestJob'
import { pluralNoun } from '../batchWords'

/** Which door a throw-away takes: `copy` keeps a copy through the function, `plain` is today's delete. */
export type PaintedMapThrowAwayDoor = 'copy' | 'plain'

/** The door for this person and this map. A dev on a test map that is not a job's list keeps a copy. */
export function paintedMapThrowAwayDoor(role: string | null | undefined, map: { name: string | null | undefined; jobList?: boolean } | null | undefined): PaintedMapThrowAwayDoor {
  if (role !== 'dev' || !map || map.jobList === true) return 'plain'
  return isZzTestName(map.name) ? 'copy' : 'plain'
}

/** How long Recently deleted keeps a copy: the archive's own purge (`20260716120000_deleted_records_archive.sql`). */
export const PAINTED_MAP_COPY_KEPT_DAYS = 90

/** The confirm of the door that keeps a copy. The button names the act. */
export const PAINTED_MAP_TEST_THROW_AWAY = {
  title: 'Throw this test map away?',
  body: `The map, its lines and its places go for everyone. A developer can put this test map back from Recently deleted for ${PAINTED_MAP_COPY_KEPT_DAYS} days. Its photos stay. A task that carries this map keeps itself and loses the map. So does a place on Materials on site. Putting the map back does not put it back on them.`,
  confirm: 'Throw the test map away',
  cancel: 'Cancel',
} as const

/** What the function said went: the rows it copied, and what carried the map and lost it. */
export type PaintedMapThrownAway = { copied: number; tasks: number; places: number }

function count(value: unknown): number {
  const n = Number(value)
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0
}

/** The function's answer, read: `{ ok: true, total, carriers }`. Null for anything else, so no answer is never a yes. */
export function paintedMapThrownAwayFrom(answer: unknown): PaintedMapThrownAway | null {
  if (!answer || typeof answer !== 'object' || Array.isArray(answer)) return null
  const a = answer as Record<string, unknown>
  if (a.ok !== true) return null
  const carriers = a.carriers && typeof a.carriers === 'object' && !Array.isArray(a.carriers) ? (a.carriers as Record<string, unknown>) : {}
  return { copied: count(a.total), tasks: count(carriers.checklist_items) + count(carriers.checklist_tech_tree_group_tasks), places: count(carriers.job_places) }
}

/** What the screen says once the map is gone: where its copy is, and what lost the map, with the counts the function answered. */
export function paintedMapThrownAwayWords(gone: PaintedMapThrownAway): string {
  const kept = `The test map was thrown away. A developer can put it back from Recently deleted for ${PAINTED_MAP_COPY_KEPT_DAYS} days.`
  const lost: string[] = []
  if (gone.tasks > 0) lost.push(`${gone.tasks} ${pluralNoun('task', gone.tasks)}`)
  if (gone.places > 0) lost.push(`${gone.places} ${pluralNoun('place', gone.places)} on Materials on site`)
  return lost.length > 0 ? `${kept} ${lost.join(' and ')} lost the map.` : kept
}

/** What the screen says when the function answered nothing it can read. The map may or may not be gone, so it says to look. */
export const PAINTED_MAP_THROW_AWAY_NO_ANSWER = 'The database gave no answer. Open the map again to see if it is still there.'
