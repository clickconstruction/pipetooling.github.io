/**
 * Bids → Pricing: Share / Print / CSV and the ★ chooser (region P7 of
 * `docs/BIDS_PRICING_LABOR_TABS_ARCHITECTURE.md`), moved out of `BidsPricingTab` as it was.
 *
 * Owns the five values (the Package-and-send window's open flag and what it is handed, the
 * chooser's action, choice and busy flag) and the handlers behind the header's Share ▾ menu.
 * The decisions and the contexts are `lib/bids/starAwareShare`; the documents are
 * `lib/bidDocuments/pricingPage`. The chooser draws in `PricingStarChooserDialog`; the
 * Package-and-send window stays in the tab, reading `shareOverride` from here.
 */
import { useState } from 'react'

import { useToastContext } from '../contexts/ToastContext'
import { supabase } from '../lib/supabase'
import { buildPricingCsvForBid, printAllPricingPages as printAllPricingPagesDoc, printPricingPage as printPricingPageDoc, type PricingPrintContext } from '../lib/bidDocuments/pricingPage'
import type { PackageRowInput } from '../lib/buildBidPricingPackageHtml'
import { loadScenarioInputs, scenarioBidVersionIdOf } from '../lib/bids/loadScenarioInputs'
import {
  buildPricingPrintContext,
  pricingPrintContextFor,
  scenarioPackageFromInputs,
  shareOverrideForStar,
  starActionReadsViewed,
  starChooserNeeded,
  teamLaborCostForBid,
  type PricingShareInputs,
  type ShareOverride,
  type StarAwareAction,
  type StarChoice,
} from '../lib/bids/starAwareShare'

export function useStarAwareShare({
  inputs,
  selectedBidVersionId,
  pricingPackageSource,
  setError,
}: {
  /** The Pricing tab's inputs for the bid on screen; null with no bid selected. */
  inputs: PricingShareInputs | null
  /** The bid version whose count rows are on screen — a ★ on another version prices its own rows. */
  selectedBidVersionId: string | null
  /** The viewed scenario's package, from `useBidPricingRows`. */
  pricingPackageSource: { rows: PackageRowInput[]; totalRevenue: number } | null
  setError: (message: string | null) => void
}) {
  const { showToast } = useToastContext()
  // Package and send (Pricing tab → "Package and send" modal — left of CSV)
  const [packageSendOpen, setPackageSendOpen] = useState(false)
  // F2 (v2.2120): Share / Print / CSV honor the ★. When the scenario you're viewing isn't the
  // customer's, a chooser asks which price to use; picking ★ loads that scenario's prices on
  // the fly (no view switch), so "the ★ is what the customer sees — Cover Letter, Share, Print,
  // and the bid value all use it" is finally true end to end.
  const [starChooser, setStarChooser] = useState<StarAwareAction | null>(null)
  /** v2.3685: 'both' (share only) sends the ★ price with the viewed one under it. */
  const [starChoice, setStarChoice] = useState<StarChoice>('star')
  const [starBusy, setStarBusy] = useState(false)
  const [shareOverride, setShareOverride] = useState<ShareOverride | null>(null)

  const bid = inputs?.bid ?? null
  const selectedPricingVersionId = inputs?.selectedPricingVersionId ?? null

  function printContext(): PricingPrintContext | null {
    return inputs ? buildPricingPrintContext(inputs) : null
  }

  function printPricingPageWith(ctx: PricingPrintContext) {
    printPricingPageDoc(ctx)
  }

  function downloadPricingCsvWith(ctx: PricingPrintContext) {
    const teamLaborCost = teamLaborCostForBid(inputs?.teamLaborDataForBids ?? [], ctx.bid.id)
    const result = buildPricingCsvForBid(ctx, teamLaborCost)
    if (!result) {
      showToast('Select a price and make sure Counts and Labor are set up.', 'info')
      return
    }
    const blob = new Blob([`﻿${result.csv}`], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = result.filename
    a.click()
    URL.revokeObjectURL(url)
    showToast('Pricing exported to CSV.', 'success')
  }

  /** Share / Print / CSV entry point: ask which price when the viewed scenario isn't the ★. */
  function requestWithStarCheck(action: StarAwareAction) {
    const starId = bid?.selected_price_book_version_id ?? null
    if (starChooserNeeded(starId, selectedPricingVersionId)) {
      setStarChoice('star')
      setStarChooser(action)
      return
    }
    void runStarAwareAction(action, 'viewed')
  }

  /** `choice`: the ★ price, the viewed one, or (share only) both — ★ first, the viewed one under it. */
  async function runStarAwareAction(action: StarAwareAction, choice: StarChoice) {
    if (!bid || !inputs) return
    const starId = bid.selected_price_book_version_id ?? null
    if (!starId || starActionReadsViewed(choice, starId, selectedPricingVersionId)) {
      setStarChooser(null)
      if (action === 'share') {
        setShareOverride(null)
        setPackageSendOpen(true)
        return
      }
      const ctx = printContext()
      if (!ctx) return
      if (action === 'print') printPricingPageWith(ctx)
      else downloadPricingCsvWith(ctx)
      return
    }
    setStarBusy(true)
    try {
      const scenario = await loadScenarioInputs(supabase, {
        bidId: bid.id,
        pricingId: starId,
        scenarioBidVersionId: scenarioBidVersionIdOf(inputs.priceBookVersions, starId),
        selectedBidVersionId,
      })
      if (action === 'share') {
        setShareOverride(
          shareOverrideForStar({
            starId,
            starPackage: scenarioPackageFromInputs(starId, scenario, inputs),
            choice,
            viewedId: selectedPricingVersionId,
            viewedPackage: pricingPackageSource,
            versions: inputs.priceBookVersions,
          }),
        )
        setPackageSendOpen(true)
      } else {
        const ctx = printContext()
        if (!ctx) return
        const starCtx = pricingPrintContextFor(ctx, starId, scenario)
        if (action === 'print') printPricingPageWith(starCtx)
        else downloadPricingCsvWith(starCtx)
      }
    } finally {
      setStarBusy(false)
      setStarChooser(null)
    }
  }

  function printPricingPage() {
    requestWithStarCheck('print')
  }

  function downloadPricingCsv() {
    requestWithStarCheck('csv')
  }

  async function printAllPricingPages() {
    const ctx = printContext()
    if (!ctx) return
    const err = await printAllPricingPagesDoc(ctx)
    if (err) setError(err)
  }

  return {
    packageSendOpen,
    setPackageSendOpen,
    shareOverride,
    setShareOverride,
    starChooser,
    setStarChooser,
    starChoice,
    setStarChoice,
    starBusy,
    requestWithStarCheck,
    runStarAwareAction,
    printPricingPage,
    downloadPricingCsv,
    printAllPricingPages,
  }
}

export type StarAwareShare = ReturnType<typeof useStarAwareShare>
