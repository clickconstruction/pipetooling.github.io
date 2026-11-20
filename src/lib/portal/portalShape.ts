/**
 * A prototype's switch on a public page (punch list #217, *Show it, don't say it*). The owner
 * asked on 2026-10-30 to see each shape live, side by side with how the page looks now, before she
 * approves it. A public page has no signed-in person to remember a switch for, so the switch is
 * the page's own URL: `?shape=1` draws the new shape in place of today's, and `?sbs=1` draws both
 * one above the other, captioned **Today** and the shape's own label. The side by side is for the
 * office: it draws only on a sample token (`t=sample…`) or for a signed-in dev, so a customer who
 * types it sees the page as it is. Real visitors see no change: neither flag is on any link we send.
 */

export type PortalShapeMode = 'today' | 'shape' | 'sideBySide'

export const PORTAL_SHAPE_PARAM = 'shape'
/** The caption over the new shape in the side by side; **Today** is over the other. */
export const PORTAL_SHAPE_LABEL = 'With the strip'
export const PORTAL_SIDE_BY_SIDE_PARAM = 'sbs'

/** The mode the page draws in, from its search params and who is looking. */
export function portalShapeMode(params: { get(name: string): string | null }, viewer: { sample: boolean; dev: boolean }): PortalShapeMode {
  if (params.get(PORTAL_SIDE_BY_SIDE_PARAM) === '1' && (viewer.sample || viewer.dev)) return 'sideBySide'
  if (params.get(PORTAL_SHAPE_PARAM) === '1') return 'shape'
  return 'today'
}

/** A sample page's door with the side-by-side flag on it: `/portal?t=sample&sbs=1`, `/t/sample?sbs=1`. */
export function withSideBySide(path: string): string {
  return `${path}${path.includes('?') ? '&' : '?'}${PORTAL_SIDE_BY_SIDE_PARAM}=1`
}
