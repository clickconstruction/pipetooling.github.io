/**
 * The way to a place, written (punch list #372, step 4): one column on the place, through the table's own update
 * policy (`job_places_update`, v2.7580), which the guard holds to that column and to a map of the place's own job or
 * its development. Then the job is read again, so every screen draws the way. Needs signal: it follows the save of a
 * painted map, which needs it too.
 */
import { supabase } from '../supabase'
import { loadJob } from './onSiteStore'

export async function setPlaceWay(jobId: string, placeId: string, mapId: string | null): Promise<void> {
  const { error } = await supabase.from('job_places').update({ painted_map_id: mapId } as never).eq('id', placeId)
  if (error) throw error
  await loadJob(jobId, { force: true })
}
