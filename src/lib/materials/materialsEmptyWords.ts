/**
 * What the Materials lists say when they are empty (punch list #184, sweep C): the assembly list
 * the Assembly Book and the PO Builder share (one filter state), the Parts Book, Purchase Orders,
 * Held for suppliers, the supply-house directory, and one house's invoices and POs on the Supply
 * houses tab. Each says what fills the list and offers the surface's own press: its make button,
 * Clear the search or Clear the filters, or a link to the tab that makes the thing. The words are
 * `emptyWords`' kinds; the presses are the caller's handlers.
 */
import { emptyWords, emptyWordsWithPress, type EmptyStateWords } from '../emptyWords'
import type { MaterialsTab } from './materialsTabs'

/** A Materials tab as a link: the page's tab effect reads `?tab=`, so a press to a tab is a plain path. */
export function materialsTabPath(tab: MaterialsTab): string {
  return `/materials?tab=${tab}`
}

/** A search or the filters hide every row. The search is quoted only when nothing else hides them; one press clears them all. */
function hidden(noun: string, query: string, otherFilters: boolean, clear: () => void): EmptyStateWords {
  return emptyWordsWithPress(emptyWords({ kind: 'filter', noun, query: otherFilters ? '' : query }), { onPress: clear })
}

/**
 * The assembly list. None at all: + Add Assembly on the Assembly Book, or from the PO Builder a link
 * to the Assembly Book, which makes them. Else the search, a type checkbox or Empty hides them.
 */
export function assemblyListEmptyWords(s: {
  total: number
  query: string
  /** A type checkbox or Empty is ticked. */
  typeFiltered: boolean
  clearFilters: () => void
  /** + Add Assembly on the Assembly Book; null on the PO Builder. */
  addAssembly: (() => void) | null
}): EmptyStateWords {
  if (s.total > 0) return hidden('assemblies', s.query, s.typeFiltered, s.clearFilters)
  return s.addAssembly
    ? emptyWordsWithPress(emptyWords({ kind: 'make', noun: 'assemblies', control: '+ Add Assembly' }), { onPress: s.addAssembly })
    : emptyWordsWithPress(emptyWords({ kind: 'data', noun: 'assemblies', page: { label: 'Assembly Book', tail: 'makes the first.' } }), { to: materialsTabPath('assembly-book') })
}

/** The Parts Book: the search, Part Type or Manufacturer hides the parts, or there are none and Add Part makes the first. */
export function partsBookEmptyWords(s: { query: string; typeOrMakerFiltered: boolean; clearFilters: () => void; addPart: () => void }): EmptyStateWords {
  if (s.query.trim() || s.typeOrMakerFiltered) return hidden('parts', s.query, s.typeOrMakerFiltered, s.clearFilters)
  return emptyWordsWithPress(emptyWords({ kind: 'make', noun: 'parts', control: 'Add Part' }), { onPress: s.addPart })
}

/** Purchase Orders: the search or the status hides them, or there are none and the PO Builder makes the first. */
export function purchaseOrdersEmptyWords(s: { query: string; statusFiltered: boolean; clearFilters: () => void }): EmptyStateWords {
  if (s.query.trim() || s.statusFiltered) return hidden('purchase orders', s.query, s.statusFiltered, s.clearFilters)
  return emptyWordsWithPress(emptyWords({ kind: 'data', noun: 'purchase orders', page: { label: 'PO Builder', tail: 'makes the first.' } }), { to: materialsTabPath('assemblies-po') })
}

/** Held for suppliers: no invoice is on a job yet, which the Supply houses tab does, or the chip hides every job. */
export function jobAccountsEmptyWords(s: { total: number; showAll: () => void }): EmptyStateWords {
  if (s.total === 0) {
    return { main: 'No supply house invoices are allocated to jobs yet.', next: { label: 'Supply houses', to: materialsTabPath('supply-houses') }, tail: 'is where each invoice gets its job.' }
  }
  return { main: 'No jobs match this filter.', next: { label: 'All', onPress: s.showAll }, tail: 'shows every job.' }
}

/**
 * The supply-house directory. A search quotes itself and clears. The trade chips or the kind select
 * clear back to every house. With none at all, the toolbar's add button makes the first. The office's
 * directory lists every vendor, so its noun is vendors.
 */
export function supplyHouseDirectoryEmptyWords(s: {
  audience: 'office' | 'estimator'
  query: string
  /** Houses exist, but the trade chips or the kind select hide every one. */
  narrowed: boolean
  clearSearch: () => void
  clearFilters: () => void
  addHouse: () => void
}): EmptyStateWords {
  if (s.query.trim()) return emptyWordsWithPress(emptyWords({ kind: 'filter', noun: 'houses or reps', query: s.query }), { onPress: s.clearSearch })
  const noun = s.audience === 'office' ? 'vendors' : 'supply houses'
  if (s.narrowed) return emptyWordsWithPress(emptyWords({ kind: 'filter', noun, query: '' }), { onPress: s.clearFilters })
  return emptyWordsWithPress(emptyWords({ kind: 'make', noun, control: s.audience === 'office' ? 'Add vendor' : 'Add supply house' }), { onPress: s.addHouse })
}

/** The aging table, the phone list and an emptied aging cell: nothing unpaid is the good state. */
export const SUPPLY_HOUSE_AGING_EMPTY: EmptyStateWords = { main: 'Nothing unpaid. Every supply-house invoice is settled.' }

/**
 * One house's invoices. None at all: Add Invoice makes the first. Every one paid while Show paid
 * invoices is off: nothing is unpaid, and the press lists the paid ones.
 */
export function supplyHouseInvoicesEmptyWords(s: { house: string; total: number; addInvoice: () => void; showPaid: () => void }): EmptyStateWords {
  if (s.total === 0) return { main: `No invoices from ${s.house} yet.`, next: { label: 'Add Invoice', onPress: s.addInvoice }, tail: 'adds the first.' }
  return { main: `Nothing unpaid with ${s.house}.`, next: { label: 'Show paid invoices', onPress: s.showPaid }, tail: 'lists the paid ones too.' }
}

/** One house's purchase orders: Create PO starts the first, once a service type is picked above. */
export function supplyHousePosEmptyWords(s: { house: string; createPo: (() => void) | null }): EmptyStateWords {
  const main = `No purchase orders for ${s.house} yet.`
  return s.createPo ? { main, next: { label: 'Create PO', onPress: s.createPo }, tail: 'starts the first.' } : { main }
}
