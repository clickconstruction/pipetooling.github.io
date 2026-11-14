/**
 * A prototype's two doors on a public page (punch list #217, *Show it, don't say it*, the outside findings). A real
 * visitor sees no change: the shape draws only when the page's URL carries `?shape=1` (or `?shape=<key>`), and the
 * side-by-side, today's look over the shape, only when it carries `?sbs=1` (or `?sbs=<key>`) and the page is a sample
 * (`t=sample…`) or the viewer is a signed-in dev. Pure; `hooks/usePublicShapeView.ts` reads the URL, the token and the
 * sign-in. The `?sbs=` rule is `shapeView.ts`'s, the same every #217 prototype answers to.
 */
import { sampleStateFromToken } from '../../../supabase/functions/_shared/customerSample'
import { SIDE_BY_SIDE_PARAM, shapeViewAsked } from './shapeView'

/** `?shape=1`: draw the shape in place of today's look. */
export const SHAPE_PARAM = 'shape'

export interface PublicShapeView {
  /** Draw the shape alone, in place of today's look. */
  shape: boolean
  /** Draw today's look and the shape one above the other. Wins over `shape` when both are asked. */
  sideBySide: boolean
}

export function publicShapeView(input: { search: string; key: string; token?: string | null; dev: boolean }): PublicShapeView {
  const params = new URLSearchParams(input.search)
  const sample = sampleStateFromToken(input.token ?? params.get('t')) !== null
  const sideBySide = shapeViewAsked(params.get(SIDE_BY_SIDE_PARAM), input.key) && (sample || input.dev)
  const shape = shapeViewAsked(params.get(SHAPE_PARAM), input.key) && !sideBySide
  return { shape, sideBySide }
}

/** A page's address with `?sbs=1` on it, for the *Side by side* press beside each sample page. */
export function withSideBySide(url: string): string {
  if (new RegExp(`[?&]${SIDE_BY_SIDE_PARAM}=`).test(url)) return url
  return `${url}${url.includes('?') ? '&' : '?'}${SIDE_BY_SIDE_PARAM}=1`
}
