/**
 * What customers owe us before a stage starts, for the Dashboard's Needs you (punch list #382, PR 6). The sources are
 * read once. A site that reads the default notice needs its distance from the shop, by the Trips look's own rule, so
 * those sites' addresses are placed, and only those. A read that fails leaves no line.
 */
import { useEffect, useMemo, useState } from 'react'
import { normalizeAddressForGeocodeKey } from '../lib/map/normalizeAddressForGeocode'
import { sitesOnDefaultNotice, startAnswersOwed, type StartAnswersOwed, type StartOwedSources } from '../lib/needsYou/startAnswersOwed'
import { startAnswersOwedIo, type StartAnswersOwedIo } from '../lib/needsYou/startAnswersOwedIo'
import { resolveOfficeAnchor } from '../lib/officeAddressSettings'
import { readTripFarMiles } from '../lib/trips/tripsIo'
import { milesFromShop, siteIsFar, TRIP_FAR_MILES_DEFAULT } from '../lib/trips/tripPlace'
import { calendarYmdInAppTzFromIso, todayYmdInAppTz } from '../utils/dateUtils'
import { useAddressGeocodeCoords } from './useAddressGeocodeCoords'

type LatLng = { lat: number; lng: number }

export function useStartAnswersOwed(enabled: boolean, io: StartAnswersOwedIo = startAnswersOwedIo): { owed: StartAnswersOwed | null } {
  const [sources, setSources] = useState<StartOwedSources | null>(null)
  const [shop, setShop] = useState<{ point: LatLng | null; farMiles: number } | null>(null)
  useEffect(() => {
    if (!enabled) {
      setSources(null)
      return
    }
    let cancelled = false
    io.fetchSources().then(
      (s) => !cancelled && setSources(s),
      () => !cancelled && setSources(null),
    )
    return () => {
      cancelled = true
    }
  }, [enabled, io])

  const onDefault = useMemo(() => (sources ? sitesOnDefaultNotice(sources) : []), [sources])
  const addresses = useMemo(() => onDefault.map((s) => ({ key: normalizeAddressForGeocodeKey(s.address), display: s.address })), [onDefault])
  const geo = useAddressGeocodeCoords(addresses, enabled && addresses.length > 0, 'answers owed site points')
  const needsShop = enabled && addresses.length > 0
  useEffect(() => {
    if (!needsShop) return
    let cancelled = false
    Promise.all([resolveOfficeAnchor(), readTripFarMiles().catch(() => TRIP_FAR_MILES_DEFAULT)]).then(
      ([anchor, farMiles]) => !cancelled && setShop({ point: anchor ? { lat: anchor.lat, lng: anchor.lng } : null, farMiles }),
      () => undefined,
    )
    return () => {
      cancelled = true
    }
  }, [needsShop])

  const owed = useMemo(() => {
    if (!sources) return null
    const far = new Set<string>()
    if (shop) for (const s of onDefault) if (siteIsFar(milesFromShop(shop.point, geo.coords.get(normalizeAddressForGeocodeKey(s.address)) ?? null), shop.farMiles)) far.add(s.key)
    return startAnswersOwed(sources, todayYmdInAppTz(), far, calendarYmdInAppTzFromIso)
  }, [sources, shop, onDefault, geo.coords])
  return { owed }
}
