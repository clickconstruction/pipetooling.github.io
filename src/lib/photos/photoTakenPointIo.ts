/**
 * Where a photo was taken (punch list #413, step 3): the read of one photo's point from its own
 * row. The lists of photos read a view that does not carry the point, so the point is read here,
 * by id, when a photo is opened. Row security decides who reads it: whoever reads the photo's row.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import { supabase } from '../supabase'
import { takenPointFromRow, type TakenPoint } from '../paintedMap/paintedSpot'

const db = supabase as unknown as SupabaseClient

/** The photo sources whose rows keep a point. */
export type PhotoPointSource = 'job' | 'report'

const TABLE: Record<PhotoPointSource, string> = { job: 'job_photo_notes', report: 'report_photos' }

/** A photo's point, or null: it has none, the row cannot be read, or the read failed. Never an error to show. */
export async function loadPhotoTakenPoint(source: PhotoPointSource, id: string): Promise<TakenPoint | null> {
  try {
    const { data, error } = await db.from(TABLE[source]).select('taken_lat, taken_lng, taken_accuracy_m').eq('id', id).maybeSingle()
    if (error) return null
    return takenPointFromRow(data as { taken_lat?: number | null; taken_lng?: number | null; taken_accuracy_m?: number | null } | null)
  } catch {
    return null
  }
}
