/**
 * The tints, widths and colours of the plumbing drawings (punch list #119), in a file of their own so the parts
 * file exports components only (React fast refresh). See `plumbingParts.tsx` for the drawing language.
 */

export type Tint = 'cold' | 'hot' | 'waste' | 'air'

export const TINT: Record<Tint, string> = {
  cold: 'var(--bg-blue-200)',
  hot: 'var(--bg-red-100)',
  waste: 'var(--bg-amber-100)',
  air: 'var(--surface)',
}

/**
 * The house red for the arrow that fights the flow, as the lift strip marks the twist, and the green for the right
 * way. Both are theme tokens whose light values are the old hexes, so a verdict reads in dark mode too.
 */
export const WRONG = 'var(--text-red-700)'
export const RIGHT = 'var(--text-green-700)'

export const SUPPLY = 6
export const DRAIN = 13

export const SVG_STYLE = { display: 'block', width: '100%', height: 'auto', maxWidth: 420, color: 'var(--text-base)' } as const
