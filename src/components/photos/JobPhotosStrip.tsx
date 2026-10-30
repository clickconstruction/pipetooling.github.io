/**
 * A job's Drive photos in the app (punch list #164, PR 5): the strip under the job window's address. *Photos · 15*
 * is the door to the folder's viewer; three thumbnails and a *+ N* tile sit under it, read from the customer's Drive
 * folder through `job-photos` and never copied out. A job with no folder link says so with the door to set it; a
 * folder with nothing in it says what fills it; a read that fails says why and offers Try again, and never hides the
 * window. The rules are `lib/photos/jobPhotos.ts`.
 */
import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import { driveFolderIdFromUrl } from '../../lib/jobs/jobDriveFolders'
import { ASK_OFFICE_FOLDER, FROM_LINE, NO_FOLDER_WORDS, SET_FOLDER, emptyFolderWords, photoDayWords, photosDoorWords, readFailedWords, stripTiles, waitingWords, type JobPhotosRead } from '../../lib/photos/jobPhotos'
import { supabaseJobPhotosIo, type JobPhotosIo } from '../../lib/photos/jobPhotosIo'
import { formatErrorMessage } from '../../utils/errorHandling'
import { JobPhotoThumb, TILE } from './JobPhotoThumb'
import { JobPhotosViewer } from './JobPhotosViewer'

const label: CSSProperties = { fontSize: '0.8125rem', fontWeight: 500, color: 'var(--text-muted)' }
const doorBtn: CSSProperties = { ...label, background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: 'var(--text-link)', fontWeight: 600, font: 'inherit', fontSize: '0.8125rem' }
const muted: CSSProperties = { fontSize: '0.75rem', color: 'var(--text-muted)', margin: 0 }
const strip: CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 6 }
const tileBtn: CSSProperties = { ...TILE, padding: 0, cursor: 'pointer' }
const moreTile: CSSProperties = { ...TILE, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)', cursor: 'pointer' }
const day: CSSProperties = { position: 'absolute', left: 0, right: 0, bottom: 0, fontSize: '0.6rem', fontWeight: 600, textAlign: 'center', background: 'rgba(17, 24, 39, 0.55)', color: '#f9fafb', padding: '1px 0' }
const dashed: CSSProperties = { border: '1px dashed var(--border-strong)', borderRadius: 8, background: 'var(--bg-subtle)', padding: '0.55rem 0.7rem', fontSize: '0.8125rem', color: 'var(--text-muted)' }
const smallBtn: CSSProperties = { display: 'inline-block', border: '1px solid var(--border-strong)', borderRadius: 6, padding: '0.15rem 0.6rem', background: 'var(--surface)', color: 'var(--text-strong)', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer', marginTop: '0.3rem', font: 'inherit' }

export interface JobPhotosStripProps {
  jobId: string
  /** The job's two links, so a job with no folder says so without a call. */
  driveLink: string | null | undefined
  picturesLink: string | null | undefined
  /** The door to set the folder, for the roles that may; absent, the strip says to ask the office. */
  onSetFolder?: () => void
  io?: JobPhotosIo
  /** Goes up when the window wants the folder read again. */
  rev?: number
}

export function JobPhotosStrip({ jobId, driveLink, picturesLink, onSetFolder, io: ioProp, rev = 0 }: JobPhotosStripProps) {
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
  }, [io, jobId, hasFolder, rev, tick])

  const tiles = useMemo(() => (read ? stripTiles(read.photos) : []), [read])

  if (!hasFolder) {
    return (
      <div data-job-photos="no-folder" style={{ display: 'grid', gap: '0.35rem' }}>
        <span style={label}>{photosDoorWords(null)}</span>
        <div style={dashed}>
          <span style={{ display: 'block', fontWeight: 600, color: 'var(--text-strong)' }}>{NO_FOLDER_WORDS}</span>
          {onSetFolder ? (
            <button type="button" style={smallBtn} onClick={onSetFolder}>
              {SET_FOLDER}
            </button>
          ) : (
            <span style={{ display: 'block', marginTop: '0.2rem' }}>{ASK_OFFICE_FOLDER}</span>
          )}
        </div>
      </div>
    )
  }

  return (
    <div data-job-photos={read ? (read.photos.length ? 'photos' : 'empty') : error ? 'failed' : 'loading'} style={{ display: 'grid', gap: '0.35rem', minWidth: 0 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '0.5rem' }}>
        {read && read.photos.length ? (
          <button type="button" style={doorBtn} onClick={() => setViewer(true)} aria-label={`${photosDoorWords(read.photos.length)}: open the folder's viewer`}>
            {photosDoorWords(read.photos.length)} ▸
          </button>
        ) : (
          <span style={label}>{photosDoorWords(read ? read.photos.length : null)}</span>
        )}
        {read?.capped ? <span style={muted}>the newest 500</span> : null}
      </div>
      {error ? (
        <p style={{ ...muted, color: 'var(--text-amber-700)' }}>
          {readFailedWords(error)}{' '}
          <button type="button" style={{ ...doorBtn, fontSize: '0.75rem' }} onClick={() => setTick((t) => t + 1)}>
            Try again
          </button>
        </p>
      ) : !read ? (
        <p style={muted}>Reading the folder…</p>
      ) : read.photos.length === 0 ? (
        <p style={muted}>{emptyFolderWords(read.waiting)}</p>
      ) : (
        <>
          <div style={strip} role="list" aria-label="Photos">
            {tiles.map((t) =>
              t.kind === 'photo' ? (
                <button key={t.photo.id} type="button" role="listitem" style={tileBtn} aria-label={`Open ${t.photo.name}`} onClick={() => setViewer(true)}>
                  <JobPhotoThumb jobId={jobId} fileId={t.photo.id} alt={t.photo.name} io={io} />
                  {photoDayWords(t.photo.modified) ? <span style={day}>{photoDayWords(t.photo.modified)}</span> : null}
                </button>
              ) : (
                <button key="more" type="button" role="listitem" style={moreTile} aria-label={`${t.count} more photos: open the folder's viewer`} onClick={() => setViewer(true)}>
                  + {t.count}
                </button>
              ),
            )}
          </div>
          <p style={muted}>
            {FROM_LINE}
            {read.waiting > 0 ? ` ${waitingWords(read.waiting)}` : ''}
          </p>
        </>
      )}
      {viewer && read ? <JobPhotosViewer jobId={jobId} photos={read.photos} folderUrl={read.folder.url} io={io} onClose={() => setViewer(false)} /> : null}
    </div>
  )
}

export default JobPhotosStrip
