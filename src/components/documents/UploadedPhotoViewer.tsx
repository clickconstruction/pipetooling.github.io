/**
 * The viewer on Documents → Photos (punch list #232): one picture at full size, streamed while it is on screen and
 * never kept, with its facts beside it (the photo, the job, who took it and when, where it is) and the presses under
 * it: Open in Drive, the source's own door (the report, the box, the thread), the job, and only this person's photos.
 * Previous and Next move through the list in the order shown.
 */
import { useEffect, useState, type CSSProperties } from 'react'
import ResponsiveModalShell from '../ResponsiveModalShell'
import * as S from '../jobMode/sheetStyles'
import { formatDenverCalendarDayWithYear } from '../../utils/dateUtils'
import { driveFileUrl } from '../../lib/photos/reportPhotos'
import { captionWords, jobWords, sizeWords, sourceDoorWords, sourceWords, timeWords, viewerTitle, whereWords, whoWords, firstName, type UploadedPhotoRow } from '../../lib/photos/uploadedPhotos'
import type { UploadedPhotosIo } from '../../lib/photos/uploadedPhotosIo'
import { openInExternalBrowser } from '../../lib/openInExternalBrowser'

const facts: CSSProperties = { display: 'grid', gap: '0.5rem', fontSize: '0.875rem', color: 'var(--text-700)', margin: 0, padding: 0, listStyle: 'none' }
const k: CSSProperties = { display: 'block', fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--text-muted)' }
const v: CSSProperties = { color: 'var(--text-strong)' }

export function UploadedPhotoViewer({
  rows,
  index,
  io,
  onIndex,
  onClose,
  onJob,
  onSource,
  onPerson,
}: {
  rows: ReadonlyArray<UploadedPhotoRow>
  index: number
  io: UploadedPhotosIo
  onIndex: (i: number) => void
  onClose: () => void
  /** The job press; absent when the row has no job. */
  onJob: (row: UploadedPhotoRow) => void
  /** The source's door; null when the row has none to offer. */
  onSource: ((row: UploadedPhotoRow) => void) | null
  onPerson: (name: string) => void
}) {
  const row = rows[index]
  const [full, setFull] = useState<string | null>(null)
  useEffect(() => {
    let live = true
    let made: string | null = null
    setFull(null)
    if (!row) return
    io.full(row).then(
      (u) => {
        if (!live) {
          if (u && u.startsWith('blob:')) URL.revokeObjectURL(u)
          return
        }
        made = u
        setFull(u)
      },
      () => live && setFull(null),
    )
    return () => {
      live = false
      if (made && made.startsWith('blob:')) URL.revokeObjectURL(made)
    }
  }, [io, row])
  if (!row) return null

  const where = whereWords(row)
  const tone = where.tone === 'filed' ? 'var(--text-green-800)' : where.tone === 'held' ? 'var(--text-amber-800)' : 'var(--text-muted)'
  const takenMs = Date.parse(row.taken_at)
  const taken = [sourceWords(row), whoWords(row), Number.isFinite(takenMs) ? `${formatDenverCalendarDayWithYear(takenMs)} · ${timeWords(row.taken_at)}` : ''].filter(Boolean).join(' · ')
  const person = row.source === 'message' ? '' : firstName(row.by_name)

  const footer = (
    <div style={{ ...S.footerRow, flexWrap: 'wrap', justifyContent: 'flex-start' }}>
      {row.drive_file_id ? (
        <button type="button" style={S.hereBtn} onClick={() => openInExternalBrowser(driveFileUrl(row.drive_file_id!))}>
          Open in Drive
        </button>
      ) : null}
      {onSource ? (
        <button type="button" style={S.secondaryBtn} onClick={() => onSource(row)}>
          {sourceDoorWords(row)}
        </button>
      ) : null}
      {row.job_id && row.source !== 'checklist' ? (
        <button type="button" style={S.secondaryBtn} onClick={() => onJob(row)}>
          Open the job
        </button>
      ) : null}
      {person ? (
        <button type="button" style={S.secondaryBtn} onClick={() => onPerson(row.by_name)}>
          Only {person}’s photos
        </button>
      ) : null}
      <button type="button" style={{ ...S.secondaryBtn, marginLeft: 'auto' }} onClick={onClose}>
        Close
      </button>
    </div>
  )

  return (
    <ResponsiveModalShell title={viewerTitle(row)} onRequestClose={onClose} footer={footer} maxWidthDesktop={900} fullScreenKey="uploaded-photos">
      <div data-uploaded-photo-open={row.id} style={{ display: 'grid', gap: '0.75rem' }}>
        <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'space-between', alignItems: 'center' }}>
          <button type="button" style={{ ...S.secondaryBtn, minHeight: 40, ...(index <= 0 ? S.disabled : {}) }} disabled={index <= 0} onClick={() => onIndex(index - 1)}>
            ‹ Previous
          </button>
          <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
            {index + 1} of {rows.length}
          </span>
          <button type="button" style={{ ...S.secondaryBtn, minHeight: 40, ...(index >= rows.length - 1 ? S.disabled : {}) }} disabled={index >= rows.length - 1} onClick={() => onIndex(index + 1)}>
            Next ›
          </button>
        </div>
        <div style={{ display: 'grid', gap: '0.5rem', justifyItems: 'center' }}>
          {full ? (
            <img src={full} alt={captionWords(row)} style={{ maxWidth: '100%', maxHeight: '60vh', borderRadius: 8, border: '1px solid var(--border)' }} />
          ) : (
            <p style={{ ...S.muted, margin: '1rem 0' }}>{where.tone === 'held' && !row.storage_path && !row.drive_file_id ? 'There is no copy of this photo to show.' : 'Reading the photo…'}</p>
          )}
        </div>
        <ul style={facts}>
          <li>
            <span style={k}>Photo</span>
            <span style={v}>{[captionWords(row), sizeWords(row)].filter(Boolean).join(' · ')}</span>
          </li>
          <li>
            <span style={k}>Job</span>
            <span style={v}>{jobWords(row)}</span>
          </li>
          <li>
            <span style={k}>Taken</span>
            <span style={v}>{taken}</span>
          </li>
          <li>
            <span style={k}>Where</span>
            <span style={{ color: tone, fontWeight: 600 }}>{where.text}</span>
            {where.sub ? <span style={{ display: 'block', color: 'var(--text-muted)', fontSize: '0.8125rem' }}>{where.sub}</span> : null}
          </li>
        </ul>
      </div>
    </ResponsiveModalShell>
  )
}

export default UploadedPhotoViewer
