import type { TaskPhotoView } from '../../hooks/useTaskPhotos'
import { stripStamp } from '../../lib/checklistCardEvents'
import { TASK_PHOTO_STANDING_WORDS, taskPhotoStanding } from '../../lib/taskPhotos'

/**
 * Task cards (#273, PR 4b): the card's photos as a strip of thumbnails, newest first, each captioned by what it is for
 * (*67%*, *finish*, the line's words) and its standing (*in Drive* · *on its way* · *not in Drive yet*). A thumbnail
 * opens the bucket copy in a new tab; one that will not sign draws as its words.
 */
export function TaskPhotoStrip({ photos, compact = false }: { photos: TaskPhotoView[]; compact?: boolean }) {
  if (photos.length === 0) return null
  const size = compact ? { w: 44, h: 34 } : { w: 64, h: 48 }
  return (
    <div style={{ marginTop: compact ? 4 : 8 }} data-testid="task-photo-strip">
      {!compact ? (
        <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: 4 }}>
          📷 {photos.length} photo{photos.length === 1 ? '' : 's'}
        </div>
      ) : null}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {photos.map((p) => {
          const standing = taskPhotoStanding(p)
          const title = `${p.caption} · ${p.by_name} · ${stripStamp(p.taken_at)} · ${TASK_PHOTO_STANDING_WORDS[standing]}`
          const thumb = p.previewUrl ? (
            <img src={p.previewUrl} alt={title} style={{ width: size.w, height: size.h, objectFit: 'cover', borderRadius: 6, border: '1px solid var(--border-strong)', display: 'block' }} />
          ) : (
            <span style={{ width: size.w, height: size.h, borderRadius: 6, border: '1px solid var(--border-strong)', display: 'grid', placeItems: 'center', fontSize: '0.65rem', color: 'var(--text-muted)', background: 'var(--bg-muted)' }}>{p.caption}</span>
          )
          return p.previewUrl ? (
            <a key={p.id} href={p.previewUrl} target="_blank" rel="noreferrer" title={title} aria-label={title} style={{ display: 'block' }}>
              {thumb}
            </a>
          ) : (
            <span key={p.id} title={title}>
              {thumb}
            </span>
          )
        })}
      </div>
    </div>
  )
}
