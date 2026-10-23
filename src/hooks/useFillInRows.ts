import { useCallback, useEffect, useState } from 'react'
import type { UserRole } from './useAuth'
import { needsYouSourceEnabled } from '../lib/needsYouSources'
import { fillInRowsOrdered, type FillInKind } from '../lib/needsYou/fillIn'
import { compareLostBidRows, lostBidFillInRows, type LostBidFillInRow } from '../lib/needsYou/fillInLostBids'
import { lostBidFillInIo, type LostBidFillInIo } from '../lib/needsYou/fillInLostBidsIo'
import { compareVehicleRows, vehicleFillInRows, type VehicleFillInRow } from '../lib/needsYou/fillInVehicles'
import { vehicleFillInIo, type VehicleFillInIo } from '../lib/needsYou/fillInVehiclesIo'
import { compareJobAccountRows, jobAccountFillInRows, type JobAccountFillInRow } from '../lib/needsYou/fillInJobAccounts'
import { jobAccountFillInIo, type JobAccountFillInIo } from '../lib/needsYou/fillInJobAccountsIo'
import { compareContractRows, contractFillInRows, type ContractFillInRow } from '../lib/needsYou/fillInContracts'
import { contractFillInIo, type ContractFillInIo } from '../lib/needsYou/fillInContractsIo'

/** The rows the deck can fill, every kind built so far. */
export type FillInRow = LostBidFillInRow | VehicleFillInRow | JobAccountFillInRow | ContractFillInRow

export type FillInIo = { lostBids: LostBidFillInIo; vehicles: VehicleFillInIo; jobAccounts: JobAccountFillInIo; contracts: ContractFillInIo }

/** One object for the default io, so the read effect does not re-run on every render. */
const DEFAULT_IO: FillInIo = { lostBids: lostBidFillInIo, vehicles: vehicleFillInIo, jobAccounts: jobAccountFillInIo, contracts: contractFillInIo }

/** Each kind's rows back in their own order after a restore. */
function ordered(rows: readonly FillInRow[]): FillInRow[] {
  const lost = rows.filter((r): r is LostBidFillInRow => r.kind === 'lost-bid').sort(compareLostBidRows)
  const vehicles = rows.filter((r): r is VehicleFillInRow => r.kind === 'vehicle').sort(compareVehicleRows)
  const jobAccounts = rows.filter((r): r is JobAccountFillInRow => r.kind === 'job-account').sort(compareJobAccountRows)
  const contracts = rows.filter((r): r is ContractFillInRow => r.kind === 'contract').sort(compareContractRows)
  return fillInRowsOrdered<FillInRow>({ 'lost-bid': lost, vehicle: vehicles, 'job-account': jobAccounts, contract: contracts })
}

/**
 * The rows behind the Fill them in deck (v2.5774, punch list #146): each kind's rows read
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
  const kindsOn: Record<FillInKind, boolean> = {
    'lost-bid': enabled && needsYouSourceEnabled('lostBids', role, 'quickfill'),
    vehicle: enabled && needsYouSourceEnabled('vehicleRecordGaps', role, 'quickfill'),
    'job-account': enabled && needsYouSourceEnabled('jobAccountGaps', role, 'quickfill'),
    contract: enabled && needsYouSourceEnabled('contracts', role, 'quickfill'),
  }
  const lostBidsOn = kindsOn['lost-bid']
  const vehiclesOn = kindsOn.vehicle
  const jobAccountsOn = kindsOn['job-account']
  const contractsOn = kindsOn.contract
  const [rows, setRows] = useState<FillInRow[]>([])
  const [loading, setLoading] = useState(false)
  const [nonce, setNonce] = useState(0)

  useEffect(() => {
    if (!lostBidsOn && !vehiclesOn && !jobAccountsOn && !contractsOn) {
      setRows([])
      setLoading(false)
      return
    }
    let cancelled = false
    setLoading(true)
    void (async () => {
      // Each kind fails soft on its own: a refused read leaves that kind empty and the others whole.
      const [lostBids, vehicles, jobAccounts, contracts] = await Promise.all([
        lostBidsOn ? io.lostBids.fetchSources().then(lostBidFillInRows).catch(() => [] as LostBidFillInRow[]) : Promise.resolve([] as LostBidFillInRow[]),
        vehiclesOn ? Promise.all([io.vehicles.fetchGaps(), io.vehicles.fetchPlans()]).then(([gaps, plans]) => vehicleFillInRows(gaps, plans)).catch(() => [] as VehicleFillInRow[]) : Promise.resolve([] as VehicleFillInRow[]),
        jobAccountsOn
          ? io.jobAccounts
              .fetchGaps()
              .then(async (gaps) => jobAccountFillInRows(gaps, await io.jobAccounts.fetchJobs([...new Set(gaps.map((g) => g.job_id))])))
              .catch(() => [] as JobAccountFillInRow[])
          : Promise.resolve([] as JobAccountFillInRow[]),
        contractsOn
          ? io.contracts
              .fetchSources()
              .then((s) => contractFillInRows({ ...s, now: new Date() }))
              .catch(() => [] as ContractFillInRow[])
          : Promise.resolve([] as ContractFillInRow[]),
      ])
      if (cancelled) return
      setRows(fillInRowsOrdered<FillInRow>({ 'lost-bid': lostBids, vehicle: vehicles, 'job-account': jobAccounts, contract: contracts }))
      setLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [lostBidsOn, vehiclesOn, jobAccountsOn, contractsOn, nonce, io])

  const reload = useCallback(() => setNonce((n) => n + 1), [])
  const drop = useCallback((key: string) => setRows((prev) => prev.filter((r) => r.key !== key)), [])
  const restore = useCallback((row: FillInRow) => setRows((prev) => (prev.some((r) => r.key === row.key) ? prev : ordered([...prev, row]))), [])

  return { rows, loading, reload, drop, restore }
}
