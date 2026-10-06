/** Punch list #85, item 22: the Firm's link dialog once the token is hash-only at rest, and before. */
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { COPY_ONLY_AT_MINT, firmPortalUrls, portalLinkView } from './legalPortalLinkState'

const live = { created_at: '2026-10-05T20:00:00Z', revoked_at: null }
const dead = { created_at: '2026-09-01T20:00:00Z', revoked_at: '2026-10-05T19:59:00Z' }

describe('portalLinkView', () => {
  it('shows the token the table still answers with (before the migration)', () => {
    expect(portalLinkView([{ ...live, token: 'rawtok' }, dead], null)).toEqual({ kind: 'active', since: live.created_at, token: 'rawtok', id: null })
  })

  it('after the migration, knows the address only in the session that minted it', () => {
    expect(portalLinkView([live, dead], null)).toEqual({ kind: 'active', since: live.created_at, token: null, id: null })
    expect(portalLinkView([live, dead], { token: 'fresh', since: '2026-10-05T20:00:01Z' })).toEqual({ kind: 'active', since: live.created_at, token: 'fresh', id: null })
  })

  it('never pins a minted token on an older live link', () => {
    expect(portalLinkView([{ created_at: '2026-09-01T00:00:00Z', revoked_at: null }], { token: 'fresh', since: '2026-10-05T20:00:00Z' })).toMatchObject({ token: null })
  })

  it('reads off and none', () => {
    expect(portalLinkView([dead], null)).toEqual({ kind: 'off' })
    expect(portalLinkView([], null)).toEqual({ kind: 'none' })
  })
})

describe('firmPortalUrls', () => {
  it('copies and previews by the key while it is known', () => {
    expect(firmPortalUrls('https://app.example', 'firm-1', 'tok')).toEqual({ copyUrl: 'https://app.example/legal?t=tok', previewUrl: 'https://app.example/legal?t=tok&preview=1' })
  })

  it('previews by the firm’s id, signed in, when the key is not known', () => {
    expect(firmPortalUrls('https://app.example', 'firm-1', null)).toEqual({ copyUrl: null, previewUrl: 'https://app.example/legal?firm=firm-1&preview=1' })
    expect(COPY_ONLY_AT_MINT).toMatch(/only when it is created or rotated/)
  })
})

describe('the migration', () => {
  const sql = readFileSync('supabase/migrations/20261006072618_legal_portal_links_hash_only.sql', 'utf8')
  it('starts with the lock timeout, empties the raw column and holds it empty', () => {
    expect(sql.startsWith("SET lock_timeout = '3s';")).toBe(true)
    expect(sql).toContain('UPDATE public.legal_portal_links SET token = NULL WHERE token IS NOT NULL;')
    expect(sql).toContain('CHECK (token IS NULL)')
  })
  it('leaves the token out of the office’s grant and gives the emails’ read to the service role only', () => {
    expect(sql).toMatch(/GRANT SELECT \(id, firm_id, token_hash, token_secret_id, created_by, created_at, revoked_at\) ON public\.legal_portal_links TO authenticated;/)
    expect(sql).toMatch(/REVOKE EXECUTE ON FUNCTION public\.legal_portal_link_token\(uuid\) FROM PUBLIC, anon, authenticated;/)
    expect(sql).toMatch(/GRANT EXECUTE ON FUNCTION public\.legal_portal_link_token\(uuid\) TO service_role;/)
  })
  it('never hands an existing raw token back from mint', () => {
    expect(sql).toContain("RETURN jsonb_build_object('token', NULL, 'exists', true, 'activeSince', v_row.created_at);")
  })
})
