/**
 * Photo of a spot (punch list #413): the one reading of the phone a spot is given. Asked once, on
 * the press that opens the camera, so the reading is of the moment the photo was taken. The rules
 * are `paintedSpot.ts`'s. This file only asks.
 */
import { requestMyFix } from '../materials/myLocation'
import type { SpotReading } from './paintedSpot'

/** Asks the phone where it is, once. It always answers: with a reading, or with why none came. */
export function readSpotNow(): Promise<SpotReading> {
  return new Promise((resolve) => {
    requestMyFix(
      (fix) => resolve({ ok: true, fix }),
      (why) => resolve({ ok: false, why }),
    )
  })
}
