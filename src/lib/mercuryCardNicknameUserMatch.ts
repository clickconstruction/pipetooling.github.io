export type BankingAttributionUser = { id: string; name: string }

/**
 * First whitespace-delimited word of a display name.
 */
export function firstWordOfDisplayName(name: string): string {
  const t = name.trim()
  if (t === '') return ''
  const w = t.split(/\s+/)[0]
  return w ?? ''
}

/**
 * Lowercase, strip a trailing English possessive on the token ("Mike's" → "mike").
 * Used for exact equality between nickname and user first name (no fuzzy match).
 */
export function normalizeNameTokenForMatch(token: string): string {
  let t = token.trim().toLowerCase()
  if (t.endsWith("'s")) t = t.slice(0, -2)
  return t
}

/**
 * If the first word of the **card nickname** normalizes to exactly one banking-attribution
 * user’s first word, return that user; otherwise null (0 or 2+ matches).
 * No nickname (empty / only whitespace) → null.
 */
export function resolveUnambiguousUserFromCardNickname(
  cardNickname: string | null | undefined,
  users: BankingAttributionUser[] | null | undefined,
): BankingAttributionUser | null {
  if (users == null || users.length === 0) return null
  const raw = cardNickname?.trim() ?? ''
  if (raw === '') return null
  const nickFirst = firstWordOfDisplayName(raw)
  if (nickFirst === '') return null
  const nNick = normalizeNameTokenForMatch(nickFirst)
  if (nNick === '') return null

  const matches: BankingAttributionUser[] = []
  for (const u of users) {
    const uFirst = firstWordOfDisplayName(u.name)
    if (uFirst === '') continue
    if (normalizeNameTokenForMatch(uFirst) === nNick) matches.push(u)
  }
  if (matches.length === 1) return matches[0]!
  return null
}
