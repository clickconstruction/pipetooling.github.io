/**
 * Pure builder for the Bids -> Takeoffs "Print" document.
 *
 * Extracted from `src/pages/Bids.tsx` (`printTakeoffBreakdown`): one table per fixture of
 * (part, unit price, qty, extended total). The By Stage variant, parts grouped per stage, went
 * when By Stage retired (v2.4389).
 *
 * A pure HTML-string builder. The caller does the async data gathering (part-name lookups) and
 * prints the result via `printHtmlInNewWindow`. No DOM/React/Supabase here.
 */

import { escapeHtml } from './htmlDoc'
import { roughCountMultiplier } from '../bids/bidTakeoffHelpers'

export interface RoughTakeoffBreakdownInput {
  /** Raw (unescaped) document title; the builder escapes it. */
  title: string
  /** Count rows in display order; a fixture section is emitted only when it has lines. */
  rows: Array<{ id: string; fixture: string | null; count: number }>
  lines: Array<{ countRowId: string; partId: string; quantity: number; unitPrice: number; sequenceOrder: number }>
  /** Resolved part names by id; falls back to the first 8 chars of the id when missing. */
  partNameById: Record<string, string>
  /** Materials by stage (v2.3673): each fixture's stage in margin words ("2", "1 + 2 (½ · ½)", "mixed"); absent or '' = nothing printed. */
  stageTextByRowId?: Record<string, string>
}

export function buildRoughTakeoffBreakdownHtml(input: RoughTakeoffBreakdownInput): string {
  const title = escapeHtml(input.title)
  const rowsHtml = input.rows
    .map((row) => {
      const lines = input.lines
        .filter((l) => l.countRowId === row.id)
        .sort((a, b) => a.sequenceOrder - b.sequenceOrder)
      if (lines.length === 0) return ''
      const body = lines
        .map((l) => {
          const nm = escapeHtml(input.partNameById[l.partId] ?? l.partId.slice(0, 8))
          const q = Number(l.quantity)
          const up = Number(l.unitPrice)
          const tot = q * up * roughCountMultiplier(row.count)
          return `<tr><td style="padding:0.25rem 0.5rem; border:1px solid #ccc">${nm}</td><td style="padding:0.25rem 0.5rem; text-align:right; border:1px solid #ccc">$${up.toFixed(2)}</td><td style="padding:0.25rem 0.5rem; text-align:center; border:1px solid #ccc">${q}</td><td style="padding:0.25rem 0.5rem; text-align:right; border:1px solid #ccc">$${tot.toFixed(2)}</td></tr>`
        })
        .join('')
      return `
          <div style="margin-bottom:1rem">
            <h3 style="margin:0.5rem 0 0.25rem 0; font-size:1rem">${escapeHtml(row.fixture ?? '—')} <span style="font-weight:400; color:#6b7280">(count ${Number(row.count)})</span>${input.stageTextByRowId?.[row.id] ? ` <span style="font-weight:600; color:#374151; margin-left:0.5rem">stage ${escapeHtml(input.stageTextByRowId[row.id] ?? '')}</span>` : ''}</h3>
            <table style="width:100%; border-collapse:collapse; font-size:0.875rem; margin-left:0.5rem">
              <thead style="background:#f9fafb"><tr><th style="padding:0.25rem 0.5rem; text-align:left; border:1px solid #ccc">Part</th><th style="padding:0.25rem 0.5rem; text-align:right; border:1px solid #ccc">Unit</th><th style="padding:0.25rem 0.5rem; text-align:center; border:1px solid #ccc">Qty</th><th style="padding:0.25rem 0.5rem; text-align:right; border:1px solid #ccc">Total</th></tr></thead>
              <tbody>${body}</tbody>
            </table>
          </div>`
    })
    .join('')
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${title}</title><style>
  body { font-family: sans-serif; margin: 1in; }
  @media print { body { margin: 0.5in; } }
</style></head><body>
  <h1>${title}</h1>
  <p style="font-size:0.875rem; color:#6b7280">Unit prices and extended costs per fixture (rough takeoff).</p>
  ${rowsHtml}
</body></html>`
}
