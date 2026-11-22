/**
 * Where a photo was taken (punch list #413, step 3): a press on an open job photo or report photo
 * that opens the spot in the phone's own maps. The point is the phone's reading of the moment the
 * photo was taken, kept on the photo's row, and it is read here only when a photo is opened.
 *
 * A photo with no point draws nothing: the phone gave no good reading, or the photo was added
 * later from the phone's library.
 */
import { useEffect, useState, type CSSProperties } from 'react'
import { openInExternalBrowser } from '../../lib/openInExternalBrowser'
import { placePointUrl } from '../../lib/paintedMap/paintedPlaceShare'
import { takenPointWords, type TakenPoint } from '../../lib/paintedMap/paintedSpot'
import { loadPhotoTakenPoint, type PhotoPointSource } from '../../lib/photos/photoTakenPointIo'

type Props = {
  /** Which table the photo's row is in. Any other source keeps no point. */
  source: string
  id: string
  style?: CSSProperties
}

const POINT_SOURCES: ReadonlyArray<PhotoPointSource> = ['job', 'report']

export function PhotoTakenHere({ source, id, style }: Props) {
  const [point, setPoint] = useState<TakenPoint | null>(null)
  const keeps = (POINT_SOURCES as ReadonlyArray<string>).includes(source)

  useEffect(() => {
    setPoint(null)
    if (!keeps) return
    let gone = false
    void loadPhotoTakenPoint(source as PhotoPointSource, id).then((p) => {
      if (!gone) setPoint(p)
    })
    return () => {
      gone = true
    }
  }, [keeps, source, id])

  const url = point ? placePointUrl(point) : null
  if (!point || !url) return null
  return (
    <button type="button" data-photo-taken-here style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', minHeight: 44, padding: '0 0.8rem', borderRadius: 8, borderWidth: 1, borderStyle: 'solid', borderColor: 'var(--border-strong)', background: 'var(--surface)', color: 'var(--text-strong)', fontFamily: 'inherit', fontWeight: 600, fontSize: '0.875rem', cursor: 'pointer', ...style }} onClick={() => openInExternalBrowser(url)}>
      <span aria-hidden>📍</span>
      {takenPointWords(point)}
    </button>
  )
}
