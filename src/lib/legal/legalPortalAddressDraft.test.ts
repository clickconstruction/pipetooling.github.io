/** v2.4756: the office's address editor for a firm's link, and the migration that takes the address. */
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { cleanBase, composeLegalAddress, legalAddressBase, legalAddressProblem, rollLegalTail, splitLegalAddress } from './legalPortalAddressDraft'
import { isLegalPortalSlugKey, legalPortalAddress } from './legalPortalAddress'

describe('the address editor', () => {
  it('starts from the first two words of the firm’s name', () => {
    expect(legalAddressBase('Snell Law Firm, PLLC')).toBe('snell-law')
    expect(legalAddressBase('Jones')).toBe('jones')
    expect(legalAddressBase('???')).toBe('firm')
  })

  it('cleans what the office types and rolls a three-character tail that reads aloud', () => {
    expect(cleanBase(' Snell  Law ')).toBe('snell-law')
    expect(cleanBase('--snell_law!--')).toBe('snell-law')
    const tail = rollLegalTail(() => 0.5)
    expect(tail).toHaveLength(3)
    expect(tail).toMatch(/^[abcdefghijkmnpqrstuvwxyz23456789]{3}$/)
    expect(composeLegalAddress('Snell Law', 'f6a')).toBe('snell-law-f6a')
    expect(splitLegalAddress('snell-law-f6a')).toEqual({ base: 'snell-law', tail: 'f6a' })
    expect(splitLegalAddress('a'.repeat(64))).toEqual({ base: 'a'.repeat(64), tail: '' })
  })

  it('says why an address cannot be saved, the way the server does', () => {
    expect(legalAddressProblem('snell-law-f6a')).toBeNull()
    expect(legalAddressProblem('s-f6a')).toBeNull()
    expect(legalAddressProblem('f6a')).toMatch(/5 to 40/)
    expect(legalAddressProblem('snell-law-f6')).toMatch(/dash and three/)
    expect(legalAddressProblem('Snell-law-f6a')).toMatch(/5 to 40/)
    expect(legalAddressProblem(`${'a'.repeat(40)}-f6a`)).toMatch(/5 to 40/)
  })

  it('a short address is still a slug key the short domain carries', () => {
    expect(isLegalPortalSlugKey('snell-law-f6a')).toBe(true)
    expect(legalPortalAddress('https://clicktooling.com', 'snell-law-f6a')).toBe('https://my.clickplumbing.com/snell-law-f6a')
  })
})

describe('the migration', () => {
  const sql = readFileSync('supabase/migrations/20261007080000_legal_portal_custom_address.sql', 'utf8')
  it('starts with the lock timeout and closes the new table with the three block calls', () => {
    expect(sql.startsWith("SET lock_timeout = '3s';")).toBe(true)
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS public.legal_portal_misses')
    expect(sql).toContain('SELECT public.apply_read_only_write_blocks();')
    expect(sql).toContain('SELECT public.apply_read_only_stmt_blocks();')
    expect(sql).toContain('SELECT public.apply_digital_twin_write_blocks();')
  })
  it('the gate is the service role’s, locks at ten misses an hour, never an unknown caller', () => {
    expect(sql).toMatch(/GRANT EXECUTE ON FUNCTION public\.legal_portal_guess_gate\(text, boolean\) TO service_role;/)
    expect(sql).toMatch(/REVOKE EXECUTE ON FUNCTION public\.legal_portal_guess_gate\(text, boolean\) FROM PUBLIC, anon, authenticated;/)
    expect(sql).toContain("RETURN jsonb_build_object('locked', v_ip <> 'unknown' AND v_n >= 10, 'misses', v_n);")
  })
  it('the address shape is checked on the server, and a customer’s or a sub’s slug is refused', () => {
    expect(sql).toContain("p_address !~ '^[a-z0-9][a-z0-9-]{3,38}[a-z0-9]$'")
    expect(sql).toContain("p_address !~ '-[a-z0-9]{3}$'")
    expect(sql).toContain('FROM public.customer_portal_slugs WHERE slug = p_address')
    expect(sql).toContain('FROM public.sub_portal_slugs WHERE slug = p_address')
    expect(sql).toContain('GRANT EXECUTE ON FUNCTION public.create_legal_portal_link(uuid, text, text) TO authenticated;')
    expect(sql).toContain('GRANT EXECUTE ON FUNCTION public.rotate_legal_portal_link(uuid, text) TO authenticated;')
  })
})
