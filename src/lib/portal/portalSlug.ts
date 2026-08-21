/**
 * Custom portal address (slug) kernel — portal custom-links train PR B.
 * Mirrors the DB constraint on customer_portal_slugs.slug:
 * ^[a-z0-9][a-z0-9-]{1,58}[a-z0-9]$ (3–60 chars, letters/digits/dashes).
 */

export const SLUG_MIN = 3
export const SLUG_MAX = 60

export function isValidSlug(slug: string): boolean {
  return /^[a-z0-9][a-z0-9-]{1,58}[a-z0-9]$/.test(slug)
}

/**
 * Free-typing normalizer: lowercase, spaces/underscores → dashes, strip
 * everything else, collapse runs of dashes. Leading dashes are dropped so the
 * caret never fights the user; trailing dashes are kept while typing (the
 * validity check still fails until the slug ends cleanly).
 */
export function normalizeSlugInput(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/[\s_]+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-{2,}/g, '-')
    .replace(/^-+/, '')
    .slice(0, SLUG_MAX)
}

/** Suggested address for a customer: their name, slugified and trimmed clean. */
export function suggestSlugFromName(name: string): string {
  const slug = normalizeSlugInput(name).replace(/-+$/, '')
  return slug.length >= SLUG_MIN ? slug : ''
}

export type SlugGuessability = 'easy' | 'hard'

/**
 * ADVISORY guess-meter (never blocking): a short slug, or one plain word with
 * no digits or dashes, is the kind of address a stranger could type on a
 * hunch. Anything longer or composite reads as hard to stumble into.
 */
export function slugGuessability(slug: string): SlugGuessability {
  if (slug.length < 6) return 'easy'
  if (slug.length < 10 && !/[-0-9]/.test(slug)) return 'easy'
  return 'hard'
}

/** Non-confusable alphabet for random tails (no l/1/o/0). */
const TAIL_ALPHABET = 'abcdefghijkmnpqrstuvwxyz23456789'

/**
 * Append a hard-to-guess 4-char tail (the gear's 🎲). Pure append — the
 * caller passes the tail-less base (re-rolls reuse the same base so tails
 * never stack); rng is injectable for tests.
 */
export function appendRandomTail(slug: string, rng: () => number = Math.random): string {
  let base = slug.replace(/-+$/, '')
  if (base.length > SLUG_MAX - 5) base = base.slice(0, SLUG_MAX - 5).replace(/-+$/, '')
  let tail = ''
  for (let i = 0; i < 4; i++) {
    const idx = Math.min(TAIL_ALPHABET.length - 1, Math.floor(rng() * TAIL_ALPHABET.length))
    tail += TAIL_ALPHABET[idx]
  }
  return base ? `${base}-${tail}` : tail
}
