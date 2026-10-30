import { useEffect, useState } from 'react'
import { CameraGlyph } from '../materials/PhotoPress'
import { cardPhotoWords, driveFileUrl, photoCountWords } from '../../lib/photos/reportPhotos'
import { loadReportPhotos, type ReportPhotoForCard } from '../../lib/photos/reportPhotosIo'
import { bytesWords } from '../../lib/photos/shrink'
import { openInExternalBrowser } from '../../lib/openInExternalBrowser'

/**
 * A saved report's photos on its card (punch list #189, PR 5b): a thumbnail for a shot still waiting in the bucket
 * (*not in Drive yet*, with the sweep's reason when it has one) and a door to the Drive file once it is there
 * (*in Drive*), each with the stage it shows and who took it. Reads once per report; draws nothing for a report with
 * no photos, so older cards look as they did. A read that fails draws nothing too: the words of the report matter
 * more than its pictures.
 */
export function ReportPhotosStrip({ reportId }: { reportId: string }) {
  const [photos, setPhotos] = useState<ReportPhotoForCard[] | null>(null)
  useEffect(() => {
    let live = true
    setPhotos(null)
    loadReportPhotos(reportId)
      .then((rows) => {
        if (live) setPhotos(rows)
      })
      .catch(() => {
        if (live) setPhotos([])
      })
    return () => {
      live = false
    }
  }, [reportId])
  if (!photos || photos.length === 0) return null
  return (
    <div data-testid="report-photos-strip" style={{ marginBottom: '0.75rem' }}>
      <span style={{ color: 'var(--text-muted)', fontWeight: 500, display: 'block', marginBottom: '0.25rem', fontSize: '0.875rem' }}>Photos · {photoCountWords(photos.length)}</span>
      <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
        {photos.map((p) => {
          const where = cardPhotoWords(p)
          const label = [p.stage_name || p.caption || 'Photo', p.by_name].filter(Boolean).join(' · ')
          const tone = where.tone === 'filed' ? 'var(--text-green-800)' : where.tone === 'held' ? 'var(--text-amber-800)' : 'var(--text-muted)'
          const body = (
            <>
              {p.previewUrl ? (
                <img src={p.previewUrl} alt={label} style={{ width: 88, height: 88, objectFit: 'cover', borderRadius: 8, border: '1px solid var(--border)', display: 'block' }} />
              ) : (
                <span style={{ width: 88, height: 88, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-muted)', display: 'grid', placeItems: 'center', color: 'var(--text-link)' }}>
                  <CameraGlyph size={22} />
                </span>
              )}
              <span style={{ display: 'block', fontSize: '0.72rem', lineHeight: 1.25, marginTop: 4, color: 'var(--text-700)', fontWeight: 600 }}>{label}</span>
              <span style={{ display: 'block', fontSize: '0.72rem', lineHeight: 1.25, color: tone, fontWeight: where.tone === 'held' ? 600 : 500 }}>
                {where.text}
                {p.bytes ? ` · ${bytesWords(p.bytes)}` : ''}
              </span>
            </>
          )
          return p.drive_file_id ? (
            <button
              key={p.id}
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                openInExternalBrowser(driveFileUrl(p.drive_file_id!))
              }}
              aria-label={`Open ${label} in Drive`}
              style={{ width: 88, padding: 0, border: 'none', background: 'transparent', textAlign: 'left', cursor: 'pointer', font: 'inherit' }}
            >
              {body}
            </button>
          ) : (
            <div key={p.id} style={{ width: 88 }}>
              {body}
            </div>
          )
        })}
      </div>
    </div>
  )
}
