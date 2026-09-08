/**
 * Coordinates for the Dashboard "Your jobs on a map" card (v2.3131).
 *
 * The lookup itself — `address_geocodes` cache in batches, then
 * `geocode-address-batch` for the cold ones in chunks of 20 — lives in
 * `useAddressGeocodeCoords` since v2.3162 (the Bid Board map shares it). This
 * hook turns the Dashboard's job lists into that hook's address list and the
 * answers back into pins. Nothing here is fatal: a failed geocode leaves the
 * job in the "no map location yet" line.
 */
import { useMemo } from 'react'
import { useAddressGeocodeCoords, type AddressToGeocode } from './useAddressGeocodeCoords'
import {
  dashboardJobsMapJobs,
  resolveDashboardJobsMapPins,
  type DashboardJobsMapJob,
  type DashboardJobsMapPin,
} from '../lib/dashboardJobsMap'
import type { DashboardTeamAssignedJobRow } from '../lib/dashboardTeamAssignedJobRow'

export type DashboardJobsMapPinsState = {
  pins: DashboardJobsMapPin[]
  /** Jobs with an address the cache and the geocoder could not place (yet). */
  unmapped: DashboardJobsMapJob[]
  /** Jobs with no address at all — never sent to the geocoder. */
  noAddress: DashboardJobsMapJob[]
  /** True while the cache read or a geocode chunk is still in flight. */
  resolving: boolean
  /** Every job the card knows about, mapped or not. */
  total: number
}

export function useDashboardJobsMapPins(
  assignedJobs: readonly DashboardTeamAssignedJobRow[],
  superintendentJobs: readonly DashboardTeamAssignedJobRow[],
  enabled: boolean,
): DashboardJobsMapPinsState {
  const { jobs, noAddress } = useMemo(() => dashboardJobsMapJobs(assignedJobs, superintendentJobs), [assignedJobs, superintendentJobs])
  const addresses = useMemo<AddressToGeocode[]>(() => jobs.map((j) => ({ key: j.addressKey, display: j.address })), [jobs])
  const { coords, resolving } = useAddressGeocodeCoords(addresses, enabled, 'dashboard jobs map address_geocodes')

  return useMemo(() => {
    const { pins, unmapped } = resolveDashboardJobsMapPins(jobs, coords)
    return { pins, unmapped, noAddress, resolving, total: jobs.length + noAddress.length }
  }, [jobs, noAddress, coords, resolving])
}
