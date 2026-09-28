/**
 * Bids → Pricing: the Workbench's help doors — the "?" card's open flag and the spotlight
 * walkthrough (v2.2021) — moved out of `BidsPricingTab` as they were. The header's "?" opens
 * the card; the card's footer starts the tour.
 */
import { useState } from 'react'

import { spotlightTourStepsPresent, type SpotlightTourStep } from '../components/SpotlightTour'
import { useToastContext } from '../contexts/ToastContext'
import { WORKBENCH_TOUR_EMPTY_MESSAGE, WORKBENCH_TOUR_STEPS } from '../lib/bids/workbenchHelp'

export function useWorkbenchHelp({
  unfoldSolver,
}: {
  /** The tour points at the solver's controls — it unfolds first (v2.2385), and the device remembers. */
  unfoldSolver: () => void
}) {
  const { showToast } = useToastContext()
  /** The spotlight walkthrough (v2.2021): null = closed, else the steps whose anchors exist. */
  const [wbTourSteps, setWbTourSteps] = useState<SpotlightTourStep[] | null>(null)
  /** v2.2203: the Workbench structure bar lives behind the (i) beside the bid name. */
  const [wbInfoOpen, setWbInfoOpen] = useState(false)

  function startWorkbenchTour() {
    // The tour points at the solver's controls — unfold it first (v2.2385).
    unfoldSolver()
    const present = spotlightTourStepsPresent(WORKBENCH_TOUR_STEPS)
    if (present.length === 0) {
      showToast(WORKBENCH_TOUR_EMPTY_MESSAGE, 'info')
      return
    }
    setWbTourSteps(present)
  }

  return { wbInfoOpen, setWbInfoOpen, wbTourSteps, setWbTourSteps, startWorkbenchTour }
}
