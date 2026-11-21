/**
 * The dev-only side-by-side's URL rule (punch list #217, *Show it, don't say it*): `?sbs=1`,
 * `?sbs=all` or `?sbs=true` asks for every prototype on the page, `?sbs=<key>` for one, and a
 * comma joins several. Pure; `components/prototypes/SideBySide.tsx` adds the dev check and the frame.
 */

export const SIDE_BY_SIDE_PARAM = 'sbs'

/** Whether `?sbs=` asks for the prototype named `key`. */
export function shapeViewAsked(sbs: string | null, key: string): boolean {
  if (!sbs) return false
  const asked = sbs.split(',').map((s) => s.trim().toLowerCase())
  return asked.some((a) => a === '1' || a === 'all' || a === 'true' || a === key.toLowerCase())
}
