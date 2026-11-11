/**
 * A bid photo's picture, small and at full size (punch list #306), for the photos panel (`useBidPhotosPanel.tsx`).
 * A photo the sweep has not filed is drawn from the bucket's signed URL; one in Drive is read through the
 * `bid-photos` function, since the person may have no Drive access of their own.
 */
import { useEffect, useState, type CSSProperties } from 'react'
import type { BidPhotosWindowIo } from '../../lib/bids/bidPhotosIo'
import { BID_PHOTO_WORDS, type BidPhotoRow } from '../../lib/bids/bidPhotoWindow'

const sub: CSSProperties = { margin: 0, fontSize: '0.875rem', color: 'var(--text-muted)' }
const thumbImg: CSSProperties = { width: '100%', height: '100%', objectFit: 'cover', display: 'block' }

/** One photo's picture: the bucket's signed URL while it waits, Drive's thumbnail through the function once filed. */
export function BidPhotoThumb({ bidId, row, preview, io }: { bidId: string; row: BidPhotoRow; preview: string | null; io: BidPhotosWindowIo }) {
  const [url, setUrl] = useState<string | null>(null)
  const fileId = row.drive_file_id
  useEffect(() => {
    if (!fileId) return
    let live = true
    let made: string | null = null
    io.thumb(bidId, fileId).then(
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
  }, [io, bidId, fileId])
  const src = fileId ? url : preview
  return src ? <img src={src} alt="" style={thumbImg} /> : null
}

/** One photo at full size: the bucket's copy, or Drive's bytes through the function. */
export function BidPhotoFull({ bidId, row, preview, io }: { bidId: string; row: BidPhotoRow; preview: string | null; io: BidPhotosWindowIo }) {
  const [url, setUrl] = useState<string | null>(null)
  const [missed, setMissed] = useState(false)
  const fileId = row.drive_file_id
  useEffect(() => {
    setUrl(null)
    setMissed(false)
    if (!fileId) return
    let live = true
    let made: string | null = null
    io.full(bidId, fileId).then(
      (u) => {
        if (!live) {
          if (u) URL.revokeObjectURL(u)
          return
        }
        made = u
        setUrl(u)
        if (!u) setMissed(true)
      },
      () => live && setMissed(true),
    )
    return () => {
      live = false
      if (made) URL.revokeObjectURL(made)
    }
  }, [io, bidId, fileId])
  const src = fileId ? url : preview
  if (src) return <img src={src} alt={row.name || BID_PHOTO_WORDS.plainName} style={{ maxWidth: '100%', maxHeight: '68vh', borderRadius: 8, border: '1px solid var(--border)' }} />
  return <p style={sub}>{missed || !fileId ? 'The photo did not read. Open it in Drive.' : 'Reading the photo from Drive…'}</p>
}
