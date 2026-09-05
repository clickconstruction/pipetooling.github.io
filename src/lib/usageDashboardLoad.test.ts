import { describe, expect, it } from 'vitest'
import { loadUsageRows, type UsageRpc } from './usageDashboardLoad'
import { withSupabaseRetry } from '../utils/errorHandling'

const rows = [
  { surface: 'portal', bucket: '2026-08-24', views: 8, entities: 4 },
  { surface: 'portal', bucket: '2026-08-31', views: 12, entities: 2 },
]

describe('loadUsageRows (J21-N1 — the Usage tab double unwrap)', () => {
  it('returns the RPC rows when the envelope carries them', async () => {
    const calls: Array<{ fn: string; args: { p_days: number } }> = []
    const rpc: UsageRpc = async (fn, args) => {
      calls.push({ fn, args })
      return { data: rows, error: null }
    }
    await expect(loadUsageRows(rpc, 'usage_customer_views', 30)).resolves.toEqual(rows)
    expect(calls).toEqual([{ fn: 'usage_customer_views', args: { p_days: 30 } }])
  })

  it('regression: pre-unwrapping the rows inside the callback blanks them — the loader must not', async () => {
    // What SettingsUsageTab used to do: unwrap `.data` in the callback, return the array.
    const preUnwrapped = await withSupabaseRetry(
      async () => rows as unknown as { data: unknown; error: null },
      'usage_customer_views',
    )
    expect(preUnwrapped).toBeUndefined() // `.data` of an array
    // The loader hands the wrapper the envelope, so the same rows come back intact.
    const rpc: UsageRpc = async () => ({ data: rows, error: null })
    await expect(loadUsageRows(rpc, 'usage_customer_views', 30)).resolves.toHaveLength(2)
  })

  it('an empty series is [] (the panel says "Nothing recorded"), a failed reader is null', async () => {
    await expect(loadUsageRows(async () => ({ data: [], error: null }), 'usage_nav_clicks', 7)).resolves.toEqual([])
    await expect(loadUsageRows(async () => ({ data: null, error: null }), 'usage_nav_clicks', 7)).resolves.toEqual([])
    await expect(
      loadUsageRows(
        async () => ({ data: null, error: { message: 'usage_nav_clicks: dev only', code: 'P0001' } }),
        'usage_nav_clicks',
        7,
        { maxRetries: 0 },
      ),
    ).resolves.toBeNull()
  })
})
