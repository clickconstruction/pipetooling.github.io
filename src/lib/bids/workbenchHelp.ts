/**
 * Bids → Pricing: the Workbench's help — the "?" card's facts and the walkthrough's stops
 * (region P2 of `docs/BIDS_PRICING_LABOR_TABS_ARCHITECTURE.md`). `useWorkbenchHelp` holds
 * the open flags; `WorkbenchHelpCard` draws the card.
 */
import type { SpotlightTourStep } from '../../components/SpotlightTour'

/**
 * The Workbench walkthrough stops, in the section's own top-to-bottom order. Written in
 * plain words (v2.4228, punch list #58): the rules are the Submittals tour's, held by
 * `workbenchHelp.test.ts` — one idea per sentence and no sentence over 20 words, *you* + a
 * verb and the control's exact name, a trade word explained beside itself the first time,
 * no dashes, semicolons, parentheses or dot lists inside a sentence.
 */
export const WORKBENCH_TOUR_STEPS: SpotlightTourStep[] = [
  {
    anchor: 'send-to',
    title: 'Send to. One packet per GC',
    body: 'A packet is what one GC gets. It has its own counts, prices, send date and answer. This strip lists the GCs on this bid. Tap a GC to see their packet. Tap ＋ Add GC to start a packet for another GC. It starts as a copy of this one.',
  },
  {
    anchor: 'workbench-scenarios',
    title: 'Prices. What this GC receives',
    body: 'A price option is one of several prices for the same GC. The ★ base is the price the GC sees. The Cover Letter, Share, Print and the bid value all use it. Tap ☆ make base on a card to change it. Tap Offer it to the GC as an alternate and that price goes on their letter too. The rest are yours to compare.',
  },
  {
    anchor: 'workbench-summary',
    title: 'Read the strip',
    body: 'The strip shows revenue, cost, profit and margin. Margin is profit as a share of the price. The numbers are for the price you are viewing. An amber dashed border means the numbers hold a preview. A preview is a price you have not saved yet. Tap Apply to keep the previews or Discard to drop them.',
  },
  {
    anchor: 'workbench-solver',
    title: 'Solve to a number',
    body: 'The solver suggests a price for every row. Tap the blue Solver › to open it. Drag the slider to a margin from 20 to 95, or type one. Or type the total you want for the whole bid. The prices change as you drag. The ▾ beside Solver holds Price unpriced only, which leaves priced rows alone. Tap ‹ to fold the solver away.',
  },
  {
    anchor: 'workbench-rows',
    title: 'Type to price, Solve to preview',
    body: 'Type a price in a row. It saves when you press Enter or leave the field. Solver prices are different. They land in amber as previews. A preview stays on this device until you tap Apply or Discard. It survives a reload and a closed tab. Tap 📌 on a row to pin its price so the solver leaves it alone.',
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
