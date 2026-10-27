/**
 * Mercury's accounts, read with the API key: the shape `get-mercury-account-balances` has answered since v2.5218,
 * shared since v2.5883 so the weekly sheet (`bridge-weekly-sheet`) reads the bank the same way without a signed-in
 * caller. Archived accounts are left out; the totals sum what is left.
 */
const MERCURY_BASE = 'https://api.mercury.com/api/v1'

export type MercuryAccountRow = { id: string; name: string; kind: string | null; currentBalance: number; availableBalance: number }
export type MercuryAccountsAnswer =
  | { ok: true; accounts: MercuryAccountRow[]; totalCurrentBalance: number; totalAvailableBalance: number }
  | { ok: false; error: string; detail: string }

export async function fetchMercuryAccounts(mercuryKey: string): Promise<MercuryAccountsAnswer> {
  const mRes = await fetch(`${MERCURY_BASE}/accounts`, {
    headers: { Authorization: `Bearer ${mercuryKey}`, Accept: 'application/json' },
  })
  if (!mRes.ok) {
    const text = await mRes.text().catch(() => '')
    return { ok: false, error: `Mercury accounts fetch failed (${mRes.status})`, detail: text.slice(0, 300) }
  }
  const data = (await mRes.json()) as { accounts?: Array<Record<string, unknown>> }
  const accounts = (data.accounts ?? [])
    .filter((a) => a.status !== 'archived')
    .map((a) => ({
      id: a.id as string,
      name: a.name as string,
      kind: (a.kind as string | undefined) ?? null,
      currentBalance: Number(a.currentBalance ?? 0),
      availableBalance: Number(a.availableBalance ?? 0),
    }))
  const totalCurrentBalance = accounts.reduce((s, a) => s + (Number.isFinite(a.currentBalance) ? a.currentBalance : 0), 0)
  const totalAvailableBalance = accounts.reduce((s, a) => s + (Number.isFinite(a.availableBalance) ? a.availableBalance : 0), 0)
  return { ok: true, accounts, totalCurrentBalance, totalAvailableBalance }
}
