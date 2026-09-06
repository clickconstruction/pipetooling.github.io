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

/**
 * The DEFAULT suggestion for a new address (journey-map B18 / J21-F6):
 * the customer's name PLUS a random tail. The bare name alone opens their
 * full statement to anyone who knows the short origin and who we work
 * for — so the safe form is the default and the plain name is the edit.
 * Returns the tail-less base too so a re-roll swaps the tail instead of
 * stacking one. Existing saved slugs are never touched — this only runs
 * when no address has been saved yet.
 */
export function suggestSlugWithTail(name: string, rng: () => number = Math.random): { base: string; slug: string } {
  const base = suggestSlugFromName(name)
  return { base, slug: base ? appendRandomTail(base, rng) : '' }
}

export type SlugGuessabilityReason = 'short' | 'plain-word' | 'just-their-name' | 'has-tail' | 'composite'

export type SlugGuessabilityDetail = { grade: SlugGuessability; reason: SlugGuessabilityReason }

const TAIL_RE = new RegExp(`-[${TAIL_ALPHABET}]{4}$`)

/**
 * The guess-meter WITH its reason (still advisory, never blocking). When the
 * caller passes the name-derived suggestion, a slug that IS that name grades
 * easy however long it is — "knight-contracting" is not hard to guess for
 * anyone who knows we work for Knight Contracting.
 */
export function slugGuessabilityDetail(slug: string, nameSuggestion?: string): SlugGuessabilityDetail {
  const s = slug.replace(/-+$/, '')
  if (s.length < 6) return { grade: 'easy', reason: 'short' }
  if (nameSuggestion && s === nameSuggestion.replace(/-+$/, '')) return { grade: 'easy', reason: 'just-their-name' }
  if (s.length < 10 && !/[-0-9]/.test(s)) return { grade: 'easy', reason: 'plain-word' }
  if (TAIL_RE.test(s) && s.length > 5) return { grade: 'hard', reason: 'has-tail' }
  return { grade: 'hard', reason: 'composite' }
}

/** The meter's one-line label — identical wording in every globe. */
export function slugGuessabilityLabel(detail: SlugGuessabilityDetail): string {
  switch (detail.reason) {
    case 'short':
      return '⚠ easy to guess — too short'
    case 'plain-word':
      return '⚠ easy to guess — one plain word'
    case 'just-their-name':
      return "⚠ easy to guess — it's just their name"
    case 'has-tail':
      return '✓ hard to guess — random tail'
    case 'composite':
      return '✓ hard to guess'
  }
}
