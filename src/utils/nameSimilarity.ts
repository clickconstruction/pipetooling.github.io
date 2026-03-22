// Levenshtein distance for string similarity
function levenshteinDistance(a: string, b: string): number {
  const m = a.length
  const n = b.length
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array.from({ length: n + 1 }, () => 0))
  for (let i = 0; i <= m; i++) dp[i]![0] = i
  for (let j = 0; j <= n; j++) dp[0]![j] = j
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      const prev = dp[i - 1]!
      const curr = dp[i]!
      curr[j] = Math.min((prev[j] ?? 0) + 1, (curr[j - 1] ?? 0) + 1, (prev[j - 1] ?? 0) + cost)
    }
  }
  return dp[m]![n] ?? 0
}

/**
 * Returns similarity between two names (0–1). 1 = exact match, 0 = no match.
 * Uses Levenshtein distance normalized by max length.
 */
export function nameSimilarity(a: string, b: string): number {
  const na = a.trim().toLowerCase()
  const nb = b.trim().toLowerCase()
  if (na === nb) return 1
  if (na.length === 0 || nb.length === 0) return 0
  const maxLen = Math.max(na.length, nb.length)
  const dist = levenshteinDistance(na, nb)
  return 1 - dist / maxLen
}
