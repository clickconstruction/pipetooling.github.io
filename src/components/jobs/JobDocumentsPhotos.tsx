/**
 * The job window's Documents tab Photos section (punch list #232, PR 3): one line over the folder's own read, *15 in
 * Drive · 1 on its way · the newest Nov 1*. Since punch list #244 (PR 4) the line is the door to the **Job photos**
 * window, the same window the Pipeline row's camera and the Job Mode card open, where the job's photos are browsed
 * with their words and one is added with a description; **Add a photo** sits beside it. A job with no folder link
 * says so, points at the Make the job's Drive folders press above it, and still offers Add a photo, since the first
 * photo makes the folder; a read that fails says why with Try again. Nothing new is read: `job-photos`' list, as the
 * strip under the address reads it.
 */
import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import { driveFolderIdFromUrl } from '../../lib/jobs/jobDriveFolders'
import { NO_FOLDER_WORDS, readFailedWords, type JobPhotosRead } from '../../lib/photos/jobPhotos'
import { PHOTOS_LINE_SUB, photosLineOpens, photosLineWords } from '../../lib/photos/jobPhotosLine'
import { supabaseJobPhotosIo, type JobPhotosIo } from '../../lib/photos/jobPhotosIo'
import { JOB_PHOTO_WORDS } from '../../lib/photos/jobPhotoNotes'
import type { JobPhotosWindowIo } from '../../lib/photos/jobPhotoNotesIo'
import { formatErrorMessage } from '../../utils/errorHandling'
import { JobPhotosWindow, type JobPhotosWindowJob } from '../photos/JobPhotosWindow'
import { documentsHeading, documentsQuietButton } from './jobDocumentsStyles'

const line: CSSProperties = { fontSize: '0.875rem', color: 'var(--text-700)' }
const doorBtn: CSSProperties = { ...line, background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: 'var(--text-link)', fontWeight: 600, font: 'inherit', fontSize: '0.875rem' }
const muted: CSSProperties = { fontSize: '0.8125rem', color: 'var(--text-muted)', margin: 0 }
const row: CSSProperties = { display: 'flex', alignItems: 'baseline', gap: '0.75rem', flexWrap: 'wrap' }

export function JobDocumentsPhotos({
  jobId,
  driveLink,
  picturesLink,
  job,
  io: ioProp,
  windowIo,
}: {
  jobId: string
  driveLink: string | null | undefined
  picturesLink: string | null | undefined
  /** The job's number, name and address for the window's head; absent, the head reads the id's job from the links alone. */
  job?: Pick<JobPhotosWindowJob, 'hcp_number' | 'click_number' | 'job_name' | 'job_address'>
  io?: JobPhotosIo
  windowIo?: JobPhotosWindowIo
}) {
  const io = useMemo(() => ioProp ?? supabaseJobPhotosIo(), [ioProp])
  const hasFolder = Boolean(driveFolderIdFromUrl(picturesLink) || driveFolderIdFromUrl(driveLink))
  const [read, setRead] = useState<JobPhotosRead | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [tick, setTick] = useState(0)
  const [open, setOpen] = useState(false)

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

  const windowJob: JobPhotosWindowJob = { id: jobId, google_drive_link: driveLink ?? null, job_pictures_link: picturesLink ?? null, ...(job ?? {}) }
  const addPress = (
    <button type="button" style={documentsQuietButton} onClick={() => setOpen(true)} data-job-documents-photos-add="">
      {JOB_PHOTO_WORDS.add}
    </button>
  )

  return (
    <section aria-labelledby="job-documents-photos" data-job-documents-photos={!hasFolder ? 'no-folder' : read ? (read.photos.length ? 'photos' : 'empty') : error ? 'failed' : 'loading'} style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
      <h3 id="job-documents-photos" style={documentsHeading}>
        Photos
      </h3>
      {!hasFolder ? (
        <div style={row}>
          <p style={{ ...line, margin: 0 }}>
            {NO_FOLDER_WORDS} <span style={{ color: 'var(--text-muted)' }}>Make the job’s Drive folders above, or add the link on the Edit tab. The first photo added here makes the folder too.</span>
          </p>
          {addPress}
        </div>
      ) : error ? (
        <p style={{ ...muted, color: 'var(--text-amber-800)' }}>
          {readFailedWords(error)}{' '}
          <button type="button" style={{ ...doorBtn, fontSize: '0.8125rem' }} onClick={() => setTick((t) => t + 1)}>
            Try again
          </button>
        </p>
      ) : !read ? (
        <p style={muted}>Reading the folder…</p>
      ) : (
        <div style={row}>
          {photosLineOpens(read) ? (
            <button type="button" style={{ ...doorBtn, textAlign: 'left' }} onClick={() => setOpen(true)} aria-label={`${photosLineWords(read)}: open the job’s photos`}>
              {photosLineWords(read)} ▸
            </button>
          ) : (
            <p style={{ ...line, margin: 0 }}>{photosLineWords(read)}</p>
          )}
          {addPress}
        </div>
      )}
      {hasFolder ? <p style={muted}>{PHOTOS_LINE_SUB}</p> : null}
      {open ? (
        <JobPhotosWindow
          job={windowJob}
          io={windowIo}
          onClose={() => {
            setOpen(false)
            setTick((t) => t + 1)
          }}
        />
      ) : null}
    </section>
  )
}

export default JobDocumentsPhotos
