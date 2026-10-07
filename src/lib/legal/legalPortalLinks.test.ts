/** v2.4750: the Firm's links dialog's reading of `list_legal_portal_links`, and the address shapes. */
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { groupLegalPortalLinks, legalLinkAddress, legalLinkIsOldShape, legalLinkName, legalLinkPastLine, legalLinkSinceLine, legalLinksSummary, parseLegalPortalLinks, type LegalPortalLinkRow } from './legalPortalLinks'
import { isLegalPortalSlugKey, legalPortalAddress, legalPortalAddressWords } from './legalPortalAddress'
import { rotateLinkMessage, turnOffLinkMessage } from './legalPortalLinkWords'

const ymd = (iso: string) => iso.slice(0, 10)
const row = (over: Partial<LegalPortalLinkRow>): LegalPortalLinkRow => ({ id: 'l1', purpose: 'firm', label: null, createdAt: '2026-10-06T15:00:00Z', createdBy: 'Robert', revokedAt: null, revokedBy: null, revokeReason: null, token: 'snell-law-firm-pllc-k4tp9x2mq7zr', ...over })

describe('legalPortalAddress', () => {
  it('a slug key reads on the short domain, like a GC’s; an old hex key keeps the direct form', () => {
    expect(legalPortalAddress('https://clicktooling.com', 'snell-law-firm-pllc-k4tp9x2mq7zr')).toBe('https://my.clickplumbing.com/snell-law-firm-pllc-k4tp9x2mq7zr')
    expect(legalPortalAddressWords('https://clicktooling.com', 'snell-law-firm-pllc-k4tp9x2mq7zr')).toBe('my.clickplumbing.com/snell-law-firm-pllc-k4tp9x2mq7zr')
    const hex = 'a'.repeat(64)
    expect(legalPortalAddress('https://clicktooling.com/', hex)).toBe(`https://clicktooling.com/legal?t=${hex}`)
    expect(isLegalPortalSlugKey(hex)).toBe(false)
    expect(isLegalPortalSlugKey('Snell-Law')).toBe(false)
  })
})

describe('parseLegalPortalLinks + groupLegalPortalLinks', () => {
  it('reads the RPC’s answer and sorts the firm’s own, the people and the past', () => {
    const rows = parseLegalPortalLinks({ links: [
      { id: 'p2', purpose: 'person', label: 'Jane Doe, paralegal', createdAt: '2026-10-06T16:00:00Z', createdBy: 'Will', revokedAt: null, token: 'snell-law-firm-pllc-aaaaaaaaaaaa' },
      { id: 'f1', purpose: 'firm', label: null, createdAt: '2026-10-06T15:00:00Z', createdBy: 'Robert', revokedAt: null, token: 'snell-law-firm-pllc-k4tp9x2mq7zr' },
      { id: 'f0', purpose: 'firm', label: null, createdAt: '2026-09-11T15:00:00Z', createdBy: 'Robert', revokedAt: '2026-10-06T15:00:00Z', revokedBy: 'Robert', revokeReason: 'rotated', token: null },
      { id: 'p1', purpose: 'person', label: 'Al', createdAt: '2026-10-01T15:00:00Z', createdBy: null, revokedAt: '2026-10-05T15:00:00Z', revokedBy: 'Will', revokeReason: 'off', token: null },
      { id: 'bad' },
    ] })!
    expect(rows).toHaveLength(4)
    const view = groupLegalPortalLinks(rows)
    expect(view.firm?.id).toBe('f1')
    expect(view.people.map((r) => r.id)).toEqual(['p2'])
    expect(view.past.map((r) => r.id)).toEqual(['f0', 'p1'])
    expect(legalLinksSummary(view)).toBe('2 live links: the firm’s own and 1 for one person at the firm.')
  })

  it('is null on an error or before the RPC is live, and tells no link from none live', () => {
    expect(parseLegalPortalLinks({ error: 'Not authorized' })).toBeNull()
    expect(parseLegalPortalLinks(null)).toBeNull()
    expect(legalLinksSummary(groupLegalPortalLinks([]))).toBe('No link yet.')
    expect(legalLinksSummary(groupLegalPortalLinks([row({ revokedAt: '2026-10-06T16:00:00Z', revokeReason: 'off', token: null })]))).toBe('No link is live.')
  })
})

describe('the lines', () => {
  it('names, addresses and dates each link', () => {
    expect(legalLinkName(row({}), 'Snell Law Firm')).toBe('Snell Law Firm’s own link')
    expect(legalLinkName(row({ purpose: 'person', label: ' Jane ' }), 'Snell')).toBe('Jane')
    expect(legalLinkName(row({ purpose: 'person', label: null }), 'Snell')).toBe('A person at the firm')
    expect(legalLinkAddress(row({}), 'https://clicktooling.com')).toBe('https://my.clickplumbing.com/snell-law-firm-pllc-k4tp9x2mq7zr')
    expect(legalLinkAddress(row({ token: null }), 'https://clicktooling.com')).toBeNull()
    expect(legalLinkIsOldShape(row({ token: 'f'.repeat(64) }))).toBe(true)
    expect(legalLinkIsOldShape(row({}))).toBe(false)
    expect(legalLinkSinceLine(row({}), ymd)).toBe('since 2026-10-06 by Robert')
    expect(legalLinkSinceLine(row({ createdBy: null }), ymd)).toBe('since 2026-10-06')
    expect(legalLinkPastLine(row({ createdAt: '2026-09-11T15:00:00Z', revokedAt: '2026-10-06T15:00:00Z', revokedBy: 'Robert', revokeReason: 'rotated' }), ymd)).toBe('2026-09-11 to 2026-10-06 · rotated by Robert')
    expect(legalLinkPastLine(row({ revokedAt: '2026-10-06T15:00:00Z', revokedBy: 'Will', revokeReason: 'off' }), ymd)).toBe('2026-10-06 to 2026-10-06 · turned off by Will')
    expect(legalLinkPastLine(row({ revokedAt: '2026-10-06T15:00:00Z', revokeReason: 'replaced' }), ymd)).toBe('2026-10-06 to 2026-10-06 · the firm was replaced')
    expect(legalLinkPastLine(row({ revokedAt: '2026-10-06T15:00:00Z', revokeReason: null }), ymd)).toBe('2026-10-06 to 2026-10-06 · turned off')
  })

  it('the confirms say what dies: the firm’s own link is in every email, a person’s is theirs alone', () => {
    expect(rotateLinkMessage('Snell')).toMatch(/every email already sent to the firm/)
    expect(rotateLinkMessage('Jane', false)).not.toMatch(/every email/)
    expect(rotateLinkMessage('Jane', false)).toMatch(/Send the new link to Jane/)
    expect(turnOffLinkMessage('Snell')).toMatch(/until you create a new one/)
    expect(turnOffLinkMessage('Jane', false)).toMatch(/other links keep working/)
  })
})

describe('the migration', () => {
  const sql = readFileSync('supabase/migrations/20261007070000_legal_portal_links_named.sql', 'utf8')
  it('starts with the lock timeout and keeps the key out of the table', () => {
    expect(sql.startsWith("SET lock_timeout = '3s';")).toBe(true)
    expect(sql).toMatch(/GRANT SELECT \(id, firm_id, token_hash, token_secret_id, created_by, created_at, revoked_at, purpose, label, revoked_by, revoke_reason\) ON public\.legal_portal_links TO authenticated;/)
    expect(sql).toContain("VALUES (v_id, p_firm_id, NULL, encode(digest(v_raw, 'sha256'), 'hex'), v_sid, auth.uid(), v_now, p_purpose, p_label);")
  })
  it('one live firm link per firm; the emails read the firm’s own; the office reads addresses only through the list', () => {
    expect(sql).toContain("CREATE UNIQUE INDEX IF NOT EXISTS idx_legal_portal_links_active_firm ON public.legal_portal_links (firm_id) WHERE revoked_at IS NULL AND purpose = 'firm';")
    expect(sql).toMatch(/WHERE l\.firm_id = p_firm_id AND l\.revoked_at IS NULL AND l\.purpose = 'firm'/)
    expect(sql).toMatch(/GRANT EXECUTE ON FUNCTION public\.list_legal_portal_links\(uuid\) TO authenticated;/)
    expect(sql).toMatch(/REVOKE EXECUTE ON FUNCTION public\.legal_portal_link_token_by_id\(uuid\) FROM PUBLIC, anon, authenticated;/)
    expect(sql).toMatch(/REVOKE EXECUTE ON FUNCTION public\.legal_portal_link_new_key\(text\) FROM PUBLIC, anon, authenticated;/)
  })
  it('the key is the firm’s name and a twelve-character tail', () => {
    expect(sql).toContain('extensions.gen_random_bytes(12)')
    expect(sql).toContain("RETURN v_base || '-' || v_tail;")
  })
})
