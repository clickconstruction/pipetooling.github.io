/** Normalized key for counting counterparties (trimmed; blank names share key `''`). */
export function counterpartyNameFrequencyKey(name: string | null | undefined): string {
  return (name ?? '').trim()
}

/** Frequencies of `counterparty_name` within `rows` (same normalization as {@link counterpartyNameFrequencyKey}). */
export function counterpartyFrequencyCountMap<T extends { counterparty_name: string | null }>(
  rows: readonly T[],
): Map<string, number> {
  const m = new Map<string, number>()
  for (const r of rows) {
    const k = counterpartyNameFrequencyKey(r.counterparty_name)
    m.set(k, (m.get(k) ?? 0) + 1)
  }
  return m
}

export type CounterpartyFrequencyListEntry = { label: string; count: number }

/**
 * Distinct trimmed `counterparty_name` values with count strictly greater than `minCountExclusive`,
 * sorted by count descending then label (localeCompare, base). Omits blank/empty names.
 */
export function counterpartyFrequenciesAboveMin<T extends { counterparty_name: string | null }>(
  rows: readonly T[],
  minCountExclusive = 2,
): CounterpartyFrequencyListEntry[] {
  const map = counterpartyFrequencyCountMap(rows)
  const out: CounterpartyFrequencyListEntry[] = []
  for (const [key, count] of map) {
    if (count <= minCountExclusive) continue
    if (key === '') continue
    out.push({ label: key, count })
  }
  out.sort((a, b) => {
    if (b.count !== a.count) return b.count - a.count
    return a.label.localeCompare(b.label, undefined, { sensitivity: 'base' })
  })
  return out
}
