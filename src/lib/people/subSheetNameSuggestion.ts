/**
 * Conservative roster suggestion for unattributed sub sheets (People → Subs
 * "Unattributed sheets" panel). Given a sheet's raw `assigned_to_name` and the
 * active roster, suggest the ONE person the raw name almost certainly means —
 * or nothing. A wrong one-tap link is worse than none, so:
 *
 *   Tier 1 — exact normalized match ("behar  kraja." → "Behar Kraja")
 *   Tier 2 — first-initial + last-name ("J Ramos" / "Jesse R." ↔ "Jesse Ramos")
 *   Tier 3 — single-token containment ("Ramos" → "Jesse Ramos"; roster "Kyle"
 *            ← raw "Kyle B") — tokens must be ≥ 3 chars to avoid initials.
 *
 * A tier that matches MULTIPLE people is ambiguous and returns null outright
 * (no fall-through — if two people match exactly, a looser rule can't help).
 * Zero matches falls through to the next tier. Pure, no I/O.
 */

export type RosterCandidate = { personId: string; name: string }

/** Lowercase, strip punctuation, collapse whitespace. */
export function normalizeName(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

const MIN_CONTAINMENT_TOKEN = 3

function initialLastMatch(a: string[], b: string[]): boolean {
  // a's first token is a single initial matching b's first token; last names equal.
  if (a.length < 2 || b.length < 2) return false
  if (a[a.length - 1] !== b[b.length - 1]) return false
  const aFirst = a[0]!
  const bFirst = b[0]!
  return aFirst.length === 1 ? aFirst === bFirst[0] : bFirst.length === 1 ? bFirst === aFirst[0] : false
}

function containmentMatch(raw: string[], candidate: string[]): boolean {
  // Raw is a single token found among the candidate's tokens ("Ramos" → "Jesse Ramos"),
  // or the candidate is a single token found among the raw tokens ("Kyle B" → "Kyle").
  if (raw.length === 1 && raw[0]!.length >= MIN_CONTAINMENT_TOKEN) return candidate.includes(raw[0]!)
  if (candidate.length === 1 && candidate[0]!.length >= MIN_CONTAINMENT_TOKEN) return raw.includes(candidate[0]!)
  return false
}

/** The single near-certain roster match for a raw sheet name, else null. */
export function suggestSubSheetAssignee(rawAssignedTo: string, roster: RosterCandidate[]): RosterCandidate | null {
  // A ' | '-delimited multi-name string names several people on purpose —
  // one-tapping the whole sheet to a single person would be a wrong guess.
  if (rawAssignedTo.split('|').filter((s) => s.trim()).length > 1) return null
  const raw = normalizeName(rawAssignedTo)
  if (!raw) return null
  const rawTokens = raw.split(' ')

  const normalized = roster.map((r) => ({ candidate: r, norm: normalizeName(r.name) })).filter((r) => r.norm)

  const tiers: Array<(c: { norm: string }) => boolean> = [
    (c) => c.norm === raw,
    (c) => initialLastMatch(rawTokens, c.norm.split(' ')),
    (c) => containmentMatch(rawTokens, c.norm.split(' ')),
  ]
  for (const matches of tiers) {
    const hits = normalized.filter(matches)
    if (hits.length === 1) return hits[0]!.candidate
    if (hits.length > 1) return null // ambiguous — never guess
  }
  return null
}
