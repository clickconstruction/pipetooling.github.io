/** Where the phone stands, for pinning a box on the site map (punch list #209). No map code here, so the tally bundle stays light. */
export type LatLng = { lat: number; lng: number }

/** A reading: the point, and the phone's own margin in metres when it gave one (a task's place keeps it, punch list #328). */
export type MyFix = LatLng & { accuracyM: number | null }

/** Why a reading did not come: the device has none to give, the person or the phone said no, or it was not found in time. */
export type MyFixFailure = 'none' | 'refused' | 'failed'

/**
 * Asks the device where it is, once. One reading on one call: nothing here follows a phone. The
 * caller owns the words, since what to do next differs by screen (`requestMyLocation` has the box
 * map's, `taskPlaceNoFixWords` a task's).
 */
export function requestMyFix(onOk: (p: MyFix) => void, onFail: (why: MyFixFailure) => void): void {
  if (typeof navigator === 'undefined' || !navigator.geolocation) {
    onFail('none')
    return
  }
  navigator.geolocation.getCurrentPosition(
    (pos) => onOk({ lat: pos.coords.latitude, lng: pos.coords.longitude, accuracyM: Number.isFinite(pos.coords.accuracy) ? pos.coords.accuracy : null }),
    (err) => onFail(err.code === 1 ? 'refused' : 'failed'),
    { enableHighAccuracy: true, timeout: 8000 },
  )
}

const BOX_MAP_WORDS: Record<MyFixFailure, string> = {
  none: 'This device gives no location. Drag the map by hand.',
  refused: 'Location is off for this app. Drag the map by hand, or allow location in the phone’s settings.',
  failed: 'Could not find you. Drag the map by hand.',
}

/** Asks the device where it is. `onErr` gets a sentence a person can act on. */
export function requestMyLocation(onOk: (p: MyFix) => void, onErr: (words: string) => void): void {
  requestMyFix(onOk, (why) => onErr(BOX_MAP_WORDS[why]))
}
