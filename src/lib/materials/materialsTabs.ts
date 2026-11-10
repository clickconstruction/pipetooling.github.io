import { isAssistantLike } from '../subcontractorLikeRole'

/**
 * Which Materials tabs a role may open — the one list the page shell reads for
 * its pills, its redirects and its tab bodies (to-dos/supply-house-directory,
 * PR 1). Before this kernel, `Materials.tsx` compared the role against
 * literals in a dozen places; admitting a role to one more tab meant finding
 * every one of them. Now it is one row below, pinned by tests.
 *
 * The RLS side of the same question lives in SQL: reads in
 * `sup_supply_houses_select` / `supply_house_contacts_select_office`, writes
 * behind `can_manage_supply_house_directory()` (office roles + estimator,
 * PR 2). Keep the two in step when a row here changes.
 */

export const MATERIALS_TABS = [
  'parts-book',
  'assembly-book',
  'assemblies-po',
  'purchase-orders',
  'po-generator',
  'supply-houses',
  'job-accounts',
  'on-site',
] as const

export type MaterialsTab = (typeof MATERIALS_TABS)[number]

export const MATERIALS_DEFAULT_TAB: MaterialsTab = 'parts-book'

/** The three tabs the office keeps to itself: the vendor ledger, the AP desks, the PO ledger. */
const OFFICE_ONLY_TABS: readonly MaterialsTab[] = ['supply-houses', 'job-accounts', 'po-generator']

/** Book tabs every Materials reader gets. */
const READER_TABS: readonly MaterialsTab[] = ['parts-book', 'assembly-book']

/** Buyer tabs — estimators build and track POs; primaries and superintendents only read the books. */
const BUYER_TABS: readonly MaterialsTab[] = ['assemblies-po', 'purchase-orders']

/**
 * On site (punch list #304): the cages and boxes on every job, for every Materials reader. The rows
 * under it are gated by `on_site_can_touch_job`, so a role sees the jobs it can reach and no more.
 */
const ON_SITE_TABS: readonly MaterialsTab[] = ['on-site']

/** The office: dev, master and the assistant-like roles. They get every tab and the desk on On site. */
export function isMaterialsOfficeRole(role: string | null | undefined): boolean {
  return role === 'dev' || role === 'master_technician' || isAssistantLike(role)
}

/** The tabs in `MATERIALS_TABS`' order, which is the strip's: Plan, then Purchase, then Track. */
function inStripOrder(tabs: readonly MaterialsTab[]): MaterialsTab[] {
  return MATERIALS_TABS.filter((t) => tabs.includes(t))
}

export function isMaterialsTab(value: string | null | undefined): value is MaterialsTab {
  return value != null && (MATERIALS_TABS as readonly string[]).includes(value)
}

/** Whether the role may open /materials at all. */
export function canAccessMaterials(role: string | null | undefined): boolean {
  return materialsTabsFor(role).length > 0
}

/**
 * Tabs the role may open, in the page's canonical order. Office roles (dev,
 * master, assistant-like) get everything; estimators get the books, the PO
 * lanes, the Supply houses directory and On site; primaries and
 * superintendents get the books and On site.
 */
export function materialsTabsFor(role: string | null | undefined): readonly MaterialsTab[] {
  if (!role) return []
  if (isMaterialsOfficeRole(role)) {
    return MATERIALS_TABS
  }
  if (role === 'estimator') {
    // The estimator door (PR 2): the Supply houses tab renders the Directory pane alone.
    return inStripOrder([...READER_TABS, ...BUYER_TABS, 'supply-houses', ...ON_SITE_TABS])
  }
  if (role === 'primary' || role === 'superintendent') {
    return inStripOrder([...READER_TABS, ...ON_SITE_TABS])
  }
  return []
}

export function canOpenMaterialsTab(role: string | null | undefined, tab: MaterialsTab): boolean {
  return materialsTabsFor(role).includes(tab)
}

/** True for the tabs the pill strip draws before its divider (office lanes). */
export function isOfficeMaterialsTab(tab: MaterialsTab): boolean {
  return OFFICE_ONLY_TABS.includes(tab)
}

export type MaterialsTabResolution =
  /** The URL names a tab this role may open. */
  | { tab: MaterialsTab; redirect: false }
  /** The URL is missing a tab, or names one this role may not open — land on `tab` and rewrite the URL. */
  | { tab: MaterialsTab; redirect: true }
  /** Unknown slug: leave the page where it is (matches the pre-kernel behaviour). */
  | { tab: null; redirect: false }

/**
 * Where `?tab=` should land for this role. A role that may not open the
 * requested tab is sent to the default; a missing tab writes the default into
 * the URL so pins and back-navigation stay honest.
 */
export function resolveMaterialsTab(role: string | null | undefined, requested: string | null): MaterialsTabResolution {
  if (!requested) return { tab: MATERIALS_DEFAULT_TAB, redirect: true }
  if (!isMaterialsTab(requested)) return { tab: null, redirect: false }
  if (canOpenMaterialsTab(role, requested)) return { tab: requested, redirect: false }
  return { tab: MATERIALS_DEFAULT_TAB, redirect: true }
}

/**
 * What the Supply houses tab renders for a role: the office gets the Directory
 * pane above its accounts-payable pane; a role admitted only to the directory
 * gets that pane alone. `null` when the tab is not theirs.
 */
export type SupplyHousesPane = 'office' | 'directory'

export function supplyHousesPaneFor(role: string | null | undefined): SupplyHousesPane | null {
  if (!canOpenMaterialsTab(role, 'supply-houses')) return null
  if (isMaterialsOfficeRole(role)) return 'office'
  return 'directory'
}
