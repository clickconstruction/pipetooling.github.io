/**
 * A place's photos after its first (punch list #413, step 7): the ones it already keeps, less any
 * the person took off, and the new ones picked on this visit, shrunk on the phone as a place's
 * first photo is. The place sheet holds them here until its one press saves the place.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { PLACE_MORE_PHOTOS_MAX, type PlacePhoto } from '../lib/paintedMap/paintedMap'
import { newPhotoId } from '../lib/photos/reportPhotos'
import { loadReportPhotoSize } from '../lib/photos/reportPhotosIo'
import { shrinkReportPhoto } from '../lib/photos/shrink'
import { formatErrorMessage } from '../utils/errorHandling'

/** A photo picked on this visit and not yet saved. */
export type NewPlacePhoto = { id: string; blob: Blob; previewUrl: string }

export type PlaceMorePhotosHost = {
  /** The saved ones the place still keeps. */
  kept: PlacePhoto[]
  /** The ones picked on this visit. */
  added: NewPlacePhoto[]
  /** True while the phone shrinks a pick. */
  shrinking: boolean
  error: string | null
  /** Room for one more, under the table's cap. */
  canAdd: boolean
  pick: (file: File) => Promise<void>
  removeKept: (path: string) => void
  removeAdded: (id: string) => void
}

export function usePlaceMorePhotos(saved: ReadonlyArray<PlacePhoto> | null | undefined): PlaceMorePhotosHost {
  const [kept, setKept] = useState<PlacePhoto[]>(() => [...(saved ?? [])])
  const [added, setAdded] = useState<NewPlacePhoto[]>([])
  const [shrinking, setShrinking] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const urls = useRef<string[]>([])

  // The previews are this sheet's own: they go when it does.
  useEffect(
    () => () => {
      for (const u of urls.current) URL.revokeObjectURL(u)
      urls.current = []
    },
    [],
  )

  const pick = useCallback(async (file: File) => {
    setShrinking(true)
    setError(null)
    try {
      const shrunk = await shrinkReportPhoto(file, await loadReportPhotoSize())
      const previewUrl = URL.createObjectURL(shrunk.blob)
      urls.current.push(previewUrl)
      setAdded((prev) => [...prev, { id: newPhotoId(), blob: shrunk.blob, previewUrl }])
    } catch (e) {
      setError(formatErrorMessage(e, 'The photo did not read.'))
    } finally {
      setShrinking(false)
    }
  }, [])

  const removeKept = useCallback((path: string) => setKept((prev) => prev.filter((p) => p.path !== path)), [])
  const removeAdded = useCallback((id: string) => setAdded((prev) => prev.filter((p) => p.id !== id)), [])

  return { kept, added, shrinking, error, canAdd: kept.length + added.length < PLACE_MORE_PHOTOS_MAX, pick, removeKept, removeAdded }
}
