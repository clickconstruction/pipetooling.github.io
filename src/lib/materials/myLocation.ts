/** Where the phone stands, for pinning a box on the site map (punch list #209). No map code here, so the tally bundle stays light. */
export type LatLng = { lat: number; lng: number }

/** A reading: the point, and the phone's own margin in metres when it gave one (a task's place keeps it, punch list #328). */
export type MyFix = LatLng & { accuracyM: number | null }

/** Asks the device where it is. `onErr` gets a sentence a person can act on. */
export function requestMyLocation(onOk: (p: MyFix) => void, onErr: (words: string) => void): void {
  if (typeof navigator === 'undefined' || !navigator.geolocation) {
    onErr('This device gives no location. Drag the map by hand.')
    return
  }
  navigator.geolocation.getCurrentPosition(
    (pos) => onOk({ lat: pos.coords.latitude, lng: pos.coords.longitude, accuracyM: Number.isFinite(pos.coords.accuracy) ? pos.coords.accuracy : null }),
    (err) => onErr(err.code === 1 ? 'Location is off for this app. Drag the map by hand, or allow location in the phone’s settings.' : 'Could not find you. Drag the map by hand.'),
    { enableHighAccuracy: true, timeout: 8000 },
  )
}
