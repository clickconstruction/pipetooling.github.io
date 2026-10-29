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
import { compareContractMissingRows, contractMissingFillInRows, type ContractMissingFillInRow } from '../lib/needsYou/fillInContractsMissing'
import { contractMissingFillInIo, type ContractMissingFillInIo } from '../lib/needsYou/fillInContractsMissingIo'
import { comparePurchaseRows, purchaseFillInRows, type PurchaseFillInRow } from '../lib/needsYou/fillInPurchases'
import { purchaseFillInIo, type PurchaseFillInIo } from '../lib/needsYou/fillInPurchasesIo'

/** The rows the deck can fill, every kind built so far. */
export type FillInRow = LostBidFillInRow | VehicleFillInRow | JobAccountFillInRow | ContractFillInRow | ContractMissingFillInRow | PurchaseFillInRow

export type FillInIo = {
  lostBids: LostBidFillInIo
  vehicles: VehicleFillInIo
  jobAccounts: JobAccountFillInIo
  contracts: ContractFillInIo
  /** Optional for the smokes that came before the kind (v2.5844); the app's io when absent. */
  contractsMissing?: ContractMissingFillInIo
  /** Optional the same way (v2.6071, punch list #178). */
  purchases?: PurchaseFillInIo
}

/** One object for the default io, so the read effect does not re-run on every render. */
const DEFAULT_IO: FillInIo = { lostBids: lostBidFillInIo, vehicles: vehicleFillInIo, jobAccounts: jobAccountFillInIo, contracts: contractFillInIo, contractsMissing: contractMissingFillInIo, purchases: purchaseFillInIo }

/** Each kind's rows back in their own order after a restore. */
function ordered(rows: readonly FillInRow[]): FillInRow[] {
  const lost = rows.filter((r): r is LostBidFillInRow => r.kind === 'lost-bid').sort(compareLostBidRows)
  const vehicles = rows.filter((r): r is VehicleFillInRow => r.kind === 'vehicle').sort(compareVehicleRows)
  const jobAccounts = rows.filter((r): r is JobAccountFillInRow => r.kind === 'job-account').sort(compareJobAccountRows)
  const contracts = rows.filter((r): r is ContractFillInRow => r.kind === 'contract').sort(compareContractRows)
  const missing = rows.filter((r): r is ContractMissingFillInRow => r.kind === 'contract-missing').sort(compareContractMissingRows)
  const purchases = rows.filter((r): r is PurchaseFillInRow => r.kind === 'purchase').sort(comparePurchaseRows)
  return fillInRowsOrdered<FillInRow>({ 'lost-bid': lost, vehicle: vehicles, 'job-account': jobAccounts, contract: contracts, 'contract-missing': missing, purchase: purchases })
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
    'contract-missing': enabled && needsYouSourceEnabled('contracts', role, 'quickfill'),
    // The viewer's own card purchases (v2.6071): the line's gate is any signed-in role.
    purchase: enabled && needsYouSourceEnabled('tally', role, 'quickfill'),
  }
  const lostBidsOn = kindsOn['lost-bid']
  const vehiclesOn = kindsOn.vehicle
  const jobAccountsOn = kindsOn['job-account']
  const contractsOn = kindsOn.contract
  const purchasesOn = kindsOn.purchase
  const [rows, setRows] = useState<FillInRow[]>([])
  const [loading, setLoading] = useState(false)
  const [nonce, setNonce] = useState(0)

  useEffect(() => {
    if (!lostBidsOn && !vehiclesOn && !jobAccountsOn && !contractsOn && !purchasesOn) {
      setRows([])
      setLoading(false)
      return
    }
    let cancelled = false
    setLoading(true)
    void (async () => {
      // Each kind fails soft on its own: a refused read leaves that kind empty and the others whole.
      const [lostBids, vehicles, jobAccounts, contracts, contractsMissing, purchases] = await Promise.all([
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
        contractsOn
          ? (io.contractsMissing ?? contractMissingFillInIo)
              .fetchSources()
              .then((s) => contractMissingFillInRows({ ...s, now: new Date() }))
              .catch(() => [] as ContractMissingFillInRow[])
          : Promise.resolve([] as ContractMissingFillInRow[]),
        purchasesOn
          ? (io.purchases ?? purchaseFillInIo)
              .fetchSources()
              .then((s) => purchaseFillInRows({ ...s, nowMs: Date.now() }))
              .catch(() => [] as PurchaseFillInRow[])
          : Promise.resolve([] as PurchaseFillInRow[]),
      ])
      if (cancelled) return
      setRows(fillInRowsOrdered<FillInRow>({ 'lost-bid': lostBids, vehicle: vehicles, 'job-account': jobAccounts, contract: contracts, 'contract-missing': contractsMissing, purchase: purchases }))
      setLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [lostBidsOn, vehiclesOn, jobAccountsOn, contractsOn, purchasesOn, nonce, io])

  const reload = useCallback(() => setNonce((n) => n + 1), [])
  const drop = useCallback((key: string) => setRows((prev) => prev.filter((r) => r.key !== key)), [])
  const restore = useCallback((row: FillInRow) => setRows((prev) => (prev.some((r) => r.key === row.key) ? prev : ordered([...prev, row]))), [])

  return { rows, loading, reload, drop, restore }
}
