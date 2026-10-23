/**
 * Account facts for the Account nicknames modal (punch list #155): what the ledger
 * holds for each Mercury account, so a dev can tell the accounts apart without
 * opening Mercury and matching transactions by eye. Pure — built from the rows the
 * Banking page already loaded; unit-tested in `accountFacts.test.ts`.
 *
 * Per account: how many transactions, the first and last date, the money in and
 * out, the counterparties that recur most and the newest lines. The order the
 * modal shows accounts in is `orderAccountsForNaming`: the unnamed first, busiest
 * first, then the named by nickname.
 */

/** The columns the facts need — `mercury_transactions` rows satisfy it structurally. */
export type AccountFactsInputRow = {
  id: string
  mercury_account_id: string
  amount: number
  kind: string
  counterparty_name: string | null
  posted_at: string | null
  created_at: string
}

export type AccountRecentLine = {
  id: string
  /** `posted_at`, or `created_at` for a row that has not posted. */
  whenIso: string | null
  counterparty: string
  amount: number
  kind: string
}

export type AccountCounterparty = { name: string; count: number }

export type AccountFacts = {
  accountId: string
  count: number
  firstIso: string | null
  lastIso: string | null
  /** Sum of the positive amounts. */
  inUsd: number
  /** Sum of the negative amounts, as a positive figure. */
  outUsd: number
  /** Newest first. */
  recent: AccountRecentLine[]
  /** Most frequent first, ties by name. */
  frequent: AccountCounterparty[]
}

export const ACCOUNT_FACTS_RECENT_CAP = 4
export const ACCOUNT_FACTS_FREQUENT_CAP = 3

/** What the modal prints for a row with no counterparty name. */
export const ACCOUNT_FACTS_NO_COUNTERPARTY = 'No counterparty'

/** One Mercury account as `get-mercury-account-balances` lists it. */
export type MercuryListedAccount = { id: string; name: string; kind: string | null; currentBalance: number }

function rowWhenIso(r: AccountFactsInputRow): string | null {
  return r.posted_at ?? r.created_at ?? null
}

function whenMs(iso: string | null): number {
  if (!iso) return Number.NaN
  const t = new Date(iso).getTime()
  return Number.isNaN(t) ? Number.NaN : t
}

/** Newest first; rows with no readable date sink to the end; ties by id so the order is stable. */
function compareNewestFirst(a: AccountFactsInputRow, b: AccountFactsInputRow): number {
  const ta = whenMs(rowWhenIso(a))
  const tb = whenMs(rowWhenIso(b))
  const aOk = !Number.isNaN(ta)
  const bOk = !Number.isNaN(tb)
  if (!aOk && !bOk) return a.id.localeCompare(b.id)
  if (!aOk) return 1
  if (!bOk) return -1
  if (tb !== ta) return tb - ta
  return a.id.localeCompare(b.id)
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

export function emptyAccountFacts(accountId: string): AccountFacts {
  return { accountId, count: 0, firstIso: null, lastIso: null, inUsd: 0, outUsd: 0, recent: [], frequent: [] }
}

/**
 * The facts for every account present in `rows`. An account with no rows is not in
 * the map; read it through `accountFactsFor`, which answers the empty facts.
 */
export function buildAccountFacts(
  rows: readonly AccountFactsInputRow[],
  opts?: { recentCap?: number; frequentCap?: number },
): Map<string, AccountFacts> {
  const recentCap = Math.max(0, opts?.recentCap ?? ACCOUNT_FACTS_RECENT_CAP)
  const frequentCap = Math.max(0, opts?.frequentCap ?? ACCOUNT_FACTS_FREQUENT_CAP)
  const byAccount = new Map<string, AccountFactsInputRow[]>()
  for (const r of rows) {
    const id = (r.mercury_account_id ?? '').trim()
    if (!id) continue
    const list = byAccount.get(id)
    if (list) list.push(r)
    else byAccount.set(id, [r])
  }
  const out = new Map<string, AccountFacts>()
  for (const [accountId, list] of byAccount) {
    const sorted = [...list].sort(compareNewestFirst)
    let inUsd = 0
    let outUsd = 0
    const counts = new Map<string, { name: string; count: number }>()
    for (const r of sorted) {
      const amt = Number(r.amount)
      if (Number.isFinite(amt)) {
        if (amt > 0) inUsd += amt
        else if (amt < 0) outUsd += -amt
      }
      const name = (r.counterparty_name ?? '').trim() || ACCOUNT_FACTS_NO_COUNTERPARTY
      const key = name.toLowerCase()
      const c = counts.get(key)
      if (c) c.count += 1
      else counts.set(key, { name, count: 1 })
    }
    const dated = sorted.filter((r) => !Number.isNaN(whenMs(rowWhenIso(r))))
    const lastIso = dated.length > 0 ? rowWhenIso(dated[0]!) : null
    const firstIso = dated.length > 0 ? rowWhenIso(dated[dated.length - 1]!) : null
    const frequent = [...counts.values()]
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
      .slice(0, frequentCap)
    const recent: AccountRecentLine[] = sorted.slice(0, recentCap).map((r) => ({
      id: r.id,
      whenIso: rowWhenIso(r),
      counterparty: (r.counterparty_name ?? '').trim() || ACCOUNT_FACTS_NO_COUNTERPARTY,
      amount: Number(r.amount) || 0,
      kind: r.kind,
    }))
    out.set(accountId, {
      accountId,
      count: sorted.length,
      firstIso,
      lastIso,
      inUsd: round2(inUsd),
      outUsd: round2(outUsd),
      recent,
      frequent,
    })
  }
  return out
}

/** The facts for one account, the empty facts when the ledger holds nothing for it. */
export function accountFactsFor(facts: ReadonlyMap<string, AccountFacts>, accountId: string): AccountFacts {
  return facts.get(accountId) ?? emptyAccountFacts(accountId)
}

function hasNickname(nicknameByAccount: Readonly<Record<string, string | null | undefined>>, id: string): boolean {
  const n = nicknameByAccount[id]
  return n != null && n.trim() !== ''
}

/**
 * The order the modal lists accounts in: the unnamed first, the busiest of them
 * first (most transactions, then the newest activity), then the named by nickname.
 * Ids are deduped and blank ids dropped.
 */
export function orderAccountsForNaming(
  accountIds: readonly string[],
  nicknameByAccount: Readonly<Record<string, string | null | undefined>>,
  facts: ReadonlyMap<string, AccountFacts>,
): string[] {
  const ids = [...new Set(accountIds.map((id) => id.trim()).filter((id) => id !== ''))]
  const unnamed = ids.filter((id) => !hasNickname(nicknameByAccount, id))
  const named = ids.filter((id) => hasNickname(nicknameByAccount, id))
  unnamed.sort((a, b) => {
    const fa = accountFactsFor(facts, a)
    const fb = accountFactsFor(facts, b)
    if (fb.count !== fa.count) return fb.count - fa.count
    const la = whenMs(fa.lastIso)
    const lb = whenMs(fb.lastIso)
    const aOk = !Number.isNaN(la)
    const bOk = !Number.isNaN(lb)
    if (aOk && bOk && lb !== la) return lb - la
    if (aOk !== bOk) return aOk ? -1 : 1
    return a.localeCompare(b)
  })
  named.sort((a, b) => {
    const c = (nicknameByAccount[a] ?? '').trim().localeCompare((nicknameByAccount[b] ?? '').trim(), 'en', { sensitivity: 'base' })
    return c !== 0 ? c : a.localeCompare(b)
  })
  return [...unnamed, ...named]
}

/** Mercury's account kinds in plain words: `mercury` is its checking account. */
export function formatMercuryAccountKind(kind: string | null | undefined): string | null {
  if (!kind) return null
  const k = kind.trim()
  if (!k) return null
  const known: Record<string, string> = {
    mercury: 'Checking',
    checking: 'Checking',
    savings: 'Savings',
    treasury: 'Treasury',
    creditcard: 'Credit card',
    credit: 'Credit card',
  }
  const hit = known[k.toLowerCase()]
  if (hit) return hit
  return k.charAt(0).toUpperCase() + k.slice(1)
}

/** Mercury's list by id, trimmed, so a card can look its account up. */
export function indexMercuryAccounts(list: readonly MercuryListedAccount[]): Map<string, MercuryListedAccount> {
  const m = new Map<string, MercuryListedAccount>()
  for (const a of list) {
    const id = (a.id ?? '').trim()
    if (id) m.set(id, a)
  }
  return m
}
