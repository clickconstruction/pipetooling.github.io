import { describe, expect, it } from 'vitest'
import { estimateRefForTokenHash, linkExpiresAt, linkHasExpired, type EstimateLookupClient } from '../../supabase/functions/_shared/estimateTokenLookup'

type Rows = Record<string, Array<Record<string, unknown>>>

/** A client with only what the lookup reads: `from(table).select(…).eq(column, value).maybeSingle()`. */
function fake(rows: Rows, fail: ReadonlySet<string> = new Set()): EstimateLookupClient & { asked: string[] } {
  const asked: string[] = []
  return {
    asked,
    from(table: string) {
      return {
        select() {
          return {
            eq(column: string, value: string) {
              asked.push(`${table}.${column}`)
              const row = (rows[table] ?? []).find((r) => r[column] === value) ?? null
              return { maybeSingle: () => Promise.resolve(fail.has(table) ? { data: null, error: { message: 'relation does not exist' } } : { data: row, error: null }) }
            },
          }
        },
      }
    },
  }
}

const ROWS: Rows = {
  estimates: [{ id: 'est-1', public_token_hash: 'h-email' }],
  estimate_share_links: [{ estimate_id: 'est-1', token_hash: 'h-text', expires_at: '2026-11-02T12:00:00Z' }],
}

describe('the estimate a link opens (#127, the owner’s pick B)', () => {
  it('opens the emailed link from the row, and asks no further', async () => {
    const db = fake(ROWS)
    expect(await estimateRefForTokenHash(db, 'h-email')).toEqual({ estimateId: 'est-1', shareExpiresAt: null })
    expect(db.asked).toEqual(['estimates.public_token_hash'])
  })

  it('opens a link shared in a message, with the share’s own day', async () => {
    const db = fake(ROWS)
    expect(await estimateRefForTokenHash(db, 'h-text')).toEqual({ estimateId: 'est-1', shareExpiresAt: '2026-11-02T12:00:00Z' })
    expect(db.asked).toEqual(['estimates.public_token_hash', 'estimate_share_links.token_hash'])
  })

  it('opens nothing for a hash neither keeps, or a shares table not there yet', async () => {
    expect(await estimateRefForTokenHash(fake(ROWS), 'h-none')).toBeNull()
    expect(await estimateRefForTokenHash(fake(ROWS, new Set(['estimate_share_links'])), 'h-text')).toBeNull()
    expect(await estimateRefForTokenHash(fake(ROWS, new Set(['estimate_share_links'])), 'h-email')).toEqual({ estimateId: 'est-1', shareExpiresAt: null })
  })

  it('ends a shared link on its own day and an emailed one on the row’s', () => {
    const shared = { estimateId: 'est-1', shareExpiresAt: '2026-11-02T12:00:00Z' }
    const emailed = { estimateId: 'est-1', shareExpiresAt: null }
    expect(linkExpiresAt(shared, '2026-10-01T12:00:00Z')).toBe('2026-11-02T12:00:00Z')
    expect(linkExpiresAt(emailed, '2026-10-01T12:00:00Z')).toBe('2026-10-01T12:00:00Z')
    const oct20 = Date.parse('2026-10-20T12:00:00Z')
    expect(linkHasExpired(shared, '2026-10-01T12:00:00Z', oct20)).toBe(false)
    expect(linkHasExpired(emailed, '2026-10-01T12:00:00Z', oct20)).toBe(true)
    expect(linkHasExpired(emailed, null, oct20)).toBe(false)
    expect(linkHasExpired(emailed, 'not a day', oct20)).toBe(false)
  })
})
