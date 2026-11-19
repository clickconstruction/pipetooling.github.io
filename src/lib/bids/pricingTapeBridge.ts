/**
 * The line between the Pricing Tape and the Workbench (Bids → Pricing). The calculator is drawn
 * by the page, beside the tab, so neither holds the other: the Workbench sets a sink while a bid's
 * numbers are on screen, and the calculator sends its answer through it. With no sink the
 * calculator offers nothing to send.
 *
 * A sent answer is its number and, when the tape's math was one named group of rows times a
 * number, the rule behind it (the Percent row, `lib/bids/percentRow.ts`).
 */
import { useSyncExternalStore } from 'react'

import type { PercentBasis } from './percentRow'

/** What the calculator sends: the answer, the math as the tape printed it, and the rule behind it when there is one. */
export type TapeAnswer = {
  /** The number on the display. */
  value: number
  /** The tape's line: "900 + 334.5 = 1,234.50". */
  words: string
  /** Set when the math was a named group of rows times a number: the percent, what it is a percent of, and whose. */
  rule: { pct: number; basis: PercentBasis; sourceKey: string } | null
}

/** Where an answer goes: onto a row already on the bid, or into a new row. */
export type TapeSendTo = 'row' | 'new-row'

export type PricingTapeSink = { send: (answer: TapeAnswer, to: TapeSendTo) => void }

let sink: PricingTapeSink | null = null
const listeners = new Set<() => void>()

/** The Workbench sets its sink while a bid's numbers are on screen, and clears it with null. */
export function setPricingTapeSink(next: PricingTapeSink | null): void {
  if (sink === next) return
  sink = next
  for (const l of listeners) l()
}

export function getPricingTapeSink(): PricingTapeSink | null {
  return sink
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

/** The sink as the calculator reads it: null when no Workbench can take an answer. */
export function usePricingTapeSink(): PricingTapeSink | null {
  return useSyncExternalStore(subscribe, getPricingTapeSink, () => null)
}

/** An answer worth sending: a number of zero or more. A negative or a broken result stays on the tape. */
export function tapeAnswerSendable(value: number): boolean {
  return Number.isFinite(value) && value >= 0
}
