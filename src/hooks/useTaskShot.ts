/**
 * Task cards: one shot held on a sheet (punch list #273, PR 4b). The sheet's tile picks a file, the phone shrinks it to
 * the office's size (the report photos' own rule), and the shot waits here with its preview until the sheet's press
 * sends it with its kind. `clear` drops it; a sheet closed without a press drops it too. Since v2.6628 a shot the
 * press could not send for want of signal is `kept`: its bytes wait on the phone with an outbox press, the tile says
 * so, and the sheet's next press sends it no more.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { newPhotoId } from '../lib/photos/reportPhotos'
import { loadReportPhotoSize } from '../lib/photos/reportPhotosIo'
import { shrinkReportPhoto, type ShrunkPhoto } from '../lib/photos/shrink'
import { formatErrorMessage } from '../utils/errorHandling'

export type TaskShot = {
  /** Minted on the phone when picked, so a shot kept with no signal lands on the same row every try. */
  id: string
  blob: Blob
  width: number
  height: number
  originalBytes: number
  previewUrl: string
  takenAt: string
}

export type TaskShotHost = {
  shot: TaskShot | null
  /** True while the phone shrinks the pick. */
  shrinking: boolean
  /** The shot waits on the phone with an outbox press: the tile says so and the press sends it no more. */
  kept: boolean
  error: string | null
  pick: (file: File) => Promise<void>
  clear: () => void
  markKept: () => void
}

/** The words a kept shot's tile reads. */
export const TASK_SHOT_KEPT_WORDS = { lead: '📷 Kept on the phone', tail: 'It goes to the card when the signal is back.' } as const

export function useTaskShot(): TaskShotHost {
  const [shot, setShot] = useState<TaskShot | null>(null)
  const [shrinking, setShrinking] = useState(false)
  const [kept, setKept] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const urlRef = useRef<string | null>(null)

  const clear = useCallback(() => {
    if (urlRef.current) URL.revokeObjectURL(urlRef.current)
    urlRef.current = null
    setShot(null)
    setKept(false)
    setError(null)
  }, [])

  useEffect(() => () => clear(), [clear])

  const pick = useCallback(
    async (file: File) => {
      setShrinking(true)
      setError(null)
      setKept(false)
      try {
        const size = await loadReportPhotoSize()
        const shrunk: ShrunkPhoto = await shrinkReportPhoto(file, size)
        if (urlRef.current) URL.revokeObjectURL(urlRef.current)
        const previewUrl = URL.createObjectURL(shrunk.blob)
        urlRef.current = previewUrl
        setShot({ id: newPhotoId(), blob: shrunk.blob, width: shrunk.width, height: shrunk.height, originalBytes: file.size, previewUrl, takenAt: new Date(file.lastModified || Date.now()).toISOString() })
      } catch (e) {
        setError(formatErrorMessage(e, 'The photo did not read.'))
      } finally {
        setShrinking(false)
      }
    },
    [],
  )

  const markKept = useCallback(() => setKept(true), [])

  return { shot, shrinking, kept, error, pick, clear, markKept }
}
