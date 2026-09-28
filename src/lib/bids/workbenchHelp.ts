/**
 * Bids → Pricing: the Workbench's help — the "?" card's facts and the walkthrough's stops
 * (region P2 of `docs/BIDS_PRICING_LABOR_TABS_ARCHITECTURE.md`). `useWorkbenchHelp` holds
 * the open flags; `WorkbenchHelpCard` draws the card.
 */
import type { SpotlightTourStep } from '../../components/SpotlightTour'

/** The Workbench walkthrough stops, in the section's own top-to-bottom order. */
export const WORKBENCH_TOUR_STEPS: SpotlightTourStep[] = [
  {
    anchor: 'send-to',
    title: 'Send to — one packet per GC',
    body: 'Versions draft this bid for different GCs: each GC gets its own packet — counts, prices, send date, answer. "＋ Add GC" starts one as a copy of this one.',
  },
  {
    anchor: 'workbench-scenarios',
    title: 'Prices — what this GC receives',
    body: 'Price options are different prices for the same GC. The ★ base is what the GC sees — Cover Letter, Share, Print, and the bid value all use it. Offer another as an alternate and it goes on their letter too; anything else is yours to compare.',
  },
  {
    anchor: 'workbench-summary',
    title: 'Read the strip',
    body: 'Revenue, cost, profit, and margin always show the price you’re viewing. An amber dashed border means the numbers include an unsaved solver preview.',
  },
  {
    anchor: 'workbench-solver',
    title: 'Solve to a number',
    body: 'Press the blue Solver › to unfold the solver — its blue ring holds the 20–95 slider (re-prices live as you drag), the typed margin, and the whole-bid target total; ‹ folds it away, and your choice is remembered. Hand-set prices on no-cost rows stack on top. The ▾ beside Solver holds "Price unpriced only". Apply writes the drafts; Discard throws them away.',
  },
  {
    anchor: 'workbench-rows',
    title: 'Type to price, Solve to preview',
    body: 'A price you type saves the moment you press Enter or leave the field — no Apply needed. Solver results land as amber previews instead, saved only when you "Apply" up in the strip; a preview waits on this device (reloads, closed tabs, tomorrow) until you Apply or Discard. 📌 pins a row so the solver holds its price.',
  },
]

export const WORKBENCH_TOUR_EMPTY_MESSAGE = 'Nothing to tour yet — the Workbench needs Counts, an active Pricing, and a cost estimate.'
export const WORKBENCH_GUIDE_HREF = '/help?g=price-a-bid-with-the-workbench'

/**
 * What the "?" card says about this bid: a solo bid (one price, one GC at most) names the
 * price its GC sees; anything more says whose packet is on screen. With no price of its own
 * the bid reads the shared book — "Standard prices".
 */
export function workbenchHelpFacts(args: {
  priceBookVersions: ReadonlyArray<{ id: string; name: string; sort_order: number }>
  selectedPricingVersionId: string | null
  bidVersionCount: number
}): { solo: boolean; firstScenarioName: string } {
  const owned = [...args.priceBookVersions].sort((a, b) => a.sort_order - b.sort_order)
  const scenarios: Array<{ id: string; name: string }> =
    owned.length > 0 ? owned : args.selectedPricingVersionId ? [{ id: args.selectedPricingVersionId, name: 'Standard prices' }] : []
  return {
    solo: scenarios.length <= 1 && args.bidVersionCount <= 1,
    firstScenarioName: scenarios[0]?.name ?? 'your price',
  }
}
