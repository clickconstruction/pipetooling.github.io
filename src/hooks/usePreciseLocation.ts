/**
 * The browser around the Precise Location line (punch list #402): which phone this is, and the wait
 * before a rough reading is called rough. The thresholds and the words are `preciseLocation.ts`.
 */
import { useEffect, useState } from 'react'
import { isStandalonePwa } from '../lib/iosPwa'
import { isRoughFix } from '../lib/paintedMap/paintedTrack'
import { PRECISE_ROUGH_HOLD_MS, phoneKindOf, type PhoneKind } from '../lib/paintedMap/preciseLocation'

function readPhoneKind(): PhoneKind {
  if (typeof navigator === 'undefined') return 'other'
  return phoneKindOf({ userAgent: navigator.userAgent || '', standalone: isStandalonePwa(), touchPoints: navigator.maxTouchPoints || 0 })
}

/** Which phone and browser this is, read once: it does not change while a page is open. */
export function usePhoneKind(): PhoneKind {
  const [kind] = useState(readPhoneKind)
  return kind
}

/**
 * Have the readings stayed rough for the wait? A phone with the switch on can open with one reading
 * off a cell tower, and a better one follows within seconds. So a screen that follows the phone
 * says nothing of a rough reading until the readings have stayed rough for `PRECISE_ROUGH_HOLD_MS`.
 *
 * The answer is held in state. When the readings turn rough an effect starts one timer, and the
 * timer sets the state. A better reading, or no reading, clears both. Nothing here reads the clock,
 * so the answer cannot change between two draws of the same reading.
 *
 * `accuracyM` is the newest reading's margin, or null while the phone is not being read. Hand null
 * across a pause: the wait then starts over when the reading starts again.
 */
export function useRoughHeld(accuracyM: number | null | undefined): boolean {
  const rough = isRoughFix(accuracyM)
  const [held, setHeld] = useState(false)
  useEffect(() => {
    if (!rough) return
    const timer = window.setTimeout(() => setHeld(true), PRECISE_ROUGH_HOLD_MS)
    return () => {
      window.clearTimeout(timer)
      setHeld(false)
    }
  }, [rough])
  return rough && held
}
