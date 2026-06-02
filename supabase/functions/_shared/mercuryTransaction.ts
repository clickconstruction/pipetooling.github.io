// Shared Mercury transaction helpers used by both `sync-mercury-transactions`
// (bulk list backfill) and `mercury-webhook` (single-transaction push).
// Keep mapping in ONE place so the two ingest paths cannot drift.

export const MERCURY_BASE = 'https://api.mercury.com/api/v1'

/** Map a Mercury API transaction object to a `mercury_transactions` row. */
export function mapMercuryTransactionToRow(t: Record<string, unknown>, syncedAt: string) {
  return {
    mercury_id: t.id as string,
    mercury_account_id: t.accountId as string,
    amount: t.amount as number,
    currency: 'USD',
    created_at: t.createdAt as string,
    posted_at: (t.postedAt as string | null | undefined) ?? null,
    status: t.status as string,
    kind: t.kind as string,
    counterparty_id: (t.counterpartyId as string | null | undefined) ?? null,
    counterparty_name: t.counterpartyName as string,
    note: (t.note as string | null | undefined) ?? null,
    external_memo: (t.externalMemo as string | null | undefined) ?? null,
    dashboard_link: (t.dashboardLink as string | null | undefined) ?? null,
    mercury_category: t.mercuryCategory ?? null,
    raw: t,
    synced_at: syncedAt,
  }
}

/**
 * Fetch a single full transaction from Mercury by id (the webhook payload is a
 * merge-patch pointer, so we re-fetch the authoritative object). Throws on non-2xx.
 */
export async function fetchMercuryTransactionById(
  id: string,
  mercuryKey: string,
): Promise<Record<string, unknown>> {
  const res = await fetch(`${MERCURY_BASE}/transaction/${encodeURIComponent(id)}`, {
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${mercuryKey}`,
    },
  })
  if (!res.ok) {
    const errText = await res.text()
    throw new Error(`Mercury GET transaction ${res.status}: ${errText.slice(0, 300)}`)
  }
  return (await res.json()) as Record<string, unknown>
}
