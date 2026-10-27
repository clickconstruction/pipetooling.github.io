/**
 * What was offered (v2.5988, punch list #204 PR 2): the office's read of a sent estimate's options,
 * every one in offered order with its lines, as the customer page drew them. Before acceptance the
 * sent view drew only the recommended option's frozen lines (`line_items_snapshot`, the owner's
 * decision 3 of v2.2457) under *Line items*, so an estimate sent with two options read as one, and
 * once it expired the office could not see what the second option said. `options_snapshot` is never
 * written after the draft and never cleared, so the blocks read on an expired, declined or
 * superseded row exactly as they did the day it went.
 *
 * Pure words over the normalized options; the blocks are `components/estimates/EstimateOfferedOptions.tsx`.
 */
import type { EstimateLineItemNormalized } from '../estimateLineItemNormalize'
import { estimateAddOnOptions, estimateChoiceOptions, estimateOptionTotalCents, type EstimateOption } from './estimateOptions'

export type EstimateOfferedOptionBlock = {
  key: string
  /** `Option 2 · Replace 50-gal` */
  heading: string
  /** `$3,400.00`, or `+ $1,950.00` for an add-on. */
  money: string
  /** `★ Recommended` · `Add-on` · `Starts ticked`, in that order. */
  chips: string[]
  /** The pitch under the name, trimmed; empty when the office wrote none. */
  pitch: string
  lines: EstimateLineItemNormalized[]
  /** Under the recommended option while the customer has not decided; null otherwise. */
  note: string | null
}

export type EstimateOfferedOptionsView = {
  /** 2+ options: the blocks draw. A single-option estimate draws nothing new. */
  active: boolean
  /** `What was offered` */
  heading: string
  /** `2 options · choose one` · `4 options · 2 add-ons` · `3 options · tick any` */
  countWords: string
  blocks: EstimateOfferedOptionBlock[]
}

export const OFFERED_OPTIONS_WORDS = {
  heading: 'What was offered',
  /** The fold's summary on an accepted row, under the accepted document. */
  acceptedFold: 'Every option as sent',
  recommended: '★ Recommended',
  addOn: 'Add-on',
  startsTicked: 'Starts ticked',
  recommendedNote: "The Pipeline's number until they decide.",
} as const

/** `2 options · choose one` · `4 options · 2 add-ons` · `3 options · tick any`. */
export function offeredOptionsCountWords(options: EstimateOption[]): string {
  const n = options.length
  const choices = estimateChoiceOptions(options).length
  const addOns = estimateAddOnOptions(options).length
  if (choices === 0) return `${n} options · tick any`
  if (addOns === 0) return `${n} options · choose one`
  return `${n} options · ${addOns} add-on${addOns === 1 ? '' : 's'}`
}

/**
 * The blocks for a row. `accepted` drops the Pipeline note: once they decided the number is theirs,
 * not a forecast.
 */
export function estimateOfferedOptionsView(
  options: EstimateOption[],
  formatMoney: (cents: number) => string,
  opts: { accepted?: boolean } = {},
): EstimateOfferedOptionsView {
  if (options.length < 2) return { active: false, heading: OFFERED_OPTIONS_WORDS.heading, countWords: '', blocks: [] }
  const blocks = options.map((o, i): EstimateOfferedOptionBlock => {
    const total = formatMoney(estimateOptionTotalCents(o))
    const chips: string[] = []
    if (o.recommended) chips.push(OFFERED_OPTIONS_WORDS.recommended)
    if (o.kind === 'add_on') chips.push(OFFERED_OPTIONS_WORDS.addOn)
    if (o.kind === 'add_on' && o.preticked) chips.push(OFFERED_OPTIONS_WORDS.startsTicked)
    return {
      key: o.key,
      heading: `Option ${i + 1} · ${o.name.trim() || 'Option'}`,
      money: o.kind === 'add_on' ? `+ ${total}` : total,
      chips,
      pitch: o.description.trim(),
      lines: o.line_items,
      note: o.recommended && !opts.accepted ? OFFERED_OPTIONS_WORDS.recommendedNote : null,
    }
  })
  return { active: true, heading: OFFERED_OPTIONS_WORDS.heading, countWords: offeredOptionsCountWords(options), blocks }
}
