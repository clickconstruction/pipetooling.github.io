/**
 * Check my location: a few seconds of reading the phone, on a press, to say how sure it is before
 * a walk starts. It stops at the first sure reading, or after eight seconds with the best it got.
 * Nothing is kept and nothing is sent: the reading lives in this hook until the sheet closes.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { PAINT_POOR_FIX_METERS } from '../lib/paintedMap/paintedTrack'

export type LocationCheck = {
  status: 'idle' | 'checking' | 'done' | 'refused' | 'none' | 'failed'
  /** The best margin so far, in metres. */
  accuracyM: number | null
  check: () => void
}

const CHECK_MS = 8000

export function useLocationCheck(): LocationCheck {
  const [status, setStatus] = useState<LocationCheck['status']>('idle')
  const [accuracyM, setAccuracyM] = useState<number | null>(null)
  const watchId = useRef<number | null>(null)
  const timer = useRef<number | null>(null)

  const stop = useCallback(() => {
    if (watchId.current != null && typeof navigator !== 'undefined' && navigator.geolocation) navigator.geolocation.clearWatch(watchId.current)
    watchId.current = null
    if (timer.current != null) window.clearTimeout(timer.current)
    timer.current = null
  }, [])

  useEffect(() => stop, [stop])

  const check = useCallback(() => {
    stop()
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setStatus('none')
      return
    }
    setAccuracyM(null)
    setStatus('checking')
    let best: number | null = null
    watchId.current = navigator.geolocation.watchPosition(
      (pos) => {
        const m = Number.isFinite(pos.coords.accuracy) ? pos.coords.accuracy : null
        if (m != null && (best == null || m < best)) {
          best = m
          setAccuracyM(m)
        }
        if (best != null && best <= PAINT_POOR_FIX_METERS) {
          stop()
          setStatus('done')
        }
      },
      (err) => {
        if (err.code === 1) {
          stop()
          setStatus('refused')
        }
      },
      { enableHighAccuracy: true, maximumAge: 0, timeout: CHECK_MS },
    )
    timer.current = window.setTimeout(() => {
      stop()
      setStatus(best == null ? 'failed' : 'done')
    }, CHECK_MS)
  }, [stop])

  return { status, accuracyM, check }
}
