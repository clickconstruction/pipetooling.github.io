import { useEffect, useMemo, useState } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { normalizeAddressForGeocodeKey } from '../lib/map/normalizeAddressForGeocode'
import { countyAt } from '../lib/legal/countyAt'
import { shapeMapCases, type LegalMapCase, type MapAccount } from '../lib/legal/firmMap'
import { loadTxCounties } from '../lib/legal/txCountyMapIo'
import type { CountyFeatureCollection } from '../lib/legal/txCountyMap'
import type { LegalMatterRow } from '../lib/legal/legalMatters'
import { useAddressGeocodeCoords, type AddressToGeocode } from './useAddressGeocodeCoords'

const db = supabase as unknown as SupabaseClient

export type LegalMapCasesInput = {
  /** The desk's Collections accounts (not given up on). */
  accounts: ReadonlyArray<MapAccount>
  /** The accounts under Given up on. */
  givenUp: ReadonlyArray<MapAccount>
  byPayerKey: ReadonlyMap<string, Pick<LegalMatterRow, 'stage' | 'closed_at' | 'firm_id' | 'released_at'>>
  firmNames: ReadonlyMap<string, string>
}

/**
 * The accounts as cases on the county map (punch list #144): each account's first job geocoded
 * from the shared cache, the property record's county when it has one, else the county the
 * point falls in. Pure shaping in `legal/firmMap.ts`; this hook only gathers. Since v2.5784 the
 * desk's Map and the Settings picker (`useLegalFirmMapCases`) share it, so the two never place a
 * case differently. Reads nothing until `enabled`.
 */
export function useLegalMapCases(input: LegalMapCasesInput, enabled: boolean): { cases: LegalMapCase[]; loading: boolean; counties: CountyFeatureCollection | null } {
  const { accounts, givenUp, byPayerKey, firmNames } = input
  const [counties, setCounties] = useState<CountyFeatureCollection | null>(null)
  const [recordCounty, setRecordCounty] = useState<Map<string, string | null>>(() => new Map())

  useEffect(() => {
    if (!enabled) return
    let live = true
    loadTxCounties().then(
      (fc) => {
        if (live) setCounties(fc)
      },
      () => {},
    )
    return () => {
      live = false
    }
  }, [enabled])

  const addresses = useMemo<AddressToGeocode[]>(() => {
    const out: AddressToGeocode[] = []
    for (const acc of [...accounts, ...givenUp]) {
      const display = (acc.jobs[0]?.job_address ?? '').trim()
      if (display) out.push({ key: normalizeAddressForGeocodeKey(display), display })
    }
    return out
  }, [accounts, givenUp])
  const { coords, resolving } = useAddressGeocodeCoords(addresses, enabled, 'legal map address_geocodes')

  const recordIds = useMemo(() => {
    const ids = new Set<string>()
    for (const acc of [...accounts, ...givenUp]) {
      const id = acc.jobs[0]?.customer_address_id
      if (id) ids.add(id)
    }
    return [...ids].sort().join('\n')
  }, [accounts, givenUp])
  useEffect(() => {
    if (!enabled || !recordIds) return
    let live = true
    void (async () => {
      const { data } = await db.from('customer_addresses').select('id, county').in('id', recordIds.split('\n'))
      if (!live) return
      setRecordCounty(new Map(((data ?? []) as Array<{ id: string; county: string | null }>).map((r) => [r.id, r.county])))
    })()
    return () => {
      live = false
    }
  }, [enabled, recordIds])

  const cases = useMemo(() => {
    if (!enabled) return []
    const countyOf = (lng: number, lat: number) => (counties ? countyAt(counties, lng, lat) : null)
    return shapeMapCases({ accounts, givenUp, byPayerKey, firmNames, coords, recordCounty, countyOf })
  }, [enabled, accounts, givenUp, byPayerKey, firmNames, coords, recordCounty, counties])

  return { cases, loading: enabled && (resolving || !counties), counties }
}
