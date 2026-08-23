/**
 * GC Review × portal (v2.2151): which portal link a GC's statement should
 * point at, resolved from the same two tables the globe modal reads.
 *
 * Rules (keep in sync with supabase/functions/gc-statement-email-dispatch/index.ts
 * `resolveGcPortalUrl` — the scheduled sends resolve server-side):
 *  1. An active GC-scoped link ("Separate view — GC bills only", audience 'gc')
 *     wins: the office created it on purpose for this GC's AP desk, and it can
 *     never show them anything but the bills they owe.
 *  2. Else the main link (audience 'all'): the short custom address when one is
 *     saved (`my.clickplumbing.com/<slug>`), otherwise the token link.
 *  3. Nothing active → null (portal turned off / never minted) — no card, and
 *     the Share item says so.
 */

export type PortalLinkRow = { customer_id: string; audience: string; token: string | null; revoked_at: string | null }
export type PortalSlugRow = { customer_id: string; slug: string; locked_at: string | null }

export type GcPortalLink = {
  url: string
  /** 'gc' = scoped GC-bills-only view; 'all' = the full account view. */
  view: 'gc' | 'all'
  /** True when `url` is the short custom address (which locks on first share). */
  short: boolean
  slug: string | null
  slugLocked: boolean
}

export const PORTAL_SHORT_ORIGIN_FOR_LINKS = 'https://my.clickplumbing.com/'

export function portalTokenUrl(origin: string, token: string): string {
  return `${origin.replace(/\/$/, '')}/portal?t=${token}`
}

export function resolveGcPortalLink(
  customerId: string | null | undefined,
  links: ReadonlyArray<PortalLinkRow>,
  slugs: ReadonlyArray<PortalSlugRow>,
  origin: string,
): GcPortalLink | null {
  if (!customerId) return null
  const mine = links.filter((l) => l.customer_id === customerId && l.revoked_at == null && !!l.token)
  const gc = mine.find((l) => l.audience === 'gc')
  if (gc?.token) return { url: portalTokenUrl(origin, gc.token), view: 'gc', short: false, slug: null, slugLocked: false }
  const all = mine.find((l) => l.audience === 'all')
  if (!all?.token) return null
  const slugRow = slugs.find((s) => s.customer_id === customerId && (s.slug ?? '').trim())
  if (slugRow) {
    return { url: `${PORTAL_SHORT_ORIGIN_FOR_LINKS}${slugRow.slug.trim()}`, view: 'all', short: true, slug: slugRow.slug.trim(), slugLocked: !!slugRow.locked_at }
  }
  return { url: portalTokenUrl(origin, all.token), view: 'all', short: false, slug: null, slugLocked: false }
}

/** Share-menu caption for the resolved link. */
export function gcPortalLinkCaption(link: GcPortalLink): string {
  return link.view === 'gc' ? 'GC bills only' : 'full account'
}
