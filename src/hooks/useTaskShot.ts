/**
 * Task cards: one shot held on a sheet (punch list #273, PR 4b). The sheet's tile picks a file, the phone shrinks it to
 * the office's size (the report photos' own rule), and the shot waits here with its preview until the sheet's press
 * sends it with its kind. `clear` drops it; a sheet closed without a press drops it too.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { loadReportPhotoSize } from '../lib/photos/reportPhotosIo'
import { shrinkReportPhoto, type ShrunkPhoto } from '../lib/photos/shrink'
import { formatErrorMessage } from '../utils/errorHandling'

export type TaskShot = {
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
  error: string | null
  pick: (file: File) => Promise<void>
  clear: () => void
}

export function useTaskShot(): TaskShotHost {
  const [shot, setShot] = useState<TaskShot | null>(null)
  const [shrinking, setShrinking] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const urlRef = useRef<string | null>(null)

  const clear = useCallback(() => {
    if (urlRef.current) URL.revokeObjectURL(urlRef.current)
    urlRef.current = null
    setShot(null)
    setError(null)
  }, [])

  useEffect(() => () => clear(), [clear])

  const pick = useCallback(
    async (file: File) => {
      setShrinking(true)
      setError(null)
      try {
        const size = await loadReportPhotoSize()
        const shrunk: ShrunkPhoto = await shrinkReportPhoto(file, size)
        if (urlRef.current) URL.revokeObjectURL(urlRef.current)
        const previewUrl = URL.createObjectURL(shrunk.blob)
        urlRef.current = previewUrl
        setShot({ blob: shrunk.blob, width: shrunk.width, height: shrunk.height, originalBytes: file.size, previewUrl, takenAt: new Date(file.lastModified || Date.now()).toISOString() })
      } catch (e) {
        setError(formatErrorMessage(e, 'The photo did not read.'))
      } finally {
        setShrinking(false)
      }
    },
    [],
  )

  return { shot, shrinking, error, pick, clear }
}
