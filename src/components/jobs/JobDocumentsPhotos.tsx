/**
 * The job window's Documents tab Photos section (punch list #232, PR 3): one line over the folder's own read, *15 in
 * Drive · 1 on its way · the newest Nov 1*, whose press opens the viewer the strip under the address already has. A
 * job with no folder link says so, as the strip does, and points at the Make the job's Drive folders press above it;
 * a read that fails says why with Try again. Nothing new is read: `job-photos`' list, as the strip reads it.
 */
import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import { driveFolderIdFromUrl } from '../../lib/jobs/jobDriveFolders'
import { NO_FOLDER_WORDS, readFailedWords, type JobPhotosRead } from '../../lib/photos/jobPhotos'
import { PHOTOS_LINE_SUB, photosLineOpens, photosLineWords } from '../../lib/photos/jobPhotosLine'
import { supabaseJobPhotosIo, type JobPhotosIo } from '../../lib/photos/jobPhotosIo'
import { formatErrorMessage } from '../../utils/errorHandling'
import { JobPhotosViewer } from '../photos/JobPhotosViewer'
import { documentsHeading } from './jobDocumentsStyles'

const line: CSSProperties = { fontSize: '0.875rem', color: 'var(--text-700)' }
const doorBtn: CSSProperties = { ...line, background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: 'var(--text-link)', fontWeight: 600, font: 'inherit', fontSize: '0.875rem' }
const muted: CSSProperties = { fontSize: '0.8125rem', color: 'var(--text-muted)', margin: 0 }

export function JobDocumentsPhotos({ jobId, driveLink, picturesLink, io: ioProp }: { jobId: string; driveLink: string | null | undefined; picturesLink: string | null | undefined; io?: JobPhotosIo }) {
  const io = useMemo(() => ioProp ?? supabaseJobPhotosIo(), [ioProp])
  const hasFolder = Boolean(driveFolderIdFromUrl(picturesLink) || driveFolderIdFromUrl(driveLink))
  const [read, setRead] = useState<JobPhotosRead | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [tick, setTick] = useState(0)
  const [viewer, setViewer] = useState(false)

  useEffect(() => {
    let live = true
    setRead(null)
    setError(null)
    if (!hasFolder) return
    io.list(jobId).then(
      (r) => live && setRead(r),
      (e: unknown) => live && setError(formatErrorMessage(e, 'The folder did not answer.')),
    )
    return () => {
      live = false
    }
  }, [io, jobId, hasFolder, tick])

  return (
    <section aria-labelledby="job-documents-photos" data-job-documents-photos={!hasFolder ? 'no-folder' : read ? (read.photos.length ? 'photos' : 'empty') : error ? 'failed' : 'loading'} style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
      <h3 id="job-documents-photos" style={documentsHeading}>
        Photos
      </h3>
      {!hasFolder ? (
        <p style={{ ...line, margin: 0 }}>
          {NO_FOLDER_WORDS} <span style={{ color: 'var(--text-muted)' }}>Make the job’s Drive folders above, or add the link on the Edit tab.</span>
        </p>
      ) : error ? (
        <p style={{ ...muted, color: 'var(--text-amber-800)' }}>
          {readFailedWords(error)}{' '}
          <button type="button" style={{ ...doorBtn, fontSize: '0.8125rem' }} onClick={() => setTick((t) => t + 1)}>
            Try again
          </button>
        </p>
      ) : !read ? (
        <p style={muted}>Reading the folder…</p>
      ) : photosLineOpens(read) ? (
        <button type="button" style={{ ...doorBtn, textAlign: 'left' }} onClick={() => setViewer(true)} aria-label={`${photosLineWords(read)}: open the folder’s viewer`}>
          {photosLineWords(read)} ▸
        </button>
      ) : (
        <p style={{ ...line, margin: 0 }}>{photosLineWords(read)}</p>
      )}
      {hasFolder ? <p style={muted}>{PHOTOS_LINE_SUB}</p> : null}
      {viewer && read ? <JobPhotosViewer jobId={jobId} photos={read.photos} folderUrl={read.folder.url} io={io} onClose={() => setViewer(false)} /> : null}
    </section>
  )
}

export default JobDocumentsPhotos
