/**
 * What the acceptance page shows for the customer's current selection (v2.3555, PR 2 of
 * to-dos/estimate-options-approve-several/): the Approve label, the total card's caption, the
 * line-items heading and the per-option groups the document draws. Pure, so the body, the
 * staff preview and the tests read one truth. Money words are the body's own formatter.
 */
import {
  describeEstimateSelection,
  estimateChoiceOptions,
  isValidEstimateSelection,
  type EstimateOption,
} from './estimateOptions'
import type { EstimateLineItemNormalized } from '../estimateLineItemNormalize'

export type EstimateAcceptLineGroup = { heading: string; lines: EstimateLineItemNormalized[] }

export type EstimateAcceptSelectionView = {
  /** 2+ options — the picker renders and the selection drives the document. */
  active: boolean
  /** The selection passes the acceptance rule (always true when not active). */
  valid: boolean
  /** The chosen options in offered order (empty when not active). */
  selected: EstimateOption[]
  /** Null when not active — the caller falls back to the estimate's legacy fields. */
  totalCents: number | null
  /** `Approve "Replace 50-gal" + 2 add-ons — $5,740.00` · `Choose an option` · `Approve`. */
  approveLabel: string
  /** The total card's caption before ` · Total`: `Replace 50-gal + 2 add-ons`; null = the plain label. */
  cardCaption: string | null
  /** `Your selection — Replace 50-gal · Water softener`; null = the experience's own heading. */
  linesHeading: string | null
  /** One group per selected option, in offered order; a single group carries no sub-heading. */
  groups: EstimateAcceptLineGroup[]
}

export function estimateAcceptSelectionView(
  options: EstimateOption[],
  selectedKeys: string[],
  formatMoney: (cents: number) => string,
  opts: { isChangeOrder?: boolean } = {},
): EstimateAcceptSelectionView {
  const active = options.length >= 2
  if (!active) {
    return {
      active: false,
      valid: true,
      selected: [],
      totalCents: null,
      approveLabel: opts.isChangeOrder ? 'Approve change order' : 'Approve',
      cardCaption: null,
      linesHeading: null,
      groups: [],
    }
  }
  const valid = isValidEstimateSelection(options, selectedKeys).ok
  const summary = describeEstimateSelection(options, selectedKeys)
  const selected = summary.choice ? [summary.choice, ...summary.addOns] : summary.addOns
  const hasChoices = estimateChoiceOptions(options).length > 0
  const nameOf = (o: EstimateOption) => o.name.trim() || 'Option'

  let cardCaption: string | null = null
  if (summary.choice) {
    cardCaption =
      summary.addOns.length === 0
        ? nameOf(summary.choice)
        : `${nameOf(summary.choice)} + ${summary.addOns.length} add-on${summary.addOns.length === 1 ? '' : 's'}`
  } else if (summary.addOns.length === 1) {
    cardCaption = nameOf(summary.addOns[0]!)
  } else if (summary.addOns.length > 1) {
    cardCaption = `${summary.addOns.length} options`
  }

  const approveLabel = opts.isChangeOrder
    ? 'Approve change order'
    : valid && summary.label
      ? `Approve ${summary.label} — ${formatMoney(summary.totalCents)}`
      : hasChoices
        ? 'Choose an option'
        : 'Choose at least one option'

  const groups: EstimateAcceptLineGroup[] = selected.map((o) => ({
    heading: o.kind === 'add_on' && hasChoices ? `Add-on — ${nameOf(o)}` : nameOf(o),
    lines: o.line_items,
  }))

  return {
    active: true,
    valid,
    selected,
    totalCents: summary.totalCents,
    approveLabel,
    cardCaption,
    linesHeading: selected.length > 0 ? `Your selection — ${selected.map(nameOf).join(' · ')}` : 'Your selection',
    groups,
  }
}
