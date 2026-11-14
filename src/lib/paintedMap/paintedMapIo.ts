/**
 * Reads and writes for painted maps (punch list #345). The tables are younger than the generated
 * types; the types PR after the push removes the casts. Every write answers with what landed or
 * with the reason in words (`formatErrorMessage`), so a refusal names itself on the screen.
 */
import { supabase } from '../supabase'
import { formatErrorMessage } from '../../utils/errorHandling'
import {
  PAINTED_MAP_LINE_SELECT,
  PAINTED_MAP_NAME_MAX,
  PAINTED_MAP_PLACE_SELECT,
  PAINTED_MAP_SELECT,
  PAINTED_MAP_UNNAMED,
  PAINTED_MAP_WORDS_MAX,
  cleanPaintedText,
  paintedLineColumns,
  paintedLineFromRow,
  paintedMapFromRow,
  paintedPlaceColumns,
  paintedPlaceFromRow,
  type PaintedLine,
  type PaintedLineDraft,
  type PaintedMap,
  type PaintedMapLineRow,
  type PaintedMapPlaceRow,
  type PaintedMapRow,
  type PaintedMeasuredHow,
  type PaintedPlace,
} from './paintedMap'
import type { PaintedPoint } from './paintedLine'
import type { PaintedMapSearchRow } from './paintedMapSearch'
import { PAINTED_MAP_PHOTOS_BUCKET, isPaintedPlacePhotoPath, paintedPlacePhotoPath } from './paintedPlacePhoto'

const MAPS = 'painted_maps' as never
const LINES = 'painted_map_lines' as never
const PLACES = 'painted_map_places' as never

type Rows<T> = { data: T[] | null; error: { message: string } | null }
type OneRow<T> = { data: T | null; error: { message: string } | null }

/** A map with everything on it. */
export type PaintedMapWhole = { map: PaintedMap; lines: PaintedLine[]; places: PaintedPlace[] }
export type Landed<T> = { ok: true; value: T } | { ok: false; error: string }

const fail = <T>(e: unknown, fallback: string): Landed<T> => ({ ok: false, error: formatErrorMessage(e, fallback) })

/** The lines and places of some maps, sorted onto them. A line or a place that cannot be read is left off, never guessed at. */
async function fillMaps(maps: PaintedMap[]): Promise<PaintedMapWhole[]> {
  if (maps.length === 0) return []
  const ids = maps.map((m) => m.id)
  const [lineRes, placeRes] = (await Promise.all([
    supabase.from(LINES).select(PAINTED_MAP_LINE_SELECT as '*').in('map_id' as never, ids).order('made_at' as never, { ascending: true }),
    supabase.from(PLACES).select(PAINTED_MAP_PLACE_SELECT as '*').in('map_id' as never, ids).order('set_at' as never, { ascending: true }),
  ])) as unknown as [Rows<PaintedMapLineRow>, Rows<PaintedMapPlaceRow>]
  if (lineRes.error) throw lineRes.error
  if (placeRes.error) throw placeRes.error
  const lines = (lineRes.data ?? []).map(paintedLineFromRow).filter((l): l is PaintedLine => l !== null)
  const places = (placeRes.data ?? []).map(paintedPlaceFromRow).filter((p): p is PaintedPlace => p !== null)
  return maps.map((map) => ({ map, lines: lines.filter((l) => l.mapId === map.id), places: places.filter((p) => p.mapId === map.id) }))
}

/**
 * The maps a job shows: its own and its development's. One read of the maps, then one each of
 * their lines and places. Row security decides what comes back, so a caller who cannot open the
 * job gets an empty list and no error.
 */
export async function loadPaintedMapsFor(home: { jobId?: string | null; developmentId?: string | null; /** A development's lots: their own maps are read with the site's. */ jobIds?: ReadonlyArray<string> }): Promise<Landed<PaintedMapWhole[]>> {
  const filters: string[] = []
  if (home.jobId) filters.push(`job_id.eq.${home.jobId}`)
  if (home.developmentId) filters.push(`development_id.eq.${home.developmentId}`)
  const lots = [...new Set((home.jobIds ?? []).filter(Boolean))]
  if (lots.length > 0) filters.push(`job_id.in.(${lots.join(',')})`)
  if (filters.length === 0) return { ok: true, value: [] }
  try {
    const res = (await supabase
      .from(MAPS)
      .select(PAINTED_MAP_SELECT as '*')
      .or(filters.join(','))
      .order('created_at' as never, { ascending: false })) as unknown as Rows<PaintedMapRow>
    if (res.error) return fail(res.error, 'The painted maps did not load.')
    return { ok: true, value: await fillMaps((res.data ?? []).map(paintedMapFromRow)) }
  } catch (e) {
    return fail(e, 'The painted maps did not load.')
  }
}

/** The most painted maps the header's search holds. Past it the newest are searched, and the count says so nowhere: a company with more has a list problem this box is not for. */
export const PAINTED_MAP_SEARCH_MAX = 400

/**
 * Every painted map the caller can read, for the header's search, each with its home in words where
 * the caller can read the home. A helper cannot read the ledger, so a job's name is simply left
 * out for them. An empty list when the read fails: the search box must never break on this.
 */
export async function loadPaintedMapsForSearch(): Promise<PaintedMapSearchRow[]> {
  try {
    const res = (await supabase
      .from(MAPS)
      .select('id, name, words, job_id, development_id' as '*')
      .order('created_at' as never, { ascending: false })
      .limit(PAINTED_MAP_SEARCH_MAX)) as unknown as Rows<{ id: string; name: string; words: string | null; job_id: string | null; development_id: string | null }>
    const rows = res.error ? [] : (res.data ?? [])
    if (rows.length === 0) return []
    const jobIds = [...new Set(rows.map((r) => r.job_id).filter((id): id is string => !!id))]
    const siteIds = [...new Set(rows.map((r) => r.development_id).filter((id): id is string => !!id))]
    const [jobs, sites] = await Promise.all([
      jobIds.length > 0 ? supabase.from('jobs_ledger').select('id, hcp_number, job_name').in('id', jobIds) : Promise.resolve({ data: [] }),
      siteIds.length > 0 ? supabase.from('developments' as never).select('id, name' as '*').in('id' as never, siteIds) : Promise.resolve({ data: [] }),
    ])
    const jobLabel = new Map(((jobs.data ?? []) as Array<{ id: string; hcp_number: string | null; job_name: string | null }>).map((j) => [j.id, [j.hcp_number, j.job_name].filter(Boolean).join(' · ')] as const))
    const siteLabel = new Map(((sites.data ?? []) as unknown as Array<{ id: string; name: string | null }>).map((d) => [d.id, d.name ?? ''] as const))
    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      words: r.words ?? '',
      jobLabel: (r.job_id && jobLabel.get(r.job_id)) || null,
      developmentLabel: (r.development_id && siteLabel.get(r.development_id)) || null,
      hasHome: !!(r.job_id || r.development_id),
    }))
  } catch {
    return []
  }
}

/** Put a map that is on no job onto one. Its maker's and the office's, and they must be able to open the job. */
export async function putPaintedMapOnJob(mapId: string, jobId: string): Promise<Landed<PaintedMap>> {
  try {
    const res = (await supabase
      .from(MAPS)
      .update({ job_id: jobId, development_id: null } as never)
      .eq('id' as never, mapId)
      .select(PAINTED_MAP_SELECT as '*')
      .single()) as unknown as OneRow<PaintedMapRow>
    if (res.error || !res.data) return fail(res.error, 'The map was not put on the job. Only whoever painted a map, or the office, may move it, and only onto a job they can open.')
    return { ok: true, value: paintedMapFromRow(res.data) }
  } catch (e) {
    return fail(e, 'The map was not put on the job.')
  }
}

/** One map with everything on it, or null when it is gone or not the caller's to read. */
export async function loadPaintedMap(mapId: string): Promise<Landed<PaintedMapWhole | null>> {
  try {
    const res = (await supabase.from(MAPS).select(PAINTED_MAP_SELECT as '*').eq('id' as never, mapId).limit(1)) as unknown as Rows<PaintedMapRow>
    if (res.error) return fail(res.error, 'The painted map did not load.')
    const row = res.data?.[0]
    if (!row) return { ok: true, value: null }
    const [whole] = await fillMaps([paintedMapFromRow(row)])
    return { ok: true, value: whole ?? null }
  } catch (e) {
    return fail(e, 'The painted map did not load.')
  }
}

/** Makes a map. Its id is the caller's, so a line drawn before the save can be written straight after it. */
export async function createPaintedMap(input: { id: string; name: string; words?: string; jobId?: string | null; developmentId?: string | null; by: string }): Promise<Landed<PaintedMap>> {
  try {
    const res = (await supabase
      .from(MAPS)
      .insert({
        id: input.id,
        name: cleanPaintedText(input.name, PAINTED_MAP_NAME_MAX) || PAINTED_MAP_UNNAMED,
        words: cleanPaintedText(input.words, PAINTED_MAP_WORDS_MAX),
        job_id: input.jobId ?? null,
        // A map has one home. A job's own map names the job, and the development shows it through its jobs.
        development_id: input.jobId ? null : (input.developmentId ?? null),
        created_by: input.by,
      } as never)
      .select(PAINTED_MAP_SELECT as '*')
      .single()) as unknown as OneRow<PaintedMapRow>
    if (res.error || !res.data) return fail(res.error, 'The map did not save.')
    return { ok: true, value: paintedMapFromRow(res.data) }
  } catch (e) {
    return fail(e, 'The map did not save.')
  }
}

/** Renames a map or changes the line of words under its name. */
export async function savePaintedMapWords(mapId: string, input: { name: string; words: string }): Promise<Landed<PaintedMap>> {
  try {
    const res = (await supabase
      .from(MAPS)
      .update({ name: cleanPaintedText(input.name, PAINTED_MAP_NAME_MAX) || PAINTED_MAP_UNNAMED, words: cleanPaintedText(input.words, PAINTED_MAP_WORDS_MAX) } as never)
      .eq('id' as never, mapId)
      .select(PAINTED_MAP_SELECT as '*')
      .single()) as unknown as OneRow<PaintedMapRow>
    if (res.error || !res.data) return fail(res.error, 'The name did not save. Only whoever painted a map, or the office, may rename it.')
    return { ok: true, value: paintedMapFromRow(res.data) }
  } catch (e) {
    return fail(e, 'The name did not save.')
  }
}

/** Throws a map away, its lines and places with it. `false` when nothing went: it was not the caller's to remove. */
export async function deletePaintedMap(mapId: string): Promise<Landed<boolean>> {
  try {
    const res = (await supabase.from(MAPS).delete().eq('id' as never, mapId).select('id' as '*')) as unknown as Rows<{ id: string }>
    if (res.error) return fail(res.error, 'The map was not removed.')
    return { ok: true, value: (res.data ?? []).length > 0 }
  } catch (e) {
    return fail(e, 'The map was not removed.')
  }
}

/** Adds a stroke to a map. */
export async function addPaintedLine(mapId: string, draft: PaintedLineDraft, by: string): Promise<Landed<PaintedLine>> {
  const columns = paintedLineColumns(draft, mapId, by)
  if (!columns) return { ok: false, error: 'A line needs two points or more.' }
  try {
    const res = (await supabase.from(LINES).insert(columns as never).select(PAINTED_MAP_LINE_SELECT as '*').single()) as unknown as OneRow<PaintedMapLineRow>
    const line = res.data ? paintedLineFromRow(res.data) : null
    if (res.error || !line) return fail(res.error, 'The line did not save.')
    return { ok: true, value: line }
  } catch (e) {
    return fail(e, 'The line did not save.')
  }
}

/** Saves a line's shape again after it was moved by hand: its points, its faint parts, and the length that goes with them. */
export async function savePaintedLineShape(line: Pick<PaintedLine, 'id' | 'mapId'>, draft: PaintedLineDraft, by: string): Promise<Landed<PaintedLine>> {
  const columns = paintedLineColumns(draft, line.mapId, by)
  if (!columns) return { ok: false, error: 'A line needs two points or more.' }
  // Who made the line and which map it is on do not change with its shape.
  const { map_id: _map, made_by: _by, ...shape } = columns
  void _map
  void _by
  try {
    const res = (await supabase.from(LINES).update(shape as never).eq('id' as never, line.id).select(PAINTED_MAP_LINE_SELECT as '*').single()) as unknown as OneRow<PaintedMapLineRow>
    const saved = res.data ? paintedLineFromRow(res.data) : null
    if (res.error || !saved) return fail(res.error, 'The line did not save. Only whoever made a line, or the office, may change it.')
    return { ok: true, value: saved }
  } catch (e) {
    return fail(e, 'The line did not save.')
  }
}

/** Types a measured length onto a line, or takes it off with `null`. The two columns go together, as the table asks. */
export async function savePaintedLineMeasure(lineId: string, measured: { feet: number; how: PaintedMeasuredHow } | null): Promise<Landed<PaintedLine>> {
  try {
    const res = (await supabase
      .from(LINES)
      .update({ measured_ft: measured ? measured.feet : null, measured_how: measured ? measured.how : null } as never)
      .eq('id' as never, lineId)
      .select(PAINTED_MAP_LINE_SELECT as '*')
      .single()) as unknown as OneRow<PaintedMapLineRow>
    const saved = res.data ? paintedLineFromRow(res.data) : null
    if (res.error || !saved) return fail(res.error, 'The length did not save. Only whoever made a line, or the office, may change it.')
    return { ok: true, value: saved }
  } catch (e) {
    return fail(e, 'The length did not save.')
  }
}

/** Removes a line. `false` when nothing went: it was not the caller's to remove. */
export async function deletePaintedLine(lineId: string): Promise<Landed<boolean>> {
  try {
    const res = (await supabase.from(LINES).delete().eq('id' as never, lineId).select('id' as '*')) as unknown as Rows<{ id: string }>
    if (res.error) return fail(res.error, 'The line was not removed.')
    return { ok: true, value: (res.data ?? []).length > 0 }
  } catch (e) {
    return fail(e, 'The line was not removed.')
  }
}

/** Adds a place to a map. */
export async function addPaintedPlace(
  mapId: string,
  place: PaintedPoint & { id?: string; name?: string | null; words?: string | null; accuracyM?: number | null; photoPath?: string | null },
  by: string,
): Promise<Landed<PaintedPlace>> {
  const columns = paintedPlaceColumns(place, mapId, by)
  if (!columns) return { ok: false, error: 'A place needs a point on the map.' }
  try {
    const res = (await supabase
      .from(PLACES)
      .insert((place.id ? { id: place.id, ...columns } : columns) as never)
      .select(PAINTED_MAP_PLACE_SELECT as '*')
      .single()) as unknown as OneRow<PaintedMapPlaceRow>
    const saved = res.data ? paintedPlaceFromRow(res.data) : null
    if (res.error || !saved) return fail(res.error, 'The place did not save.')
    return { ok: true, value: saved }
  } catch (e) {
    return fail(e, 'The place did not save.')
  }
}

/** Changes a place: its name, its words, its dot or its photo. A dot moved by hand loses the phone's margin. */
export async function savePaintedPlace(
  placeId: string,
  change: Partial<{ name: string; words: string; lat: number; lng: number; accuracyM: number | null; photoPath: string | null }>,
): Promise<Landed<PaintedPlace>> {
  const cols: Record<string, unknown> = {}
  if (change.name !== undefined) cols.name = change.name
  if (change.words !== undefined) cols.words = change.words
  if (change.lat !== undefined && change.lng !== undefined) {
    cols.lat = change.lat
    cols.lng = change.lng
    cols.accuracy_m = change.accuracyM ?? null
  }
  if (change.photoPath !== undefined) cols.photo_path = change.photoPath
  try {
    const res = (await supabase.from(PLACES).update(cols as never).eq('id' as never, placeId).select(PAINTED_MAP_PLACE_SELECT as '*').single()) as unknown as OneRow<PaintedMapPlaceRow>
    const saved = res.data ? paintedPlaceFromRow(res.data) : null
    if (res.error || !saved) return fail(res.error, 'The place did not save. Only whoever set a place, or the office, may change it.')
    return { ok: true, value: saved }
  } catch (e) {
    return fail(e, 'The place did not save.')
  }
}

/** Removes a place. `false` when nothing went: it was not the caller's to remove. */
export async function deletePaintedPlace(placeId: string): Promise<Landed<boolean>> {
  try {
    const res = (await supabase.from(PLACES).delete().eq('id' as never, placeId).select('id' as '*')) as unknown as Rows<{ id: string }>
    if (res.error) return fail(res.error, 'The place was not removed.')
    return { ok: true, value: (res.data ?? []).length > 0 }
  } catch (e) {
    return fail(e, 'The place was not removed.')
  }
}

/** The names of the people on a map, by id: who painted it, who made each line, who set each place. */
export async function loadPainterNames(ids: ReadonlyArray<string | null | undefined>): Promise<Map<string, string>> {
  const out = new Map<string, string>()
  const list = [...new Set(ids.filter((id): id is string => !!id))]
  if (list.length === 0) return out
  try {
    const res = (await supabase.from('users').select('id,name').in('id', list)) as unknown as Rows<{ id: string; name: string | null }>
    for (const row of res.data ?? []) if (row.name) out.set(row.id, row.name)
  } catch {
    // A map reads without its names.
  }
  return out
}

/** Puts a place's shrunk picture in the bucket under its map. The path on success, the reason in words on failure. */
export async function uploadPaintedPlacePhoto(mapId: string, photoId: string, blob: Blob): Promise<Landed<string>> {
  const path = paintedPlacePhotoPath(mapId, photoId)
  try {
    const { error } = await supabase.storage.from(PAINTED_MAP_PHOTOS_BUCKET).upload(path, blob, { contentType: 'image/jpeg', upsert: false })
    return error ? fail(error, 'The photo did not upload.') : { ok: true, value: path }
  } catch (e) {
    return fail(e, 'The photo did not upload.')
  }
}

/** Takes a picture out of the bucket. Best effort: a file left behind is only a file, no place points at it. */
export async function removePaintedPlacePhotoFile(path: string | null | undefined): Promise<void> {
  if (!isPaintedPlacePhotoPath(path)) return
  try {
    await supabase.storage.from(PAINTED_MAP_PHOTOS_BUCKET).remove([path])
  } catch {
    // Left behind.
  }
}

/** Signed addresses for the pictures, an hour each. A path that will not sign is simply absent, and the place stands. */
export async function paintedPlacePhotoUrls(paths: ReadonlyArray<string | null | undefined>): Promise<Map<string, string>> {
  const list = [...new Set(paths.filter((p): p is string => isPaintedPlacePhotoPath(p)))]
  const out = new Map<string, string>()
  if (list.length === 0) return out
  try {
    const { data } = await supabase.storage.from(PAINTED_MAP_PHOTOS_BUCKET).createSignedUrls(list, 3600)
    for (const r of (data ?? []) as Array<{ path: string | null; signedUrl: string | null }>) {
      if (r.path && r.signedUrl) out.set(r.path, r.signedUrl)
    }
  } catch {
    // No picture; the place stands.
  }
  return out
}

