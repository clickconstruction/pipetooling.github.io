/**
 * A guide opened (punch list #187, PR 1, v2.5897): one `ui_nav_clicks` row per open of a guide in the
 * browser, control `guide_opened`, target `/help?g=<slug>#via=<door>`, so Settings → Usage can say
 * which guides are opened, by whom and through which door. Until this the ledger held 37,990 rows
 * and not one named a guide. The door rides on the address as `?via=`: the browser's own list and
 * search presses set it, a walk's link, a share page's bounce, a desk's ? card and an error line set
 * theirs, and a bare link reads as `link`. A slug no guide answers records `guide_missing` with the
 * same target, so a dead link in the wild is found by the readout and not by a person. The typed
 * search words are never recorded; the row holds the slug. Pure; `GuideBrowser` calls `recordNavClick`.
 */

export const GUIDE_OPENED_CONTROL = 'guide_opened'
export const GUIDE_MISSING_CONTROL = 'guide_missing'
/** The address's door param: `/help?g=<slug>&via=<door>`. */
export const GUIDE_DOOR_PARAM = 'via'

/**
 * Where an open came through. `list` and `search` are the Help page's own presses, `guide` a link
 * inside another guide, `link` a link on a surface (the default when nothing says), `walk` a
 * walkthrough's stop or footer, `share` the share page's bounce, `legend` a desk's ? card, `error` an
 * error line's door, `box` the header's go-anywhere box (punch list #181).
 */
export const GUIDE_DOORS = ['list', 'search', 'guide', 'link', 'walk', 'share', 'legend', 'error', 'box'] as const
export type GuideDoor = (typeof GUIDE_DOORS)[number]

export function isGuideDoor(raw: unknown): raw is GuideDoor {
  return typeof raw === 'string' && (GUIDE_DOORS as readonly string[]).includes(raw)
}

/** The door an address names, or `link` when it names none or one the app does not know. */
export function guideDoorOf(raw: string | null | undefined): GuideDoor {
  return isGuideDoor(raw) ? raw : 'link'
}

/** `/help?g=x#anchor` + `walk` → `/help?g=x&via=walk#anchor`; an address that already names a door is renamed, not doubled. */
export function withGuideDoor(href: string, door: GuideDoor): string {
  const hashAt = href.indexOf('#')
  const base = hashAt >= 0 ? href.slice(0, hashAt) : href
  const hash = hashAt >= 0 ? href.slice(hashAt) : ''
  const qAt = base.indexOf('?')
  const path = qAt >= 0 ? base.slice(0, qAt) : base
  const query = qAt >= 0 ? base.slice(qAt + 1) : ''
  const kept = query
    .split('&')
    .filter((p) => p && !p.startsWith(`${GUIDE_DOOR_PARAM}=`))
  kept.push(`${GUIDE_DOOR_PARAM}=${door}`)
  return `${path}?${kept.join('&')}${hash}`
}

/** The row's target: the guide's address with the door in the hash, so one row reads as one open through one door. */
export function guideOpenedTarget(slug: string, door: GuideDoor): string {
  return `/help?g=${encodeURIComponent(slug)}#${GUIDE_DOOR_PARAM}=${door}`
}

/** The row to write for one open: `guide_opened` for a guide, `guide_missing` for a slug no guide answers. */
export function guideOpenEvent(slug: string, known: boolean, rawDoor: string | null | undefined): { control: string; target: string } {
  return { control: known ? GUIDE_OPENED_CONTROL : GUIDE_MISSING_CONTROL, target: guideOpenedTarget(slug, guideDoorOf(rawDoor)) }
}

/** The readout's inverse: a row's target back to its slug and door; null for a target of another shape. */
export function parseGuideOpenedTarget(target: string): { slug: string; door: GuideDoor } | null {
  const m = /^\/help\?g=([^#&]+)#via=([a-z]+)$/.exec(target)
  if (!m) return null
  let slug: string
  try {
    slug = decodeURIComponent(m[1]!)
  } catch {
    return null
  }
  return { slug, door: guideDoorOf(m[2]) }
}
