/**
 * Field photos → Drive: the count reaches the mark, with an age (punch list #180, PR 5). The station
 * read the right thing, the estimates still holding field photos in app storage, but its count sat
 * inside the strip, which is collapsed when the round marks it, so 35 marks in eight weeks saved a
 * look and nothing else, and no row said how long its photos had sat. The page now reports the count
 * from a hook beside the wrapper; this kernel gives each estimate its age (the oldest photo's day),
 * the ones past the limit, the Next line, the since-last-look line and the Mark's note. Pure.
 */

/** A photo past this many days in storage reads red: the owner's number to start. */
export const FIELD_PHOTOS_LIMIT_DAYS = 7

export type PhotoGroupLike = { estimateId: string; label: string; oldestAt: string; photos: ReadonlyArray<unknown> }

export type PhotoAgeRow<G extends PhotoGroupLike = PhotoGroupLike> = { group: G; ageDays: number; past: boolean }

const DAY_MS = 86_400_000

export function ageDaysOf(iso: string, nowIso: string): number {
  const a = Date.parse(iso)
  const b = Date.parse(nowIso)
  if (!Number.isFinite(a) || !Number.isFinite(b)) return 0
  return Math.max(0, Math.floor((b - a) / DAY_MS))
}

/** One row per estimate in the groups' order (oldest first), each with its days in storage. */
export function fieldPhotoAgeRows<G extends PhotoGroupLike>(groups: ReadonlyArray<G>, nowIso: string, limitDays = FIELD_PHOTOS_LIMIT_DAYS): PhotoAgeRow<G>[] {
  return groups.map((group) => {
    const ageDays = ageDaysOf(group.oldestAt, nowIso)
    return { group, ageDays, past: ageDays > limitDays }
  })
}

export type FieldPhotosCounts = { estimates: number; photos: number; past: number; oldestDays: number | null }

export function fieldPhotosCounts(rows: ReadonlyArray<PhotoAgeRow>): FieldPhotosCounts {
  let photos = 0
  let past = 0
  let oldest: number | null = null
  for (const r of rows) {
    photos += r.group.photos.length
    if (r.past) past++
    if (oldest == null || r.ageDays > oldest) oldest = r.ageDays
  }
  return { estimates: rows.length, photos, past, oldestDays: oldest }
}

function plural(n: number, one: string, many: string): string {
  return n === 1 ? one : many
}

/** The oldest estimate still holding photos and the verb. Null when none does. */
export function fieldPhotosAgedNextLine(rows: ReadonlyArray<PhotoAgeRow>): string | null {
  const r = rows[0]
  if (!r) return null
  const n = r.group.photos.length
  return `Move ${n} ${plural(n, 'photo', 'photos')} for ${r.group.label} to Drive · ${r.ageDays} ${plural(r.ageDays, 'day', 'days')} in storage`
}

export type FieldPhotosSince = { newSince: number; movedSince: number; stillSince: number; words: string }

/**
 * What moved since the last look: estimates whose first photo landed after the mark, estimates whose photos
 * were moved to Drive since (the hand-over rows), and the ones that sat through it. Null without a last look.
 */
export function fieldPhotosSince(rows: ReadonlyArray<PhotoAgeRow>, handovers: ReadonlyArray<{ moved_at: string }>, sinceIso: string | null, whenWords: (iso: string) => string): FieldPhotosSince | null {
  if (!sinceIso) return null
  let newSince = 0
  let stillSince = 0
  for (const r of rows) {
    if (r.group.oldestAt > sinceIso) newSince++
    else stillSince++
  }
  const movedSince = handovers.filter((h) => h.moved_at > sinceIso).length
  return { newSince, movedSince, stillSince, words: `Since the last look, ${whenWords(sinceIso)}` }
}

/** What the Mark saves when nobody typed. "0 estimates holding photos" at zero, so the history shows the clean day. */
export function fieldPhotosMarkNote(rows: ReadonlyArray<PhotoAgeRow>, limitDays: number, since: FieldPhotosSince | null): string {
  const c = fieldPhotosCounts(rows)
  const parts = [`${c.estimates} ${plural(c.estimates, 'estimate', 'estimates')} holding photos`]
  if (c.estimates > 0) {
    parts.push(`${c.photos} ${plural(c.photos, 'photo', 'photos')}`)
    const first = rows[0]!
    parts.push(`oldest ${first.ageDays}d (${first.group.label})`, `${c.past} past ${limitDays} days`)
  }
  if (since) parts.push(`+${since.newSince} new, ${since.movedSince} moved to Drive since the last look`)
  return parts.join(' · ')
}
