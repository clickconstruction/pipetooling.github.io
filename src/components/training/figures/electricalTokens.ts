/**
 * The tints and widths of the electrical drawings (punch list #120), in a file of their own so the parts file
 * exports components only (React fast refresh). See `electricalParts.tsx` for the drawing language.
 */
import { WRONG } from './plumbingTokens'

export type Wire = 'hot' | 'neutral' | 'ground'

/**
 * The hot is the plain ink line, as a black wire is black; the neutral is white, the surface colour with a grey
 * edge; the ground is the plumbing's waste amber for bare copper (green stays a verdict). No wire shares a tint with
 * the hot water pipe: the owner, 2026-10-18, red is for one thing only.
 */
export const WIRE: Record<Wire, string> = {
  hot: 'currentColor',
  neutral: 'var(--surface)',
  ground: 'var(--bg-amber-100)',
}

/** The conductor's width: one thin line, thinner than the narrowest pipe, so wire and pipe never read as one thing. */
export const CONDUCTOR = 2.4

/** The house red, used for one thing only in the whole course: current where it should not be, on its arrow. */
export const FAULT = WRONG
