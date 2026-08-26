/**
 * Draft-while-editing semantics for the Workbench sale-price input (v2.2368).
 *
 * The input used to parse every keystroke and repaint from the parsed number,
 * which ate the decimal point as it was typed ("500." reparsed to 500 → typing
 * 500.25 landed as 50025). Instead the field holds the raw draft string while
 * focused; these kernels decide what the draft means live and what it commits
 * to on blur/Enter.
 */

/**
 * Parse a price draft as the user types. Accepts "$", thousands commas, and
 * stray whitespace. Returns the parsed price, or null when the draft doesn't
 * (yet) name a positive price — partial states like "", ".", "$" are simply
 * "nothing to preview yet", never zero.
 */
export function parsePriceDraft(raw: string): number | null {
  const v = parseFloat(raw.replace(/[$,\s]/g, ''))
  return Number.isFinite(v) && v > 0 ? v : null
}

export type PriceDraftCommit =
  /** Draft names a price — preview it (rounded to cents). */
  | { kind: 'set'; value: number }
  /** Field was cleared — drop this row's preview, fall back to the saved price. */
  | { kind: 'clear' }
  /** Gibberish — keep whatever price was in effect before. */
  | { kind: 'revert' }

/** Decide what leaving the field (or Enter) does with the draft. */
export function commitPriceDraft(raw: string): PriceDraftCommit {
  if (raw.trim() === '') return { kind: 'clear' }
  const v = parsePriceDraft(raw)
  if (v == null) return { kind: 'revert' }
  return { kind: 'set', value: Math.round(v * 100) / 100 }
}

/** Canonical field text for a committed price — cents kept, no trailing zeros. */
export function formatPriceDraft(value: number): string {
  return String(Math.round(value * 100) / 100)
}
