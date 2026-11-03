import { useCallback, useEffect, useMemo, useState } from 'react'
import { recoveryFailureFromError, type OfflineRecoveryLastError } from '../lib/offlineRecoveryState'
import { censusOf, SITE_PHOTOS_PAGE, weekFromIso, type SitePhotoCensus } from '../lib/photos/sitePhotos'
import { supabaseSitePhotosIo, type SitePhotosIo } from '../lib/photos/sitePhotosIo'
import type { SourcePick, UploadedPhotoRow } from '../lib/photos/uploadedPhotos'

/**
 * A development's photos on its page (punch list #247, PR 1): the census and the row, read once the page knows the
 * site's jobs and bids, and again when a chip narrows the row or Show more asks for the next page. One hook holds
 * the state so the strip's sixth look, the Photos card and (PR 2) the History's photo lines read the same rows.
 * `enabled` false reads nothing.
 */
export type SitePhotosState = {
  io: SitePhotosIo
  census: SitePhotoCensus | null
  rows: UploadedPhotoRow[]
  more: boolean
  reading: boolean
  failure: OfflineRecoveryLastError | null
  source: SourcePick
  setSource: (s: SourcePick) => void
  jobId: string | null
  setJobId: (id: string | null) => void
  person: string | null
  setPerson: (name: string | null) => void
  showMore: () => void
  reload: () => void
}

export function useSitePhotos({ jobIds, bidIds, enabled, io: givenIo }: { jobIds: ReadonlyArray<string>; bidIds: ReadonlyArray<string>; enabled: boolean; io?: SitePhotosIo }): SitePhotosState {
  const io = useMemo(() => givenIo ?? supabaseSitePhotosIo(), [givenIo])
  // The ids as one key, so a new array of the same ids reads nothing again.
  const jobKey = useMemo(() => [...jobIds].sort().join(','), [jobIds])
  const bidKey = useMemo(() => [...bidIds].sort().join(','), [bidIds])
  const [source, setSourceState] = useState<SourcePick>('all')
  const [jobId, setJobIdState] = useState<string | null>(null)
  const [person, setPerson] = useState<string | null>(null)
  const [limit, setLimit] = useState(SITE_PHOTOS_PAGE)
  const [census, setCensus] = useState<SitePhotoCensus | null>(null)
  const [read, setRead] = useState<{ rows: UploadedPhotoRow[]; more: boolean }>({ rows: [], more: false })
  const [reading, setReading] = useState(false)
  const [failure, setFailure] = useState<OfflineRecoveryLastError | null>(null)
  const [gen, setGen] = useState(0)

  const setSource = useCallback((s: SourcePick) => {
    setSourceState(s)
    setLimit(SITE_PHOTOS_PAGE)
  }, [])
  const setJobId = useCallback((id: string | null) => {
    setJobIdState(id)
    setLimit(SITE_PHOTOS_PAGE)
  }, [])

  useEffect(() => {
    if (!enabled || (!jobKey && !bidKey)) return
    let live = true
    const jobs = jobKey ? jobKey.split(',') : []
    const bids = bidKey ? bidKey.split(',') : []
    io.census(jobs, bids).then(
      (rows) => live && setCensus(censusOf(rows, weekFromIso(Date.now()))),
      () => live && setCensus(null),
    )
    return () => {
      live = false
    }
  }, [io, jobKey, bidKey, enabled, gen])

  useEffect(() => {
    if (!enabled || (!jobKey && !bidKey)) return
    let live = true
    setReading(true)
    const jobs = jobKey ? jobKey.split(',') : []
    const bids = bidKey ? bidKey.split(',') : []
    io.list({ jobIds: jobs, bidIds: bids, jobId, source, limit }).then(
      (r) => {
        if (!live) return
        setRead(r)
        setFailure(null)
        setReading(false)
      },
      (e) => {
        if (!live) return
        setFailure(recoveryFailureFromError(e, 'The site’s photos did not read.'))
        setReading(false)
      },
    )
    return () => {
      live = false
    }
  }, [io, jobKey, bidKey, enabled, jobId, source, limit, gen])

  return {
    io,
    census,
    rows: read.rows,
    more: read.more,
    reading,
    failure,
    source,
    setSource,
    jobId,
    setJobId,
    person,
    setPerson,
    showMore: () => setLimit((n) => n + SITE_PHOTOS_PAGE),
    reload: () => setGen((n) => n + 1),
  }
}
