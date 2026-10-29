/** Where the phone stands, for pinning a box on the site map (punch list #209). No map code here, so the tally bundle stays light. */
export type LatLng = { lat: number; lng: number }

/** Asks the device where it is. `onErr` gets a sentence a person can act on. */
export function requestMyLocation(onOk: (p: LatLng) => void, onErr: (words: string) => void): void {
  if (typeof navigator === 'undefined' || !navigator.geolocation) {
    onErr('This device gives no location. Drag the map by hand.')
    return
  }
  navigator.geolocation.getCurrentPosition(
    (pos) => onOk({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
    (err) => onErr(err.code === 1 ? 'Location is off for this app. Drag the map by hand, or allow location in the phone’s settings.' : 'Could not find you. Drag the map by hand.'),
    { enableHighAccuracy: true, timeout: 8000 },
  )
}
