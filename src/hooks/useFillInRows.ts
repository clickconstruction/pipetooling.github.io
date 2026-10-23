import { useCallback, useEffect, useState } from 'react'
import type { UserRole } from './useAuth'
import { needsYouSourceEnabled } from '../lib/needsYouSources'
import { fillInRowsOrdered, type FillInKind } from '../lib/needsYou/fillIn'
import { compareLostBidRows, lostBidFillInRows, type LostBidFillInRow } from '../lib/needsYou/fillInLostBids'
import { lostBidFillInIo, type LostBidFillInIo } from '../lib/needsYou/fillInLostBidsIo'
import { compareVehicleRows, vehicleFillInRows, type VehicleFillInRow } from '../lib/needsYou/fillInVehicles'
import { vehicleFillInIo, type VehicleFillInIo } from '../lib/needsYou/fillInVehiclesIo'

/** The rows the deck can fill, every kind built so far. */
export type FillInRow = LostBidFillInRow | VehicleFillInRow

export type FillInIo = { lostBids: LostBidFillInIo; vehicles: VehicleFillInIo }

/** One object for the default io, so the read effect does not re-run on every render. */
const DEFAULT_IO: FillInIo = { lostBids: lostBidFillInIo, vehicles: vehicleFillInIo }

/** Each kind's rows back in their own order after a restore. */
function ordered(rows: readonly FillInRow[]): FillInRow[] {
  const lost = rows.filter((r): r is LostBidFillInRow => r.kind === 'lost-bid').sort(compareLostBidRows)
  const vehicles = rows.filter((r): r is VehicleFillInRow => r.kind === 'vehicle').sort(compareVehicleRows)
  return fillInRowsOrdered<FillInRow>({ 'lost-bid': lost, vehicle: vehicles })
}

/**
 * The rows behind the Fill them in deck (v2.5774, punch list #145): each kind's rows read
 * under the same gate as its Needs you line, ordered as the deck walks them. `drop` takes a
 * saved row off the list at once and `restore` puts it back on Undo, so the deck never waits
 * on a reload; `reload` re-reads every kind (the window's focus, a save elsewhere).
 */
export function useFillInRows(role: UserRole | null, enabled: boolean, io: FillInIo = DEFAULT_IO): {
  rows: FillInRow[]
  loading: boolean
  reload: () => void
  drop: (key: string) => void
  restore: (row: FillInRow) => void
} {
  const kindsOn: Record<Extract<FillInKind, 'lost-bid' | 'vehicle'>, boolean> = {
    'lost-bid': enabled && needsYouSourceEnabled('lostBids', role, 'quickfill'),
    vehicle: enabled && needsYouSourceEnabled('vehicleRecordGaps', role, 'quickfill'),
  }
  const lostBidsOn = kindsOn['lost-bid']
  const vehiclesOn = kindsOn.vehicle
  const [rows, setRows] = useState<FillInRow[]>([])
  const [loading, setLoading] = useState(false)
  const [nonce, setNonce] = useState(0)

  useEffect(() => {
    if (!lostBidsOn && !vehiclesOn) {
      setRows([])
      setLoading(false)
      return
    }
    let cancelled = false
    setLoading(true)
    void (async () => {
      // Each kind fails soft on its own: a refused read leaves that kind empty and the others whole.
      const [lostBids, vehicles] = await Promise.all([
        lostBidsOn ? io.lostBids.fetchSources().then(lostBidFillInRows).catch(() => [] as LostBidFillInRow[]) : Promise.resolve([] as LostBidFillInRow[]),
        vehiclesOn ? Promise.all([io.vehicles.fetchGaps(), io.vehicles.fetchPlans()]).then(([gaps, plans]) => vehicleFillInRows(gaps, plans)).catch(() => [] as VehicleFillInRow[]) : Promise.resolve([] as VehicleFillInRow[]),
      ])
      if (cancelled) return
      setRows(fillInRowsOrdered<FillInRow>({ 'lost-bid': lostBids, vehicle: vehicles }))
      setLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [lostBidsOn, vehiclesOn, nonce, io])

  const reload = useCallback(() => setNonce((n) => n + 1), [])
  const drop = useCallback((key: string) => setRows((prev) => prev.filter((r) => r.key !== key)), [])
  const restore = useCallback((row: FillInRow) => setRows((prev) => (prev.some((r) => r.key === row.key) ? prev : ordered([...prev, row]))), [])

  return { rows, loading, reload, drop, restore }
}
