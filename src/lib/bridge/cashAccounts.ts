import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../../types/database'
import { withSupabaseRetry } from '../../utils/errorHandling'
import { formatMercuryAccountKind } from '../banking/accountFacts'
import { shortK } from './headline'
import { parseMercuryCash, type MercuryAccount, type MercuryCash } from './mercuryCash'

/**
 * Every account in the bank, and which of them count as cash on hand (v2.6838, punch list #303).
 *
 * The owner's words, 2026-11-10: the bank the page reads is the whole bank, "but also I would
 * like to know how much is in every account as sometimes I want to account for Accounts
 * Payable in the balance and sometimes I don't". So the Bridge lists each account by the name
 * it carries in Mercury with what it holds, and each has a switch. An account switched off is
 * left out of cash on hand, and so out of the forecast, the cash tile and the cash rule; the
 * page says so wherever the figure shows. The choice is one `app_settings` row beside the
 * floor, so it stands until it is flipped back.
 *
 * This kernel is not copied to the edge functions (`mercuryCash.ts` is, so it stays as it was):
 * the weekly email still counts the whole bank until the train's last PR redraws it.
 */

export const BRIDGE_ACCOUNTS_OUT_SETTING_KEY = 'bridge_cash_accounts_out_v1'

/** Pure: the function's body → the name each account was given in Mercury, by account id. */
export function parseBankNicknames(body: unknown): Map<string, string> {
  const out = new Map<string, string>()
  const accounts = (body as { accounts?: unknown } | null)?.accounts
  if (!Array.isArray(accounts)) return out
  for (const a of accounts) {
    const r = (a ?? {}) as Record<string, unknown>
    const id = typeof r.id === 'string' ? r.id : ''
    const nick = typeof r.nickname === 'string' ? r.nickname.trim() : ''
    if (id && nick) out.set(id, nick)
  }
  return out
}

/** Pure: the saved choice → the ids left out. Anything that does not read is nothing left out. */
export function parseAccountsOut(valueText: string | null | undefined): string[] {
  if (!valueText) return []
  try {
    const v: unknown = JSON.parse(valueText)
    if (!Array.isArray(v)) return []
    return [...new Set(v.filter((x): x is string => typeof x === 'string' && x.trim().length > 0))].sort()
  } catch {
    return []
  }
}

/** Pure: the ids left out → the row's text, each once and in order so two saves of one choice match. */
export function accountsOutText(ids: Iterable<string>): string {
  return JSON.stringify([...new Set(ids)].sort())
}

/** Pure: the choice after one account's switch is pressed. */
export function flipAccountOut(out: ReadonlyArray<string>, id: string): string[] {
  return out.includes(id) ? out.filter((x) => x !== id) : [...out, id].sort()
}

export type CashAccountRow = {
  id: string
  /** The name it carries in Mercury ("Accounts Payable 2222"), or Mercury's own when it has none. */
  name: string
  /** "Checking", "Savings"; null when Mercury names no kind. */
  kind: string | null
  /** The balance, which is what cash on hand adds up. */
  usd: number
  /** What is free to spend, when a pending charge makes it differ from the balance by a dollar or more. */
  availableUsd: number | null
  counted: boolean
}

export type CashAccounts = {
  /** Every account, the fullest first; a row keeps its place when its switch is pressed. */
  rows: CashAccountRow[]
  /** Every account added up. */
  wholeUsd: number
  /** Cash on hand: the accounts switched on. */
  countedUsd: number
  leftOutUsd: number
  leftOutCount: number
  /** One sentence for wherever cash on hand shows; null when every account counts. */
  note: string | null
  /** The sentences under the list. */
  lines: string[]
}

const round = (n: number): number => Math.round(n)

export function buildCashAccounts(input: { bank: MercuryCash; names: ReadonlyMap<string, string>; out: ReadonlyArray<string> }): CashAccounts {
  const off = new Set(input.out)
  const rows: CashAccountRow[] = input.bank.accounts
    .map((a: MercuryAccount) => ({
      id: a.id,
      name: input.names.get(a.id) ?? a.name,
      kind: formatMercuryAccountKind(a.kind),
      usd: a.currentBalance,
      availableUsd: Math.abs(a.availableBalance - a.currentBalance) >= 1 ? a.availableBalance : null,
      counted: !off.has(a.id),
    }))
    .sort((a, b) => b.usd - a.usd || a.name.localeCompare(b.name, 'en', { sensitivity: 'base' }))
  const left = rows.filter((r) => !r.counted)
  const leftOutUsd = left.reduce((s, r) => s + r.usd, 0)
  // The bank's own total stands when nothing is left out, so the figure is the one the page has always shown.
  const wholeUsd = input.bank.usd
  const countedUsd = wholeUsd - leftOutUsd
  const first = left[0]
  const note = !first ? null : left.length === 1 ? `Leaves out ${first.name}, ${shortK(round(leftOutUsd))}.` : `Leaves out ${left.length} accounts, ${shortK(round(leftOutUsd))}.`
  const lines = first
    ? [`Cash on hand is ${shortK(round(countedUsd))}. The whole bank holds ${shortK(round(wholeUsd))}.`, 'Bills still come off the forecast on the day they are due.']
    : ['Every account counts toward cash on hand.', 'Switch one off to leave it out of the forecast.']
  return { rows, wholeUsd, countedUsd, leftOutUsd, leftOutCount: left.length, note, lines }
}

/** The bank with the left-out accounts taken off: what the forecast and the page's Monday sheet start from. */
export function countedCash(bank: MercuryCash, out: ReadonlyArray<string>): MercuryCash {
  const off = new Set(out)
  const left = bank.accounts.filter((a) => off.has(a.id))
  if (left.length === 0) return bank
  return { usd: bank.usd - left.reduce((s, a) => s + a.currentBalance, 0), accounts: bank.accounts.filter((a) => !off.has(a.id)), readAtIso: bank.readAtIso }
}

export type BankRead = { cash: MercuryCash; names: Map<string, string>; out: string[] }

/** The bank's accounts with their names, and the saved choice of which count: one call to the bank, one row read. */
export async function loadBankRead(db: SupabaseClient<Database>): Promise<BankRead> {
  const [fn, row] = await Promise.all([
    db.functions.invoke('get-mercury-account-balances', { body: {} }),
    withSupabaseRetry(async () => db.from('app_settings').select('value_text').eq('key', BRIDGE_ACCOUNTS_OUT_SETTING_KEY).maybeSingle(), 'bridge accounts left out') as Promise<{ value_text: string | null } | null>,
  ])
  if (fn.error) throw new Error(fn.error.message)
  return { cash: parseMercuryCash(fn.data, new Date().toISOString()), names: parseBankNicknames(fn.data), out: parseAccountsOut(row?.value_text) }
}

export async function saveAccountsOut(db: SupabaseClient<Database>, ids: ReadonlyArray<string>): Promise<void> {
  await withSupabaseRetry(
    async () => db.from('app_settings').upsert({ key: BRIDGE_ACCOUNTS_OUT_SETTING_KEY, value_text: accountsOutText(ids) }, { onConflict: 'key' }),
    'save bridge accounts left out',
  )
}
