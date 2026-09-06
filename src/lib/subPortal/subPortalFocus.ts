/**
 * "Show me on their portal" (sheet story follow-up): the office opens the
 * sub's portal with `?focus=sheet:<laborJobId>` or `?focus=offer:<orderId>`;
 * the portal scrolls that card into view and pulses a halo around the part
 * the sub is looking at, so what the story's "The sub sees" line describes
 * is unmistakable on the page. Pure: no React, no DOM.
 */

export const SUB_PORTAL_FOCUS_PARAM = 'focus'

export type SubPortalFocus = { kind: 'sheet' | 'offer'; id: string }

const ID_OK = /^[A-Za-z0-9_-]{1,64}$/

export function parseSubPortalFocus(raw: string | null | undefined): SubPortalFocus | null {
  const s = (raw ?? '').trim()
  const at = s.indexOf(':')
  if (at <= 0) return null
  const kind = s.slice(0, at)
  const id = s.slice(at + 1)
  if ((kind !== 'sheet' && kind !== 'offer') || !ID_OK.test(id)) return null
  return { kind, id }
}

export function subPortalFocusValue(f: SubPortalFocus): string {
  return `${f.kind}:${f.id}`
}

/** The DOM id the portal puts on the focusable part of a card. */
export function subPortalFocusDomId(f: SubPortalFocus): string {
  return `sp-focus-${f.kind}-${f.id}`
}

export function isSubPortalFocused(focus: SubPortalFocus | null | undefined, kind: SubPortalFocus['kind'], id: string): boolean {
  return !!focus && focus.kind === kind && focus.id === id
}

/** Appends the focus param to a portal URL, keeping any hash where it was. */
export function withSubPortalFocus(url: string, f: SubPortalFocus): string {
  if (!url) return url
  const hashAt = url.indexOf('#')
  const base = hashAt >= 0 ? url.slice(0, hashAt) : url
  const hash = hashAt >= 0 ? url.slice(hashAt) : ''
  const pair = `${SUB_PORTAL_FOCUS_PARAM}=${encodeURIComponent(subPortalFocusValue(f))}`
  const qAt = base.indexOf('?')
  if (qAt < 0) return `${base}?${pair}${hash}`
  const kept = base
    .slice(qAt + 1)
    .split('&')
    .filter((p) => p && !p.startsWith(`${SUB_PORTAL_FOCUS_PARAM}=`))
  kept.push(pair)
  return `${base.slice(0, qAt)}?${kept.join('&')}${hash}`
}
