import { isMaterialsOfficeRole, materialsTabsFor, type MaterialsTab } from './materialsTabs'

/**
 * The Materials page's strip in three named groups (punch list #304, the owner's idea of
 * 2026-11-10): Plan, Purchase and a third word for what is on site. A group is the tabs under one
 * caption; a role sees the groups that hold a tab it may open. The two things done to a box, Print
 * labels and Scan a label, are presses beside the On site tab, never tabs: each does one thing and
 * neither is a place to stay.
 */

export const MATERIALS_GROUPS = ['plan', 'purchase', 'track'] as const

export type MaterialsGroupKey = (typeof MATERIALS_GROUPS)[number]

/** The captions. The third word is this one constant (the card's call 6). */
export const MATERIALS_GROUP_WORDS: Record<MaterialsGroupKey, string> = {
  plan: 'Plan',
  purchase: 'Purchase',
  track: 'Track',
}

const GROUP_OF: Record<MaterialsTab, MaterialsGroupKey> = {
  'parts-book': 'plan',
  'assembly-book': 'plan',
  'assemblies-po': 'plan',
  'purchase-orders': 'purchase',
  'po-generator': 'purchase',
  'supply-houses': 'purchase',
  'job-accounts': 'purchase',
  'what-we-buy': 'purchase',
  'on-site': 'track',
}

/** The words on each tab, as the strip has always read them. */
export const MATERIALS_TAB_LABELS: Record<MaterialsTab, string> = {
  'parts-book': 'Parts Book',
  'assembly-book': 'Assembly Book',
  'assemblies-po': 'PO Builder',
  'purchase-orders': 'Purchase Orders',
  'po-generator': 'PO Generator',
  'supply-houses': 'Supply houses',
  'job-accounts': 'Held for suppliers',
  'what-we-buy': 'What we buy',
  'on-site': 'On site',
}

export function materialsGroupOf(tab: MaterialsTab): MaterialsGroupKey {
  return GROUP_OF[tab]
}

export type MaterialsGroup = { key: MaterialsGroupKey; word: string; tabs: MaterialsTab[] }

/** The groups a role sees, in the strip's order, each with the tabs that role may open. A group with no tab is left out. */
export function materialsGroupsFor(role: string | null | undefined): MaterialsGroup[] {
  const tabs = materialsTabsFor(role)
  return MATERIALS_GROUPS.map((key) => ({ key, word: MATERIALS_GROUP_WORDS[key], tabs: tabs.filter((t) => GROUP_OF[t] === key) })).filter((g) => g.tabs.length > 0)
}

export type MaterialsPress = 'print-labels' | 'scan-label'

export const MATERIALS_PRESS_LABELS: Record<MaterialsPress, string> = {
  'print-labels': 'Print labels',
  'scan-label': 'Scan a label',
}

/**
 * The presses at the right end of On site's row, in order: Scan a label, then Print labels (the owner, 2026-11-10). Whoever may open a job's boxes may print its labels (the card's call
 * 3): a label shows a stencil and a code, no money.
 */
export function materialsPressesFor(role: string | null | undefined): MaterialsPress[] {
  return materialsTabsFor(role).includes('on-site') ? ['scan-label', 'print-labels'] : []
}

export type MaterialsBadge = { text: string; tone: 'amber' | 'red' }

/**
 * What the third group's caption wears, and only when a hand is needed: the boxes due a count for
 * everyone, and for the office what walked away this week. Nothing while the desk has not loaded.
 */
export function trackBadges(needs: { staleBoxes: number; missingMoneyWeek: number } | null, role: string | null | undefined): MaterialsBadge[] {
  if (!needs) return []
  const out: MaterialsBadge[] = []
  if (needs.staleBoxes > 0) out.push({ text: `${needs.staleBoxes} due a count`, tone: 'amber' })
  if (isMaterialsOfficeRole(role) && needs.missingMoneyWeek > 0) {
    out.push({ text: `$${needs.missingMoneyWeek.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} walked away`, tone: 'red' })
  }
  return out
}

/** Where On site's rows lead a role: the office works a job on this page, everyone else on the Tally's phone screen. */
export function onSiteJobHref(role: string | null | undefined, jobId: string): string {
  return isMaterialsOfficeRole(role) ? `/materials?tab=on-site&job=${jobId}` : `/tally?tab=on-site&job=${jobId}`
}
