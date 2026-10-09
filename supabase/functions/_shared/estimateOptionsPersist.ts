/**
 * The Estimate Options save kernel (v2.5112, punch list #103): what the office's save writes for
 * an estimate with options. It moved here from src/lib/estimates/estimateOptions.ts, which
 * wraps it under the same name and signature for `saveDraft`, so the What customers see sample estimate
 * (`sampleEstimateResponse`) is saved by the code that saves a real one and can never offer what
 * a real estimate cannot. It sits beside the shared parse (`estimateOptions.ts`) rather than
 * inside it so the functions that only read options (accept-estimate, send-estimate-to-customer,
 * log-estimate-option-view) keep their bundle. Generic over the option and line shapes, so the
 * client's types come back out unchanged. No imports.
 */

type PersistOption = { key: string; recommended: boolean; line_items: { amount_cents: number }[] }

/**
 * What saveDraft persists (owner decision 3): the snapshot itself, plus the recommended
 * option mirrored into the legacy fields so every existing reader shows the number you'd
 * forecast. `viewedKey`/`viewedLines` fold the editor's live lines (the option being edited)
 * back into the snapshot first. The recommended option is the first one marked, else the first.
 */
export function estimateOptionsDraftPersistFields<O extends PersistOption>(
  options: O[],
  viewedKey: string | null,
  viewedLines: O['line_items'],
): {
  options_snapshot: O[] | null
  line_items_snapshot: O['line_items'] | null
  total_cents: number | null
} {
  if (options.length === 0) return { options_snapshot: null, line_items_snapshot: null, total_cents: null }
  const synced: O[] = options.map((o) => (o.key === viewedKey ? { ...o, line_items: viewedLines } : o))
  const rec = synced.find((o) => o.recommended) ?? synced[0] ?? null
  return {
    options_snapshot: synced,
    line_items_snapshot: rec ? rec.line_items : [],
    total_cents: rec ? rec.line_items.reduce((sum, l) => sum + (Number(l.amount_cents) || 0), 0) : 0,
  }
}
