import type { SupabaseClient } from '@supabase/supabase-js'
import { describe, expect, it, vi } from 'vitest'
import { sha256Hex } from './acceptLinkTie'
import { loadWhatWent } from './whatWentIo'

vi.mock('../supabase', () => ({ supabase: {} }))
vi.mock('../sent/sentCopiesIo', () => ({ loadSentCopiesForSource: vi.fn(async () => []) }))

type Result = { data: unknown; error: { message: string; code?: string } | null }

/** A client whose reads record their filters and answer the table's rows. */
function fakeClient(answers: Record<string, Result>) {
  const calls: unknown[][] = []
  const client = {
    from(table: string) {
      calls.push(['from', table])
      const chain: Record<string, unknown> = {}
      for (const m of ['select', 'eq', 'or', 'ilike', 'order', 'limit', 'gte']) {
        chain[m] = (...args: unknown[]) => {
          calls.push([table, m, ...args])
          return chain
        }
      }
      chain.then = (ok: (r: Result) => unknown, no: (e: unknown) => unknown) => Promise.resolve(answers[table] ?? { data: [], error: null }).then(ok, no)
      return chain
    },
  }
  return { client: client as unknown as SupabaseClient, calls }
}

// SHA-256("abc"), the published test vector: the emailed link's token.
const ABC = 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad'

describe('loadWhatWent (v2.6725, punch list #281): the texts on the short link', () => {
  it('reads the estimate’s share links and keeps the text whose /e/ code hashes to one, beside the emailed link’s', async () => {
    const codeHash = (await sha256Hex('fj4nt3ud5n')) as string
    const { client, calls } = fakeClient({
      contacts: { data: [{ id: 'contact-1' }], error: null },
      contact_channels: { data: [{ id: 'ch-1', kind: 'phone', value: '(830) 555-0101', opted_out_at: null }], error: null },
      messages: {
        data: [
          { id: 'm-email', at: '2026-11-08T15:00:00Z', channel_id: 'ch-1', body: 'https://clicktooling.com/estimate/accept?t=abc' },
          { id: 'm-short', at: '2026-11-08T15:00:05Z', channel_id: 'ch-1', body: 'Open it to approve the option you want: https://my.clickplumbing.com/e/fj4nt3ud5n' },
          { id: 'm-other', at: '2026-11-08T15:01:00Z', channel_id: 'ch-1', body: 'https://my.clickplumbing.com/e/pmsk4zrr5u' },
        ],
        error: null,
      },
      estimate_share_links: { data: [{ token_hash: codeHash }], error: null },
    })
    const read = await loadWhatWent('cust-1', '2026-11-08T14:59:00Z', ABC, client, 'est-1')
    expect(read.texts.map((t) => t.id)).toEqual(['m-email', 'm-short'])
    expect(read.texts[1]).toEqual({ id: 'm-short', atMs: Date.parse('2026-11-08T15:00:05Z'), to: '(830) 555-0101' })
    expect(calls).toContainEqual(['estimate_share_links', 'eq', 'estimate_id', 'est-1'])
    // The body filter admits both shapes, so a text carrying only the short link is read at all.
    expect(calls).toContainEqual(['messages', 'or', 'body.ilike.%/estimate/accept%,body.ilike.%/e/%'])
    expect(calls.filter((c) => c[1] === 'ilike')).toEqual([])
  })

  it('with no estimate id reads no share links and keeps the emailed link’s texts as before', async () => {
    const { client, calls } = fakeClient({
      contacts: { data: [{ id: 'contact-1' }], error: null },
      contact_channels: { data: [], error: null },
      messages: { data: [{ id: 'm-short', at: '2026-11-08T15:00:05Z', channel_id: null, body: 'https://my.clickplumbing.com/e/fj4nt3ud5n' }, { id: 'm-email', at: '2026-11-08T15:00:00Z', channel_id: null, body: 'https://clicktooling.com/estimate/accept?t=abc' }], error: null },
    })
    const read = await loadWhatWent('cust-1', null, ABC, client, null)
    expect(read.texts.map((t) => t.id)).toEqual(['m-email'])
    expect(calls.filter((c) => c[0] === 'from').map((c) => c[1])).not.toContain('estimate_share_links')
  })

  it('a refused share-link read names its reason instead of drawing No text went', async () => {
    const { client } = fakeClient({
      contacts: { data: [{ id: 'contact-1' }], error: null },
      contact_channels: { data: [], error: null },
      messages: { data: [], error: null },
      estimate_share_links: { data: null, error: { message: 'permission denied for table estimate_share_links', code: '42501' } },
    })
    await expect(loadWhatWent('cust-1', null, ABC, client, 'est-1')).rejects.toThrow(/texted links|permission/i)
  })
})
