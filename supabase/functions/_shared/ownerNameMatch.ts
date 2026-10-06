/**
 * The owner's name, letter for letter (punch list #86, PR 1): what they type on the portal must
 * be the name the county roll has (or a second name the office allowed), compared by letters
 * alone — case, spaces, punctuation and accents do not count. `Umar Khan` matches `UMAR  KHAN`
 * and `umar-khan`; `U. Khan` does not. Pure, shared by the function that signs and the page
 * that hints.
 */

/** The letters and digits of a name, lower case, with accents and everything else stripped. */
export function foldOwnerName(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
}

/** True when the typed name is one of the allowed names, letter for letter. An empty name never matches. */
export function ownerNameLetterMatch(typed: string, allowed: ReadonlyArray<string>): boolean {
  const t = foldOwnerName(typed)
  if (!t) return false
  return allowed.some((a) => foldOwnerName(a) === t)
}
