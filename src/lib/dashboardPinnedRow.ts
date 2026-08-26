/**
 * Pure logic for the Dashboard banners + tally + quick actions + pins row
 * (rendered by DashboardPinnedQuickRow). Extracted from Dashboard.tsx —
 * behavior-preserving; see docs/DASHBOARD_SECTIONS_ARCHITECTURE.md §3.
 */

import type { PinnedItem } from './pinnedTabs'
import type { UserRole } from '../hooks/useAuth'
import { isPathAllowedForRole } from './layoutRouteAccess'

/**
 * Role-filters the pin chips through the same allowlists Layout's redirect guard uses
 * (v2.2325 — this file previously kept its own narrower path sets, which hid legitimate
 * pins). When role is null (auth still loading), treat as primary to prevent flash.
 */
export function filterPinnedByRole(pins: PinnedItem[], role: string | null, estimatorProspectsAccess?: boolean): PinnedItem[] {
  const effectiveRole = (role ?? 'primary') as UserRole
  return pins.filter((p) => isPathAllowedForRole(effectiveRole, p.path, estimatorProspectsAccess ?? false))
}

/** Pins actually shown as chips: Dashboard/self links and the External Team pin are excluded. */
export function filterPinsToShow(visiblePins: PinnedItem[]): PinnedItem[] {
  return visiblePins
    .filter((p) => p.path !== '/dashboard' && p.path !== '/')
    .filter((p) => !(p.path === '/materials' && p.tab === 'external-team'))
}

/** Live totals from the financial pin hooks (null while loading / when the pin is absent). */
export interface PinnedRowFinancialTotals {
  costMatrixTotal: number | null
  billedCount: number | null
  billedTotal: number | null
  supplyHousesAPTotal: number | null
  subLaborDueTotal: number | null
}

/**
 * Route + display label for one pinned chip. Financial pins (Internal Team /
 * Billed Awaiting Payment / Supply Houses / Sub Labor Due) show live totals,
 * falling back to the stored label (or a loading label for Billed) while null.
 */
export function getPinnedChipDisplay(
  item: PinnedItem,
  totals: PinnedRowFinancialTotals,
): { to: string; label: string } {
  const isCostMatrix = item.path === '/people' && item.tab === 'hours'
  const isSupplyHouseAP = item.path === '/materials' && item.tab === 'supply-houses'
  const isBilled = item.path === '/jobs' && item.tab === 'billed'
  const isSubLaborDue = item.path === '/jobs' && item.tab === 'sub_sheet_ledger'
  // Bid-scoped pin (v2.1335): deep-link straight to the bid on its tab.
  if (item.path === '/bids' && item.bidId) {
    const params = new URLSearchParams()
    if (item.tab) params.set('tab', item.tab)
    params.set('bidId', item.bidId)
    return {
      to: `/bids?${params.toString()}`,
      label: item.tab ? `${item.label} · ${item.tab.replace(/-/g, ' ').replace(/_/g, ' ')}` : item.label,
    }
  }
  const to = item.tab
    ? isSubLaborDue
      ? '/jobs?tab=sub_sheet_ledger'
      : `${item.path}?tab=${encodeURIComponent(isBilled ? 'stages' : item.tab)}${isBilled ? '&showBilledTotalByName=true' : ''}`
    : item.path
  const label = isCostMatrix
    ? (totals.costMatrixTotal != null ? `Internal Team: $${Math.round(totals.costMatrixTotal).toLocaleString('en-US')}` : item.label)
    : isBilled
      ? (totals.billedCount != null && totals.billedTotal != null ? `Billed Awaiting Payment (${totals.billedCount}): $${totals.billedTotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : 'Billed Awaiting Payment…')
      : isSupplyHouseAP
        ? (totals.supplyHousesAPTotal != null ? `Supply Houses: $${Math.round(totals.supplyHousesAPTotal).toLocaleString('en-US')}` : item.label)
        : isSubLaborDue
          ? (totals.subLaborDueTotal != null ? `Sub Labor Due: $${totals.subLaborDueTotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : item.label)
          : (item.tab ? `${item.label} · ${item.tab.replace(/-/g, ' ').replace(/_/g, ' ')}` : item.label)
  return { to, label }
}

/** Accessible name for the tally icon link, including the unlinked-transaction badge count. */
export function getTallyLinkAccessibleName(tallyUnlinkedCount: number | null): string {
  return typeof tallyUnlinkedCount === 'number' && tallyUnlinkedCount > 0
    ? `Job Parts Tally, ${tallyUnlinkedCount} unlinked transaction${tallyUnlinkedCount === 1 ? '' : 's'}`
    : 'Job Parts Tally'
}
