/**
 * A development's photos (punch list #247, PR 1): the reads behind the Development page's Photos look. Two reads of
 * the `uploaded_photos` view scoped to the site's jobs and bids: the census (three columns of every row, for the
 * strip's count, *this week* and the job picker) and the row (whole rows, newest first, a page at a time, narrowed
 * to a job or a source on the server). The thumbnails and the full pictures come the way Documents → Photos draws
 * them, through `uploadedPhotosIo` and its queue, so a site with a thousand photos never bursts the gateway. Browser
 * io, not pure; the rules are `sitePhotos.ts`.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import { supabase } from '../supabase'
import { formatErrorMessage } from '../../utils/errorHandling'
import { UPLOADED_PHOTOS_SELECT, type UploadedPhotoRow } from './uploadedPhotos'
import { uploadedPhotoFull, uploadedPhotoThumb, type UploadedPhotosIo } from './uploadedPhotosIo'
import { SITE_PHOTOS_CENSUS_CAP, SITE_PHOTOS_CENSUS_SELECT, SITE_PHOTOS_PAGE, siteFilter, type SitePhotoCensusRow, type SitePhotosQuery } from './sitePhotos'

const db = supabase as unknown as SupabaseClient

export type SitePhotosRead = { rows: UploadedPhotoRow[]; more: boolean }

/** The row's page: the site's photos newest first, `limit` of them; `more` says another page may follow. Throws with the reason. */
export async function loadSitePhotos(query: SitePhotosQuery): Promise<SitePhotosRead> {
  const site = siteFilter(query.jobIds, query.bidIds)
  if (!site) return { rows: [], more: false }
  const limit = Math.max(1, query.limit || SITE_PHOTOS_PAGE)
  let q = db.from('uploaded_photos').select(UPLOADED_PHOTOS_SELECT).or(site)
  if (query.jobId) q = q.or(`job_id.eq.${query.jobId},bid_id.eq.${query.jobId}`)
  if (query.source !== 'all') q = q.eq('source', query.source)
  const { data, error } = await q.order('taken_at', { ascending: false }).order('id', { ascending: false }).limit(limit)
  if (error) throw new Error(formatErrorMessage(error, 'The site’s photos did not read.'))
  const rows = (data ?? []) as UploadedPhotoRow[]
  return { rows, more: rows.length >= limit }
}

/** The census: three columns of every photo on the site, up to the cap. Throws with the reason. */
export async function loadSitePhotoCensus(jobIds: ReadonlyArray<string>, bidIds: ReadonlyArray<string>): Promise<SitePhotoCensusRow[]> {
  const site = siteFilter(jobIds, bidIds)
  if (!site) return []
  const { data, error } = await db.from('uploaded_photos').select(SITE_PHOTOS_CENSUS_SELECT).or(site).order('taken_at', { ascending: false }).limit(SITE_PHOTOS_CENSUS_CAP)
  if (error) throw new Error(formatErrorMessage(error, 'The site’s photo count did not read.'))
  return (data ?? []) as SitePhotoCensusRow[]
}

export interface SitePhotosIo {
  list: (query: SitePhotosQuery) => Promise<SitePhotosRead>
  census: (jobIds: ReadonlyArray<string>, bidIds: ReadonlyArray<string>) => Promise<SitePhotoCensusRow[]>
  /** The tiles' and the viewer's bytes, the Photos tab's own two paths. */
  photos: UploadedPhotosIo
}

export function supabaseSitePhotosIo(): SitePhotosIo {
  return {
    list: loadSitePhotos,
    census: loadSitePhotoCensus,
    photos: {
      list: () => Promise.reject(new Error('The site reads its own list.')),
      waiting: () => Promise.resolve(null),
      thumb: uploadedPhotoThumb,
      full: uploadedPhotoFull,
    },
  }
}
