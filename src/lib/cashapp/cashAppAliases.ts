/**
 * Who a Cash App payment is for. Cash App names ("Abe Whites", "michael Archambault") rarely equal
 * app person names ("Abraham", "Michael A"), and two people are paid through someone else's
 * account (Tristen through Taunya when the note says "Tristen"; Malachi through Jessica Whites).
 * An alias row ties a counterparty to a person, or marks it not staff, with an optional note rule
 * that redirects to another person when the note contains a word.
 */

export type CashAppAlias = {
  /** `aliasKey(counterparty)`. */
  counterpartyKey: string
  personName: string | null
  notStaff: boolean
  /** When set and the note contains it (case-insensitive), the payment is for `notePersonName`. */
  noteContains: string | null
  notePersonName: string | null
}

export type CashAppResolution =
  | { kind: 'person'; personName: string; viaProxy: boolean }
  | { kind: 'not_staff' }
  | { kind: 'unknown' }

export function aliasKey(counterparty: string): string {
  return counterparty.trim().toLowerCase().replace(/\s+/g, ' ')
}

export function resolveCashAppPerson(
  tx: { counterparty: string; note: string },
  aliases: ReadonlyMap<string, CashAppAlias> | readonly CashAppAlias[],
): CashAppResolution {
  const map = aliases instanceof Map ? aliases : new Map((aliases as readonly CashAppAlias[]).map((a) => [a.counterpartyKey, a]))
  const a = map.get(aliasKey(tx.counterparty))
  if (!a) return { kind: 'unknown' }
  if (a.notStaff) return { kind: 'not_staff' }
  if (a.noteContains && a.notePersonName && tx.note.toLowerCase().includes(a.noteContains.toLowerCase())) {
    return { kind: 'person', personName: a.notePersonName, viaProxy: true }
  }
  if (!a.personName) return { kind: 'unknown' }
  return { kind: 'person', personName: a.personName, viaProxy: false }
}

/** Distinct unresolved counterparties in a batch, biggest money first — the alias step's to-do. */
export function unresolvedCounterparties(
  txs: readonly { counterparty: string; note: string; amount: number }[],
  aliases: ReadonlyMap<string, CashAppAlias> | readonly CashAppAlias[],
): Array<{ counterparty: string; count: number; total: number; notes: string[] }> {
  const out = new Map<string, { counterparty: string; count: number; total: number; notes: Set<string> }>()
  for (const tx of txs) {
    if (resolveCashAppPerson(tx, aliases).kind !== 'unknown') continue
    const key = aliasKey(tx.counterparty)
    let e = out.get(key)
    if (!e) {
      e = { counterparty: tx.counterparty.trim(), count: 0, total: 0, notes: new Set() }
      out.set(key, e)
    }
    e.count += 1
    e.total += Math.abs(tx.amount)
    if (tx.note.trim()) e.notes.add(tx.note.trim())
  }
  return [...out.values()]
    .map((e) => ({ counterparty: e.counterparty, count: e.count, total: Math.round(e.total * 100) / 100, notes: [...e.notes].sort().slice(0, 6) }))
    .sort((x, y) => y.total - x.total)
}
