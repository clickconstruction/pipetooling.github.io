/**
 * The folder's viewer (punch list #164, PR 5): every picture in the job's Drive folder as a grid of thumbnails with
 * the day under each, a page at a time, and one picture at full size when pressed, with *Open in Drive*. Nothing is
 * copied: each picture streams through `job-photos` while it is on screen.
 */
import { useEffect, useState, type CSSProperties } from 'react'
import ResponsiveModalShell from '../ResponsiveModalShell'
import { VIEWER_PAGE, drivePhotoUrl, newestFirst, photoDayWords, viewerTitle, type JobPhoto } from '../../lib/photos/jobPhotos'
import type { JobPhotosIo } from '../../lib/photos/jobPhotosIo'
import { openInExternalBrowser } from '../../lib/openInExternalBrowser'
import * as S from '../jobMode/sheetStyles'
import { JobPhotoThumb, TILE } from './JobPhotoThumb'

const grid: CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(96px, 1fr))', gap: '0.5rem' }
const tileBtn: CSSProperties = { ...TILE, padding: 0, cursor: 'pointer', textAlign: 'left' }
const day: CSSProperties = { position: 'absolute', left: 0, right: 0, bottom: 0, fontSize: '0.65rem', fontWeight: 600, textAlign: 'center', background: 'rgba(17, 24, 39, 0.55)', color: '#f9fafb', padding: '1px 0' }

export function JobPhotosViewer({ jobId, photos, folderUrl, io, onClose }: { jobId: string; photos: readonly JobPhoto[]; folderUrl: string | null; io: JobPhotosIo; onClose: () => void }) {
  const sorted = newestFirst(photos)
  const [shown, setShown] = useState(VIEWER_PAGE)
  const [open, setOpen] = useState<JobPhoto | null>(null)
  const [full, setFull] = useState<string | null>(null)

  useEffect(() => {
    let live = true
    let made: string | null = null
    setFull(null)
    if (!open) return
    io.full(jobId, open.id).then(
      (u) => {
        if (!live) {
          if (u) URL.revokeObjectURL(u)
          return
        }
        made = u
        setFull(u)
      },
      () => live && setFull(null),
    )
    return () => {
      live = false
      if (made) URL.revokeObjectURL(made)
    }
  }, [io, jobId, open])

  const footer = open ? (
    <div style={S.footerRow}>
      <button type="button" style={S.secondaryBtn} onClick={() => setOpen(null)}>
        Back to the photos
      </button>
      <button type="button" style={S.secondaryBtn} onClick={() => openInExternalBrowser(drivePhotoUrl(open.id))}>
        Open in Drive
      </button>
    </div>
  ) : (
    <div style={S.footerRow}>
      <button type="button" style={S.secondaryBtn} onClick={onClose}>
        Close
      </button>
      {folderUrl ? (
        <button type="button" style={S.secondaryBtn} onClick={() => openInExternalBrowser(folderUrl)}>
          Open the folder in Drive
        </button>
      ) : null}
    </div>
  )

  return (
    <ResponsiveModalShell title={open ? open.name : viewerTitle(sorted.length)} onRequestClose={onClose} footer={footer} maxWidthDesktop={820} fullScreenKey="job-photos">
      {open ? (
        <div data-job-photo-open={open.id} style={{ display: 'grid', gap: '0.5rem', justifyItems: 'center' }}>
          {full ? <img src={full} alt={open.name} style={{ maxWidth: '100%', maxHeight: '70vh', borderRadius: 8, border: '1px solid var(--border)' }} /> : <p style={S.muted}>Reading the photo from Drive…</p>}
          <p style={{ ...S.muted, margin: 0 }}>{[photoDayWords(open.modified), open.from === 'pictures' ? 'Customer Pictures' : 'Team only › Photos'].filter(Boolean).join(' · ')}</p>
        </div>
      ) : (
        <div data-job-photos-viewer>
          <div style={grid}>
            {sorted.slice(0, shown).map((p) => (
              <button key={p.id} type="button" style={tileBtn} aria-label={`Open ${p.name}`} onClick={() => setOpen(p)}>
                <JobPhotoThumb jobId={jobId} fileId={p.id} alt={p.name} io={io} />
                {photoDayWords(p.modified) ? <span style={day}>{photoDayWords(p.modified)}</span> : null}
              </button>
            ))}
          </div>
          {sorted.length > shown ? (
            <div style={{ marginTop: '0.75rem', textAlign: 'center' }}>
              <button type="button" style={S.secondaryBtn} onClick={() => setShown((n) => n + VIEWER_PAGE)}>
                Show {Math.min(VIEWER_PAGE, sorted.length - shown)} more
              </button>
            </div>
          ) : null}
        </div>
      )}
    </ResponsiveModalShell>
  )
}

export default JobPhotosViewer
