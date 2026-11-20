/**
 * Whether a site is far from the shop: a trip from home. The rule is the Trips look's own (`siteIsFar`): the site's
 * address as a point, the shop's point, and the one setting for how many miles is far. Before we start (#382) reads
 * it for the days of notice a site needs by default, ten when it is far and two when it is near. Until the three
 * are in, and for an address that cannot be placed, the site reads near.
 */
import { useEffect, useMemo, useState } from 'react'
import { resolveOfficeAnchor } from '../lib/officeAddressSettings'
import { normalizeAddressForGeocodeKey } from '../lib/map/normalizeAddressForGeocode'
import { readTripFarMiles } from '../lib/trips/tripsIo'
import { milesFromShop, siteIsFar, TRIP_FAR_MILES_DEFAULT } from '../lib/trips/tripPlace'
import { useAddressGeocodeCoords } from './useAddressGeocodeCoords'

type LatLng = { lat: number; lng: number }

export function useSiteIsFar(address: string | null | undefined, enabled = true): boolean {
  const [shop, setShop] = useState<LatLng | null>(null)
  const [farMiles, setFarMiles] = useState(TRIP_FAR_MILES_DEFAULT)
  const addresses = useMemo(() => (address && address.trim() ? [{ key: normalizeAddressForGeocodeKey(address), display: address.trim() }] : []), [address])
  const geo = useAddressGeocodeCoords(addresses, enabled && addresses.length > 0, 'start checks site point')
  const sitePoint = addresses[0] ? (geo.coords.get(addresses[0].key) ?? null) : null

  useEffect(() => {
    if (!enabled) return
    let live = true
    // The shop and the setting land together, so a site is never called far by the default while the setting is on its way.
    Promise.all([resolveOfficeAnchor(), readTripFarMiles().catch(() => TRIP_FAR_MILES_DEFAULT)]).then(
      ([anchor, far]) => {
        if (!live) return
        setFarMiles(far)
        setShop(anchor ? { lat: anchor.lat, lng: anchor.lng } : null)
      },
      () => undefined,
    )
    return () => {
      live = false
    }
  }, [enabled])

  return siteIsFar(milesFromShop(shop, sitePoint), farMiles)
}
