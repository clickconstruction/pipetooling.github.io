/**
 * Quickfill station deep links (journey map Tier-2 #17, C11).
 *
 * Every Quickfill section already has a stable DOM id (`quickfill-<sectionId>`),
 * but until now nothing could address one from outside the page — every
 * cross-surface button landed at the top of 26 chips and hoped. This kernel
 * gives the page one address form, `/quickfill#<sectionId>` (also
 * `?station=<sectionId>`; the `quickfill-` DOM prefix is accepted too so a
 * copied element id works), and resolves it against the section registry and
 * the page's own eligibility predicate:
 *
 * - `found`  — a real station that renders for this user: force-expand + scroll.
 * - `hidden` — a real station the org hid or the role can't see: fail soft
 *              (toast "That section isn't on your Quickfill"), never a blank page.
 * - neither  — no station asked for, or an unknown id (also fails soft).
 *
 * Pure: the page owns the DOM, the toast, and the telemetry write.
 */

export type QuickfillStationMeta = { readonly id: string; readonly sectionId: string }

export type QuickfillStationResolution = {
  /** What the URL asked for, normalized (no `#`, no `quickfill-` prefix); '' when nothing was asked. */
  raw: string
  /** The registry sectionId when `raw` names a station, else null. */
  sectionId: string | null
  /** The DOM id to scroll to when found, else null. */
  domId: string | null
  /** A real station that renders for this user. */
  found: boolean
  /** A real station that does NOT render for this user (org-hidden or role/feature-gated). */
  hidden: boolean
}

const DOM_PREFIX = 'quickfill-'

/** `#quickfill-dispatch-inbox` / `#dispatch-inbox` / `?station=dispatch-inbox` → `dispatch-inbox`. */
export function parseQuickfillStationRequest(hash: string, search: string): string {
  const fromHash = (hash.startsWith('#') ? hash.slice(1) : hash).trim()
  let raw = fromHash
  if (!raw) {
    const params = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search)
    raw = (params.get('station') ?? '').trim()
  }
  if (!raw) return ''
  try {
    raw = decodeURIComponent(raw)
  } catch {
    /* keep the undecoded text; it simply won't match a station */
  }
  raw = raw.trim().toLowerCase()
  return raw.startsWith(DOM_PREFIX) ? raw.slice(DOM_PREFIX.length) : raw
}

export function resolveQuickfillStation(
  location: { hash: string; search: string },
  stations: ReadonlyArray<QuickfillStationMeta>,
  rendersForThisUser: (sectionId: string) => boolean,
): QuickfillStationResolution {
  const raw = parseQuickfillStationRequest(location.hash, location.search)
  if (!raw) return { raw, sectionId: null, domId: null, found: false, hidden: false }
  const meta = stations.find((s) => s.sectionId === raw)
  if (!meta) return { raw, sectionId: null, domId: null, found: false, hidden: false }
  const onPage = rendersForThisUser(meta.sectionId)
  return {
    raw,
    sectionId: meta.sectionId,
    domId: onPage ? meta.id : null,
    found: onPage,
    hidden: !onPage,
  }
}

/** The one address form every hand-off to Quickfill should use. */
export function quickfillStationHref(sectionId: string): string {
  return `/quickfill#${encodeURIComponent(sectionId)}`
}

/**
 * `ui_nav_clicks` target for the `station_deep_link` control: the station asked
 * for plus how it resolved, so Usage can count "found" against "hidden"/"unknown"
 * per station (`#dispatch-inbox found`).
 */
export function quickfillStationTelemetryTarget(r: QuickfillStationResolution): string {
  const outcome = r.found ? 'found' : r.hidden ? 'hidden' : 'unknown'
  return `#${r.sectionId ?? r.raw} ${outcome}`
}
