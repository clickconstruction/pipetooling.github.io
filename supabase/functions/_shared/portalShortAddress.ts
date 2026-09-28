/**
 * A short address for a customer who has a portal but never had one saved.
 *
 * The office saves `my.clickplumbing.com/<slug>` by hand in the globe; a customer without one
 * is handed their portal's 64-character token address, which nobody can type off an invoice
 * and which makes a dense QR code. So the first bill that points at the portal assigns one:
 * the customer's name plus a random tail (the globe's own default — the bare name would open
 * a statement to anyone who knows who we work for), locked at once since it has gone out.
 *
 * Only ever for a customer whose main link is active: no portal, or a revoked one, stays as
 * the office left it. The office can still change the address in the globe afterwards.
 * The candidates are pure and tested from `src/lib/portal/portalShortAddress.test.ts`.
 */
import { appendRandomTail, isValidSlug, suggestSlugFromName } from './portalSlug.ts'

const ATTEMPTS = 5
/** The base when a name has nothing a slug can keep (all symbols, or under three characters). */
export const SHORT_ADDRESS_FALLBACK_BASE = 'account'

/** A number in [0, 1) from the runtime's secure source — the tail is what keeps an address private. */
export function secureRandom(): number {
  const b = new Uint32Array(1)
  crypto.getRandomValues(b)
  return (b[0] as number) / 0x1_0000_0000
}

/** The addresses to try, in order: the same name with a different tail each time. */
export function shortAddressCandidates(customerName: string, rng: () => number = secureRandom, count: number = ATTEMPTS): string[] {
  const named = suggestSlugFromName(customerName)
  // A name that slugs to nothing gets two tails: a lone 4-character tail would be the whole secret.
  const base = named || appendRandomTail(SHORT_ADDRESS_FALLBACK_BASE, rng)
  const out: string[] = []
  for (let i = 0; i < count; i++) {
    const slug = appendRandomTail(base, rng)
    if (isValidSlug(slug) && !out.includes(slug)) out.push(slug)
  }
  return out
}

type LinkRow = { audience?: string | null; token?: string | null; revoked_at?: string | null }

/** True when the customer's main link is live — the only link a short address opens. */
export function hasActiveMainLink(links: ReadonlyArray<LinkRow> | null | undefined): boolean {
  return (links ?? []).some((l) => l.audience === 'all' && l.revoked_at == null && !!(l.token ?? '').trim())
}

/**
 * The customer's short address, assigning one when they have a live portal and none saved.
 * Null when there is nothing to assign or the write failed; never throws — the caller falls
 * back to the token address, and a bill goes out either way.
 */
// deno-lint-ignore no-explicit-any
export async function ensurePortalShortAddress(admin: any, customerId: string, createdBy: string | null): Promise<string | null> {
  try {
    const [{ data: links }, { data: slugRow }, { data: customer }] = await Promise.all([
      admin.from('customer_portal_links').select('audience, token, revoked_at').eq('customer_id', customerId).is('revoked_at', null),
      admin.from('customer_portal_slugs').select('slug').eq('customer_id', customerId).maybeSingle(),
      admin.from('customers').select('name').eq('id', customerId).maybeSingle(),
    ])
    const saved = typeof slugRow?.slug === 'string' ? slugRow.slug.trim() : ''
    if (saved) return saved
    if (!hasActiveMainLink(links as LinkRow[] | null)) return null

    const name = typeof customer?.name === 'string' ? customer.name : ''
    for (const slug of shortAddressCandidates(name)) {
      // Subs' addresses share the printed namespace (my.clickplumbing.com/<slug>).
      const { data: subTaken } = await admin.from('sub_portal_slugs').select('slug').eq('slug', slug).maybeSingle()
      if (subTaken) continue
      const { error } = await admin
        .from('customer_portal_slugs')
        .insert({ customer_id: customerId, slug, created_by: createdBy, locked_at: new Date().toISOString() })
      if (!error) {
        await admin.from('customer_portal_slug_events').insert([
          { customer_id: customerId, event: 'created', slug, created_by: createdBy },
          { customer_id: customerId, event: 'locked', slug, created_by: createdBy },
        ])
        return slug
      }
      // Another send may have assigned one a moment ago (the customer's row), or the address is taken (try the next tail).
      const { data: again } = await admin.from('customer_portal_slugs').select('slug').eq('customer_id', customerId).maybeSingle()
      const raced = typeof again?.slug === 'string' ? again.slug.trim() : ''
      if (raced) return raced
      if ((error as { code?: string }).code !== '23505') {
        console.error('ensurePortalShortAddress: insert failed', error)
        return null
      }
    }
    return null
  } catch (e) {
    console.error('ensurePortalShortAddress:', e)
    return null
  }
}
