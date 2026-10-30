/**
 * One thumbnail from the job's Drive folder (punch list #164, PR 5), streamed through `job-photos` as an object URL
 * the tile revokes when it goes. A tile with no bytes yet, or one Drive has no thumbnail for, draws the grey square.
 */
import { useEffect, useState, type CSSProperties } from 'react'
import type { JobPhotosIo } from '../../lib/photos/jobPhotosIo'

export const TILE: CSSProperties = { aspectRatio: '1', width: '100%', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-subtle)', overflow: 'hidden', display: 'block', position: 'relative' }

export function JobPhotoThumb({ jobId, fileId, alt, io }: { jobId: string; fileId: string; alt: string; io: JobPhotosIo }) {
  const [url, setUrl] = useState<string | null>(null)
  useEffect(() => {
    let live = true
    let made: string | null = null
    io.thumb(jobId, fileId).then(
      (u) => {
        if (!live) {
          if (u) URL.revokeObjectURL(u)
          return
        }
        made = u
        setUrl(u)
      },
      () => live && setUrl(null),
    )
    return () => {
      live = false
      if (made) URL.revokeObjectURL(made)
    }
  }, [io, jobId, fileId])
  return url ? <img src={url} alt={alt} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} /> : <span aria-hidden style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-faint)', fontSize: '1.1rem' }}>▦</span>
}
