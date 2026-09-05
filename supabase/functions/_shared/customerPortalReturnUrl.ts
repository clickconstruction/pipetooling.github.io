/**
 * Which portal address a customer's Stripe receipt should send them back to
 * (journey-map J22-F3 / Tier-2 #38). Same two tables the globe modal and the
 * GC statement email read (`customer_portal_links`, `customer_portal_slugs`;
 * keep in step with `gc-statement-email-dispatch/index.ts` `resolveGcPortalUrl`
 * and `src/lib/portal/gcPortalLink.ts`), with the order the INVOICE needs:
 *
 *  1. The main link (audience 'all') wins — it is the address the globe
 *     advertises and the only view guaranteed to list a bill on the
 *     customer's own job: the short custom address when a slug is saved
 *     (`my.clickplumbing.com/<slug>`), otherwise its token URL.
 *  2. Else an active GC-scoped link ('gc') — the AP desk's view.
 *  3. Nothing active → null: no line on the receipt (portal off / never minted).
 *
 * Every URL carries `paid=1` so the portal page knows it is a receipt landing
 * (refetch cadence + `portal_return_from_stripe` telemetry). The
 * my.clickplumbing.com worker forwards the query string
 * (scripts/cloudflare/portal-link-shell.worker.js appends `url.search`).
 *
 * The pure resolver is Deno-free and tested from
 * `src/lib/portal/customerPortalReturnUrl.test.ts`.
 */

export const PORTAL_RETURN_SHORT_ORIGIN = 'https://my.clickplumbing.com/'

export type PortalReturnLinkRow = { audience: string; token: string | null; revoked_at?: string | null }

export function withPaidFlag(url: string): string {
  return `${url}${url.includes('?') ? '&' : '?'}paid=1`
}

export function resolvePortalReturnUrl(
  links: ReadonlyArray<PortalReturnLinkRow>,
  slug: string | null | undefined,
  appOrigin: string,
): string | null {
  const active = links.filter((l) => l.revoked_at == null && !!(l.token ?? '').trim())
  const origin = appOrigin.replace(/\/+$/, '')
  const all = active.find((l) => l.audience === 'all')
  if (all?.token) {
    const s = (slug ?? '').trim()
    return withPaidFlag(s ? `${PORTAL_RETURN_SHORT_ORIGIN}${s}` : `${origin}/portal?t=${all.token.trim()}`)
  }
  const gc = active.find((l) => l.audience === 'gc')
  if (gc?.token) return withPaidFlag(`${origin}/portal?t=${gc.token.trim()}`)
  return null
}

/**
 * DB-backed wrapper for the edge functions: reads the customer's active links
 * and saved slug with the service-role client, never throws (a receipt with
 * no return line beats a bill that failed to create).
 */
// deno-lint-ignore no-explicit-any
export async function loadPortalReturnUrl(admin: any, customerId: string, appOrigin: string): Promise<string | null> {
  try {
    const [{ data: links }, { data: slugRow }] = await Promise.all([
      admin.from('customer_portal_links').select('audience, token, revoked_at').eq('customer_id', customerId).is('revoked_at', null),
      admin.from('customer_portal_slugs').select('slug').eq('customer_id', customerId).maybeSingle(),
    ])
    const slug = typeof (slugRow as { slug?: unknown } | null)?.slug === 'string' ? (slugRow as { slug: string }).slug : null
    return resolvePortalReturnUrl((links ?? []) as PortalReturnLinkRow[], slug, appOrigin)
  } catch {
    return null
  }
}
