import { describe, expect, it } from 'vitest'
import { countToolingViewToken, grantPlansLink, mintViewGrant, parseViewGrantClaims, withViewGrant } from '../../supabase/functions/_shared/viewGrant'

/**
 * The mint side of CountTooling viewer grants. The SAME fixtures live in
 * CountTooling's `view-grant.test.js` (its verify side) — SECRET, TOKEN, NOW
 * and the expected claims — so the two kernels are held to one wire format.
 */
const SECRET = 'test-secret-do-not-ship'
const TOKEN = '8f3c2a4e-1b9d-4c77-a0e2-6d5b1f0a9e21'
const NOW = 1757200000

async function hmacB64url(secret: string, message: string): Promise<string> {
  const enc = new TextEncoder()
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const sig = new Uint8Array(await crypto.subtle.sign('HMAC', key, enc.encode(message)))
  let bin = ''
  for (const b of sig) bin += String.fromCharCode(b)
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

describe('viewGrant (mint side)', () => {
  it('mints the wire format CountTooling verifies: claims part, dot, HMAC-SHA256 over the claims part', async () => {
    const g = await mintViewGrant({ t: TOKEN, name: ' Behar Kraja ', email: 'Behar@Example.com', person: 'p-1' }, SECRET, NOW)
    expect(g).toMatch(/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/)
    const [part, sig] = g.split('.')
    expect(parseViewGrantClaims(g)).toEqual({ t: TOKEN, name: 'Behar Kraja', email: 'behar@example.com', person: 'p-1', via: 'pipetooling-sub-portal', iat: NOW, exp: NOW + 86400 })
    expect(sig).toBe(await hmacB64url(SECRET, part!))
    // Deterministic for a given clock, so both repos' fixtures agree byte for byte.
    expect(await mintViewGrant({ t: TOKEN, name: 'Behar Kraja', email: 'behar@example.com', person: 'p-1' }, SECRET, NOW)).toBe(g)
  })

  it('refuses to sign without a secret, a token, or a name', async () => {
    await expect(mintViewGrant({ t: TOKEN, name: 'X' }, '', NOW)).rejects.toThrow(/secret/)
    await expect(mintViewGrant({ t: '', name: 'X' }, SECRET, NOW)).rejects.toThrow(/view token/)
    await expect(mintViewGrant({ t: TOKEN, name: '  ' }, SECRET, NOW)).rejects.toThrow(/viewer name/)
  })

  it('recognizes CountTooling view links and nothing else', () => {
    expect(countToolingViewToken(`https://counttooling.com/app/?t=${TOKEN}`)).toBe(TOKEN)
    expect(countToolingViewToken(`https://counttooling.com/?t=${TOKEN}`)).toBe(TOKEN)
    expect(countToolingViewToken(`https://www.counttooling.com/app/?t=${TOKEN}&x=1`)).toBe(TOKEN)
    expect(countToolingViewToken('https://counttooling.com/app/')).toBeNull()
    expect(countToolingViewToken('https://drive.google.com/drive/folders/abc?t=nope')).toBeNull()
    expect(countToolingViewToken('https://evil.example/counttooling.com/?t=x')).toBeNull()
    expect(countToolingViewToken('not a url')).toBeNull()
    expect(countToolingViewToken(null)).toBeNull()
  })

  it('appends the grant, replacing a stale one, and leaves other links alone', async () => {
    const base = `https://counttooling.com/app/?t=${TOKEN}`
    const granted = await grantPlansLink(base, { name: 'Behar Kraja', email: 'behar@example.com', person: 'p-1' }, SECRET, NOW)
    expect(granted).toBe(`${base}&g=${await mintViewGrant({ t: TOKEN, name: 'Behar Kraja', email: 'behar@example.com', person: 'p-1' }, SECRET, NOW)}`)
    expect(withViewGrant(`${base}&g=old.grant#p2`, 'new.grant')).toBe(`${base}&g=new.grant#p2`)
    // Not a CountTooling link, no secret, or no name → unchanged.
    expect(await grantPlansLink('https://drive.google.com/x', { name: 'Behar Kraja' }, SECRET, NOW)).toBe('https://drive.google.com/x')
    expect(await grantPlansLink(base, { name: 'Behar Kraja' }, '', NOW)).toBe(base)
    expect(await grantPlansLink(base, { name: '  ' }, SECRET, NOW)).toBe(base)
    expect(await grantPlansLink(null, { name: 'Behar Kraja' }, SECRET, NOW)).toBeNull()
  })
})

describe('viewGrant — the bid-basis source (v2.3226)', () => {
  it('mints with via pipetooling-bid-basis and no person', async () => {
    const g = await mintViewGrant({ t: TOKEN, name: 'Grace', email: 'grace@example.com', person: null, via: 'pipetooling-bid-basis' }, SECRET, NOW)
    const claims = parseViewGrantClaims(g)!
    expect(claims.via).toBe('pipetooling-bid-basis')
    expect(claims.person).toBeNull()
    expect(claims.t).toBe(TOKEN)
    expect(claims.exp).toBe(NOW + 24 * 60 * 60)
  })
})
