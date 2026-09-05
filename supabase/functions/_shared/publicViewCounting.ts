/**
 * Public view counting — who counts as "the customer looked" (journey-map Tier-2 #37).
 *
 * The public surfaces (customer portal, sub portal, bid room) record one view row per
 * validated load. Before this module every load counted, so the office's own peeks —
 * the globe modal's preview iframe + Edit-chips fetch, "Preview as customer", an estimator
 * checking their own room link — were indistinguishable from a customer opening the page.
 * Every "view" on record was staff.
 *
 * Two independent signals say "don't count this":
 *   - `?preview=1` on the request — the office openers (globe modal iframe / Preview /
 *     Full screen, the chips fetch) pass it explicitly. The public page forwards it to
 *     its edge function.
 *   - a signed-in staff session — the public pages attach the browser's own Supabase
 *     access token when one exists (an office user opening a customer link from the
 *     browser they work in). The edge function verifies it with `auth.getUser`; any
 *     valid company account is staff (accounts exist only by invitation — customers,
 *     GCs and subs never sign in; the link is their credential).
 *
 * Dependency-free so the app imports the same predicate (`src/lib/publicViewCounting.ts`)
 * and tests it under vitest.
 */

/** The query flag the office openers add. Never part of a link the customer receives. */
export const PUBLIC_PREVIEW_PARAM = 'preview'

/** `?preview=1` / `true` / `yes` (case-insensitive) read as the office preview flag. */
export function isPreviewFlag(value: string | null | undefined): boolean {
  if (value == null) return false
  const v = value.trim().toLowerCase()
  return v === '1' || v === 'true' || v === 'yes'
}

/** The one rule: a view counts only when it is neither a preview nor a staff session. */
export function shouldCountPublicView(input: { preview: boolean; isStaff: boolean }): boolean {
  return !input.preview && !input.isStaff
}

/**
 * Appends `preview=1` to a page or function URL (keeps existing params / hash). Idempotent —
 * a URL that already carries the flag comes back unchanged.
 */
export function withPreviewFlag(url: string): string {
  if (!url) return url
  const hashAt = url.indexOf('#')
  const base = hashAt >= 0 ? url.slice(0, hashAt) : url
  const hash = hashAt >= 0 ? url.slice(hashAt) : ''
  const qAt = base.indexOf('?')
  const query = qAt >= 0 ? base.slice(qAt + 1) : ''
  const params = query.split('&').filter(Boolean)
  const has = params.some((p) => {
    const eq = p.indexOf('=')
    const key = eq >= 0 ? p.slice(0, eq) : p
    return decodeURIComponent(key) === PUBLIC_PREVIEW_PARAM && isPreviewFlag(eq >= 0 ? decodeURIComponent(p.slice(eq + 1)) : '')
  })
  if (has) return url
  params.push(`${PUBLIC_PREVIEW_PARAM}=1`)
  const path = qAt >= 0 ? base.slice(0, qAt) : base
  return `${path}?${params.join('&')}${hash}`
}

/**
 * The bearer token from an `Authorization` header when it is a USER token — i.e. present
 * and not the project's anon key (the public pages send the anon key as their default
 * Authorization, which proves nothing about who is looking). Returns null otherwise.
 */
export function userBearerToken(authorization: string | null | undefined, anonKey: string | null | undefined): string | null {
  if (!authorization) return null
  const m = /^Bearer\s+(.+)$/i.exec(authorization.trim())
  const token = m?.[1]?.trim()
  if (!token) return null
  if (anonKey && token === anonKey) return null
  return token
}

/** The slice of a Supabase client `requestIsStaff` needs — structural so this file stays dependency-free. */
export type StaffVerifier = {
  auth: { getUser(jwt: string): Promise<{ data: { user: unknown | null }; error: unknown | null }> }
}

/**
 * True when the request carries a valid signed-in user's access token. Anything that is not
 * a verifiable user token (absent, the anon key, expired, garbage) is NOT staff — the failure
 * mode is "count it", never "hide a customer's open".
 */
export async function requestIsStaff(
  req: { headers: { get(name: string): string | null } },
  admin: StaffVerifier,
  anonKey: string | null | undefined,
): Promise<boolean> {
  const jwt = userBearerToken(req.headers.get('authorization'), anonKey)
  if (!jwt) return false
  try {
    const { data, error } = await admin.auth.getUser(jwt)
    return !error && !!data?.user
  } catch {
    return false
  }
}

/**
 * The counting decision for one public request: reads `?preview=` and verifies the
 * session in one call. `isStaff` is also what the customer-portal function keys the
 * office-only `officeViewStats` payload on.
 */
export async function publicViewDecision(
  req: { url: string; headers: { get(name: string): string | null } },
  admin: StaffVerifier,
  anonKey: string | null | undefined,
): Promise<{ preview: boolean; isStaff: boolean; count: boolean }> {
  const preview = isPreviewFlag(new URL(req.url).searchParams.get(PUBLIC_PREVIEW_PARAM))
  const isStaff = await requestIsStaff(req, admin, anonKey)
  return { preview, isStaff, count: shouldCountPublicView({ preview, isStaff }) }
}
