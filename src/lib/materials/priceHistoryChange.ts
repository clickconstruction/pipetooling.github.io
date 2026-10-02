/**
 * How the Price History table shows one row's change (v2.4394), from a buyer's side: a rise reads
 * orange with ▲ and a drop blue with ▼ (until then a rise read green). The same price again is a
 * check (Check 20 prices, Confirm price on a PO) and reads Checked; a row with no old price is
 * the part's first price at that house.
 */
export type PriceHistoryTone = 'up' | 'down' | 'same' | 'first'

export const PRICE_HISTORY_TONE_COLOR: Record<PriceHistoryTone, string> = {
  up: 'var(--text-orange-700)',
  down: 'var(--text-blue-700)',
  same: 'var(--text-muted)',
  first: 'var(--text-muted)',
}

export function priceHistoryChange(row: { old_price: number | null; new_price: number; price_change_percent: number | null }): { text: string; tone: PriceHistoryTone } {
  if (row.old_price == null) return { text: 'First price', tone: 'first' }
  if (row.old_price === row.new_price) return { text: 'Checked', tone: 'same' }
  const pct = row.price_change_percent ?? (row.old_price > 0 ? ((row.new_price - row.old_price) / row.old_price) * 100 : null)
  if (pct == null) return { text: row.new_price > row.old_price ? '▲' : '▼', tone: row.new_price > row.old_price ? 'up' : 'down' }
  return pct > 0 ? { text: `▲ +${pct.toFixed(2)}%`, tone: 'up' } : { text: `▼ ${pct.toFixed(2)}%`, tone: 'down' }
}
