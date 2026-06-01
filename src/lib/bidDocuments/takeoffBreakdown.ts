/**
 * Pure builders for the Bids -> Takeoffs "Print" documents.
 *
 * Extracted from `src/pages/Bids.tsx` (`printTakeoffBreakdown`). There are two variants matching
 * the bid's materials model:
 *   - `rough`  : one table per fixture of (part, unit price, qty, extended total).
 *   - `exact`  : parts/assemblies grouped per stage, then per fixture, for audit.
 *
 * Both are pure HTML-string builders. The caller (`Bids.tsx`) does all async data gathering
 * (supabase part-name lookups, `expandTemplate`, sorting, stage-label mapping) and then prints the
 * result via `printHtmlInNewWindow`. No DOM/React/Supabase here.
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
}

export interface ExactTakeoffBreakdownInput {
  /** Raw (unescaped) document title; the builder escapes it. */
  title: string
  stages: Array<{
    /** Already mapped via STAGE_LABELS by the caller. */
    stageLabel: string
    rows: Array<{
      fixture: string
      count: number
      /** Pre-sorted by the caller. */
      parts: Array<{ partName: string; quantity: number; templateName: string }>
    }>
  }>
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
            <h3 style="margin:0.5rem 0 0.25rem 0; font-size:1rem">${escapeHtml(row.fixture ?? '—')} <span style="font-weight:400; color:#6b7280">(count ${Number(row.count)})</span></h3>
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

export function buildExactTakeoffBreakdownHtml(input: ExactTakeoffBreakdownInput): string {
  const title = escapeHtml(input.title)
  const sectionHtmls = input.stages.map((stage) => {
    let stageHtml = `<h2 style="margin-top:1.5rem; margin-bottom:0.75rem; border-bottom:1px solid #ccc; padding-bottom:0.25rem">${stage.stageLabel}</h2>`
    for (const row of stage.rows) {
      const partRows = row.parts
        .map((p) => `<tr><td style="padding:0.25rem 0.5rem; border:1px solid #ccc">${escapeHtml(p.partName)}</td><td style="padding:0.25rem 0.5rem; text-align:center; border:1px solid #ccc">${p.quantity}</td><td style="padding:0.25rem 0.5rem; border:1px solid #ccc">${escapeHtml(p.templateName)}</td></tr>`)
        .join('')
      stageHtml += `
          <div style="margin-bottom:1rem">
            <h3 style="margin:0.5rem 0 0.25rem 0; font-size:1rem">${escapeHtml(row.fixture)} (Count: ${row.count})</h3>
            <table style="width:100%; border-collapse:collapse; font-size:0.875rem; margin-left:0.5rem">
              <thead style="background:#f9fafb"><tr><th style="padding:0.25rem 0.5rem; text-align:left; border:1px solid #ccc">Part</th><th style="padding:0.25rem 0.5rem; text-align:center; border:1px solid #ccc">Qty</th><th style="padding:0.25rem 0.5rem; text-align:left; border:1px solid #ccc">Assembly</th></tr></thead>
              <tbody>${partRows}</tbody>
            </table>
          </div>`
    }
    return stageHtml
  })
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${title}</title><style>
  body { font-family: sans-serif; margin: 1in; }
  table { width: 100%; border-collapse: collapse; margin-top: 0.5rem; }
  th, td { border: 1px solid #ccc; padding: 0.25rem 0.5rem; }
  th { background: #f9fafb; }
  @media print { body { margin: 0.5in; } }
</style></head><body>
  <h1>${title}</h1>
  <p style="font-size:0.875rem; color:#6b7280">Breakdown of parts and assemblies per stage for audit.</p>
  ${sectionHtmls.join('')}
</body></html>`
}
