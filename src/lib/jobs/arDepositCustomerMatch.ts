/**
 * Deposit → payer matching for the AR bank-payments modal: reads the Mercury
 * counterparty (then the internal note, then the bank memo) and finds the one
 * customer or GC whose open billed lines this deposit most plausibly pays.
 *
 * Conservative by design — a wrong "From Reliant Health" header is worse than
 * none, so a name qualifies only on 2+ shared distinctive tokens or full
 * containment of one name in the other, and any tie between different payers
 * returns no match for that text field (the next field still gets a try).
 * The match only reorders/leads the chip UI; it never auto-applies anything.
 */

/** Legal suffixes and glue words that carry no identity. */
const PAYER_STOP_TOKENS = new Set([
  'a',
  'and',
  'co',
  'company',
  'corp',
  'corporation',
  'dba',
  'inc',
  'llc',
  'llp',
  'lp',
  'ltd',
  'of',
  'pc',
  'pllc',
  'the',
])

/**
 * Lowercased identity tokens of a payer/counterparty name (stop words and
 * single chars dropped). Runs of single letters merge first so dotted
 * initials survive: "T.F. Harper" → ['tf', 'harper'].
 */
export function payerNameTokens(name: string | null | undefined): string[] {
  const raw = (name ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .split(' ')
    .filter((t) => t.length > 0)
  const merged: string[] = []
  for (const t of raw) {
    const prev = merged[merged.length - 1]
    if (t.length === 1 && prev != null && prev.length === 1) merged[merged.length - 1] = prev + t
    else merged.push(t)
  }
  const seen = new Set<string>()
  const out: string[] = []
  for (const t of merged) {
    if (t.length < 2 || PAYER_STOP_TOKENS.has(t) || seen.has(t)) continue
    seen.add(t)
    out.push(t)
  }
  return out
}

/** The slice of a billed target the matcher needs (see `BankPaymentTarget`). */
export type PayerTargetSlice = {
  key: string
  /** `jobs_ledger.customer_name` for the target's job ('' when blank). */
  customerName: string
  /** The job's GC name when linked ('' otherwise) — GCs are usually the payer on GC jobs. */
  gcName: string
}

export type ArDepositTextSlice = {
  counterparty_name: string | null
  note: string | null
  external_memo: string | null
}

export type ArDepositCustomerMatch = {
  /** Display name of the matched payer, as stored on the jobs. */
  name: string
  /** Which deposit text named them. */
  source: 'counterparty' | 'note' | 'memo'
  /** Target keys belonging to this payer, in the order the targets were given. */
  targetKeys: string[]
}

type PayerGroup = { name: string; tokens: string[]; tokenSet: Set<string>; targetKeys: string[] }

function payerGroupsFromTargets(targets: PayerTargetSlice[]): PayerGroup[] {
  const byNorm = new Map<string, PayerGroup>()
  for (const t of targets) {
    for (const name of [t.customerName, t.gcName]) {
      const tokens = payerNameTokens(name)
      if (tokens.length === 0) continue
      const norm = tokens.join(' ')
      let g = byNorm.get(norm)
      if (!g) {
        const tokenSet = new Set(tokens)
        // Banks often shorten multi-word payers to initials ("Done Right
        // Foundation" deposits as "DRF") — the acronym joins the token set so
        // subset matching catches it. Match-only: never part of `tokens`, so
        // it can't inflate the shared-token score.
        if (tokens.length >= 2) {
          const acronym = tokens.map((x) => x[0]).join('')
          if (acronym.length >= 2 && !PAYER_STOP_TOKENS.has(acronym)) tokenSet.add(acronym)
        }
        g = { name: name.trim(), tokens, tokenSet, targetKeys: [] }
        byNorm.set(norm, g)
      }
      if (!g.targetKeys.includes(t.key)) g.targetKeys.push(t.key)
    }
  }
  return Array.from(byNorm.values())
}

function sharedTokenCount(fieldTokens: Set<string>, group: PayerGroup): number {
  let n = 0
  for (const t of group.tokens) if (fieldTokens.has(t)) n++
  return n
}

/** All of `inner`'s tokens appear in `outer`. */
function isSubset(inner: Iterable<string>, outer: Set<string>): boolean {
  for (const t of inner) if (!outer.has(t)) return false
  return true
}

function bestGroupForText(text: string | null, groups: PayerGroup[]): PayerGroup | null {
  const fieldTokens = new Set(payerNameTokens(text))
  if (fieldTokens.size === 0) return null
  let best: PayerGroup | null = null
  let bestScore = 0
  let tied = false
  for (const g of groups) {
    const shared = sharedTokenCount(fieldTokens, g)
    /** Full containment either way also qualifies — including a pure acronym hit ("DRF" ⊆ tokenSet of Done Right Foundation). */
    const contained = isSubset(g.tokens, fieldTokens) || isSubset(fieldTokens, g.tokenSet)
    if (shared < 2 && !contained) continue
    const score = Math.max(shared, contained ? 1 : 0)
    if (score > bestScore) {
      best = g
      bestScore = score
      tied = false
    } else if (score === bestScore && best && g.tokens.join(' ') !== best.tokens.join(' ')) {
      tied = true
    }
  }
  return tied ? null : best
}

/**
 * The payer this deposit most plausibly came from, or null when nothing
 * qualifies. Counterparty is tried first; the note and memo fields are
 * fallbacks — DRF-style check services put the real customer in the memo.
 */
export function matchArDepositToPayer(
  deposit: ArDepositTextSlice,
  targets: PayerTargetSlice[],
): ArDepositCustomerMatch | null {
  const groups = payerGroupsFromTargets(targets)
  if (groups.length === 0) return null
  const fields: Array<[ArDepositCustomerMatch['source'], string | null]> = [
    ['counterparty', deposit.counterparty_name],
    ['note', deposit.note],
    ['memo', deposit.external_memo],
  ]
  for (const [source, text] of fields) {
    const g = bestGroupForText(text, groups)
    if (g) return { name: g.name, source, targetKeys: g.targetKeys }
  }
  return null
}
