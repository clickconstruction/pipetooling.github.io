/** How a trade portal link becomes its company (P2b-i): the read and the writes share this one rule. */
import { describe, expect, it } from 'vitest'
import { resolveTradeLink, sha256Hex, type TradeLinkRow } from '../../../supabase/functions/_shared/gcTradeLink'

const TOKEN = '0123456789abcdef0123456789abcdef'

function table(rows: { token: string | null; token_hash: string | null; row: TradeLinkRow }[]) {
  const asked: string[] = []
  const find = async (column: 'token' | 'token_hash', value: string) => {
    asked.push(column)
    return rows.find((r) => r[column] === value)?.row ?? null
  }
  return { find, asked }
}

describe('resolveTradeLink', () => {
  it('finds the raw token first, and never asks for the hash when it did', async () => {
    const t = table([{ token: TOKEN, token_hash: null, row: { company_id: 'c1', revoked_at: null } }])
    expect(await resolveTradeLink(TOKEN, t.find)).toEqual({ company_id: 'c1', revoked_at: null })
    expect(t.asked).toEqual(['token'])
  })

  it('finds a link kept only as its SHA-256 hash', async () => {
    const t = table([{ token: null, token_hash: await sha256Hex(TOKEN), row: { company_id: 'c2', revoked_at: null } }])
    expect(await resolveTradeLink(TOKEN, t.find)).toEqual({ company_id: 'c2', revoked_at: null })
    expect(t.asked).toEqual(['token', 'token_hash'])
  })

  it('reads a link turned off, and a token nobody has, as no link', async () => {
    const off = table([{ token: TOKEN, token_hash: null, row: { company_id: 'c1', revoked_at: '2026-10-08T10:00:00Z' } }])
    expect(await resolveTradeLink(TOKEN, off.find)).toBeNull()
    expect(await resolveTradeLink('fedcba9876543210fedcba9876543210', table([]).find)).toBeNull()
  })

  it('hashes the way the link table keeps it', async () => {
    expect(await sha256Hex('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad')
  })
})
