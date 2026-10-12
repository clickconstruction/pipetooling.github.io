import { createContext, useContext } from 'react'
import { BILL_DAY_CUTOFF_DAYS } from '../../lib/gc/billDay/trades'

/**
 * GC mode, the trade partner portal (Messages cut 9): the trades' cut-off, the days before bill day a pay application
 * is due, as the portal's read carries it (`billDayCutoffDays`). The page sets it once; the pay application's door reads
 * it here. Unset (the office's preview, an older read): the default.
 */
export const PortalBillDayContext = createContext<number | null>(null)

export function usePortalCutoffDays(): number {
  return useContext(PortalBillDayContext) ?? BILL_DAY_CUTOFF_DAYS
}
