/**
 * `escapeHtml` on its own (v2.6804): `htmlDoc.ts` touches `window` and `document`, so a pure kernel the edge
 * functions copy (`scripts/edge-kernels.mjs`) imports it from here. `htmlDoc.ts` re-exports it for everyone else.
 */
export function escapeHtml(s: string): string {
  return (s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}
