/**
 * One name for an unnamed GC (J13-F4 / J15-F9 / J35-F4).
 *
 * A packet with no linked GC used to render four ways — letterhead "To —",
 * Bid Room panel "one durable link for — —", the picker's "the GC", and the
 * public room page "For: —" (the panel published the literal dash into the
 * room payload, so the GC's own email read "prepared for —"). Every surface
 * now asks here. Dash-only strings count as unnamed so rooms published with
 * the old fallback heal on read.
 */

export const UNNAMED_GC_LABEL = 'General contractor'

const DASH_ONLY = /^[\s\-–—‒―]*$/

/** Trimmed GC name, or `General contractor` when there is none (null, blank, or a bare dash). */
export function gcDisplayName(gc: { name?: string | null } | string | null | undefined): string {
  const raw = typeof gc === 'string' ? gc : gc?.name
  const trimmed = (raw ?? '').trim()
  return trimmed === '' || DASH_ONLY.test(trimmed) ? UNNAMED_GC_LABEL : trimmed
}
