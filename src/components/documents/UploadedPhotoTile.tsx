/**
 * One thumbnail on Documents → Photos (punch list #232): its bytes come from the shot's bucket while it waits or from
 * Drive through `job-photos` once filed (`thumbSource`), as an object URL the tile revokes when it goes, or a signed URL
 * that needs no revoking. A photo with no copy we can read draws the camera glyph.
 */
import { useEffect, useState, type CSSProperties } from 'react'
import { CameraGlyph } from '../materials/PhotoPress'
import type { UploadedPhotoRow } from '../../lib/photos/uploadedPhotos'
import type { UploadedPhotosIo } from '../../lib/photos/uploadedPhotosIo'

const box: CSSProperties = { width: 72, height: 72, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-muted)', overflow: 'hidden', display: 'grid', placeItems: 'center', color: 'var(--text-link)', flex: 'none' }

export function UploadedPhotoTile({ row, io, size = 72 }: { row: UploadedPhotoRow; io: UploadedPhotosIo; size?: number }) {
  const [url, setUrl] = useState<string | null>(null)
  useEffect(() => {
    let live = true
    let made: string | null = null
    setUrl(null)
    io.thumb(row).then(
      (u) => {
        if (!live) {
          if (u && u.startsWith('blob:')) URL.revokeObjectURL(u)
          return
        }
        made = u
        setUrl(u)
      },
      () => live && setUrl(null),
    )
    return () => {
      live = false
      if (made && made.startsWith('blob:')) URL.revokeObjectURL(made)
    }
  }, [io, row])
  return (
    <span style={{ ...box, width: size, height: size }} data-testid="uploaded-photo-tile">
      {url ? <img src={url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} /> : <CameraGlyph size={22} />}
    </span>
  )
}

export default UploadedPhotoTile
