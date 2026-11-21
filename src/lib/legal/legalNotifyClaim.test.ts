import { readdirSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import {
  LEGAL_NOTIFY_CLAIM_LIMIT,
  LEGAL_NOTIFY_LEASE_SECONDS,
  legalClaimAnswer,
  legalClaimFree,
  legalClaimLease,
  legalClaimLeftovers,
  legalClaimedInOrder,
  legalDigestReleasePatch,
  legalDigestSentPatch,
  legalEventLedgerPatch,
  legalEventStampPatch,
} from '../../../supabase/functions/_shared/legalNotifyClaim'

const NOW = '2026-11-21T18:00:00.000Z'

describe('the claim on the firm’s emails (v2.8228, punch list #85)', () => {
  it('a row is free when it was never claimed or its lease is past', () => {
    expect(legalClaimFree(null, NOW)).toBe(true)
    expect(legalClaimFree(undefined, NOW)).toBe(true)
    expect(legalClaimFree('2026-11-21T17:59:59.000Z', NOW)).toBe(true)
    expect(legalClaimFree(NOW, NOW)).toBe(true)
    expect(legalClaimFree('2026-11-21T18:00:01.000Z', NOW)).toBe(false)
    // As PostgREST prints a timestamptz.
    expect(legalClaimFree('2026-11-21T18:09:59.123456+00:00', NOW)).toBe(false)
    // A value that is no time holds nothing.
    expect(legalClaimFree('soon', NOW)).toBe(true)
  })

  it('a lease is ten minutes, longer than a run can live, and a run claims the fifty a tick has always read', () => {
    expect(LEGAL_NOTIFY_LEASE_SECONDS).toBe(600)
    // The platform ends a function within 400 seconds.
    expect(LEGAL_NOTIFY_LEASE_SECONDS).toBeGreaterThan(400)
    expect(LEGAL_NOTIFY_CLAIM_LIMIT).toBe(50)
    expect(legalClaimLease(NOW)).toBe('2026-11-21T18:10:00.000Z')
    expect(legalClaimFree(legalClaimLease(NOW), NOW)).toBe(false)
    expect(legalClaimFree(legalClaimLease(NOW), '2026-11-21T18:10:00.000Z')).toBe(true)
  })

  it('reads how the claim call ended: claimed, missing before the push, or failed', () => {
    expect(legalClaimAnswer(null)).toBe('claimed')
    expect(legalClaimAnswer(undefined)).toBe('claimed')
    expect(legalClaimAnswer({ code: 'PGRST202', message: 'Could not find the function public.legal_notify_claim_events in the schema cache' })).toBe('missing')
    expect(legalClaimAnswer({ code: '42883', message: 'function public.legal_notify_claim_digest(uuid, timestamp with time zone, integer) does not exist' })).toBe('missing')
    // Anything else is not a reason to send unclaimed.
    expect(legalClaimAnswer({ code: '57014', message: 'canceling statement due to statement timeout' })).toBe('failed')
    expect(legalClaimAnswer({ message: 'fetch failed' })).toBe('failed')
    expect(legalClaimAnswer({ code: null, message: null })).toBe('failed')
  })

  it('an event’s ledger write lets the claim go with it, so a failed send is tried by the next tick', () => {
    const sentTo = { ann: { at: NOW, tries: 1 }, bo: { tries: 1, error: 'The to address is invalid', last: NOW } }
    expect(legalEventLedgerPatch(sentTo, true)).toEqual({ sent_to: sentTo, claimed_until: null })
    expect(legalEventStampPatch(NOW, true)).toEqual({ sent_now_at: NOW, claimed_until: null })
  })

  it('a row read without a claim is written without the claim’s column, which may not exist yet', () => {
    expect(legalEventLedgerPatch({}, false)).toEqual({ sent_to: {} })
    expect(legalEventStampPatch(NOW, false)).toEqual({ sent_now_at: NOW })
    expect(legalDigestSentPatch(NOW, NOW, false)).toEqual({ last_digest_at: NOW, updated_at: NOW })
    expect(legalDigestReleasePatch(false)).toBeNull()
  })

  it('a digest that went is stamped and let go in one write; one that did not is only let go', () => {
    expect(legalDigestSentPatch('2026-11-21T17:59:58.000Z', NOW, true)).toEqual({ last_digest_at: '2026-11-21T17:59:58.000Z', updated_at: NOW, digest_claimed_until: null })
    expect(legalDigestReleasePatch(true)).toEqual({ digest_claimed_until: null })
  })

  it('a run that stops early names what it still holds', () => {
    expect(legalClaimLeftovers(['e1', 'e2', 'e3'], ['e1'])).toEqual(['e2', 'e3'])
    expect(legalClaimLeftovers(['e1', 'e1'], [])).toEqual(['e1'])
    expect(legalClaimLeftovers(['e1'], ['e1'])).toEqual([])
    expect(legalClaimLeftovers([], ['e9'])).toEqual([])
  })

  it('puts claimed rows back in the order they were queued', () => {
    const rows = [{ id: 'c', created_at: '2026-11-21T17:03:00+00:00' }, { id: 'a', created_at: '2026-11-21T17:01:00+00:00' }, { id: 'b', created_at: '2026-11-21T17:02:00+00:00' }]
    expect(legalClaimedInOrder(rows).map((r) => r.id)).toEqual(['a', 'b', 'c'])
    expect(rows.map((r) => r.id)).toEqual(['c', 'a', 'b'])
  })
})

describe('the claim’s migration', () => {
  const file = readdirSync('supabase/migrations').find((f) => f.endsWith('_legal_notify_claim.sql'))!
  const sql = readFileSync(`supabase/migrations/${file}`, 'utf8')

  it('opens with a lock timeout and only adds: two nullable columns, two functions', () => {
    expect(sql.startsWith("SET lock_timeout = '3s';")).toBe(true)
    expect(sql).toContain('ALTER TABLE public.legal_notification_queue ADD COLUMN IF NOT EXISTS claimed_until timestamptz;')
    expect(sql).toContain('ALTER TABLE public.legal_firm_recipients ADD COLUMN IF NOT EXISTS digest_claimed_until timestamptz;')
    expect(sql).not.toMatch(/CREATE TABLE|DROP |NOT NULL/)
    expect(sql.match(/CREATE OR REPLACE FUNCTION/g)).toHaveLength(2)
  })

  it('claims a firm’s oldest open, free events without waiting on another run’s rows', () => {
    const fn = sql.slice(sql.indexOf('CREATE OR REPLACE FUNCTION public.legal_notify_claim_events'), sql.indexOf('CREATE OR REPLACE FUNCTION public.legal_notify_claim_digest'))
    expect(fn).toContain('c.sent_now_at IS NULL')
    expect(fn).toContain('(c.claimed_until IS NULL OR c.claimed_until <= now())')
    expect(fn).toContain('ORDER BY c.created_at')
    expect(fn).toContain('FOR UPDATE SKIP LOCKED')
    expect(fn).toContain('AS MATERIALIZED')
    expect(fn).toContain('RETURNING q.*')
  })

  it('claims a digest only when it is free and the person’s last digest is still the one the run read', () => {
    const fn = sql.slice(sql.indexOf('CREATE OR REPLACE FUNCTION public.legal_notify_claim_digest'))
    expect(fn).toContain('(r.digest_claimed_until IS NULL OR r.digest_claimed_until <= now())')
    expect(fn).toContain('r.last_digest_at IS NOT DISTINCT FROM p_last_digest_at')
  })

  it('only the service role may call either', () => {
    for (const sig of ['legal_notify_claim_events(uuid, int, int)', 'legal_notify_claim_digest(uuid, timestamptz, int)']) {
      expect(sql).toContain(`REVOKE EXECUTE ON FUNCTION public.${sig} FROM PUBLIC, anon, authenticated;`)
      expect(sql).toContain(`GRANT EXECUTE ON FUNCTION public.${sig} TO service_role;`)
    }
  })
})

describe('legal-notify-dispatch claims before it sends', () => {
  const src = readFileSync('supabase/functions/legal-notify-dispatch/index.ts', 'utf8')
  const post = src.slice(src.indexOf('// --- POST: the cron tick'))
  const now = post.slice(post.indexOf('// 1. "Now" recipients drain the queue.'), post.indexOf('// 2. Digests on each recipient'))
  const digest = post.slice(post.indexOf('// 2. Digests on each recipient'))

  it('the events are claimed before the first send, with the kernel’s limit and lease', () => {
    const claim = now.indexOf("admin.rpc('legal_notify_claim_events', { p_firm_id: firm.id, p_limit: LEGAL_NOTIFY_CLAIM_LIMIT, p_lease_seconds: LEGAL_NOTIFY_LEASE_SECONDS })")
    expect(claim).toBeGreaterThan(-1)
    expect(claim).toBeLessThan(now.indexOf('sendEmailViaResend('))
    // The read without a claim is only the answer to a missing function.
    expect(now.indexOf("else if (claimAnswer === 'missing')")).toBeLessThan(now.indexOf(".is('sent_now_at', null).order('created_at')"))
    expect(now.match(/\.is\('sent_now_at', null\)\.order\('created_at'\)/g)).toHaveLength(1)
  })

  it('each digest is claimed before it is built, against the last digest the run read', () => {
    const claim = digest.indexOf("admin.rpc('legal_notify_claim_digest', { p_recipient_id: r.id, p_last_digest_at: r.last_digest_at, p_lease_seconds: LEGAL_NOTIFY_LEASE_SECONDS })")
    expect(claim).toBeGreaterThan(-1)
    expect(claim).toBeLessThan(digest.indexOf('buildLegalDigestEmail('))
    expect(claim).toBeLessThan(digest.indexOf('sendEmailViaResend('))
  })

  it('every mark is written through the kernel, so the claim is let go with it', () => {
    expect(post).toContain('.update(legalEventLedgerPatch(sentTo, claimed))')
    expect(post).toContain('.update(legalEventStampPatch(new Date().toISOString(), claimed))')
    expect(post).toContain('.update(legalDigestSentPatch(readAt, new Date().toISOString(), digestClaimed))')
    expect(post).not.toContain('.update({ sent_to: sentTo })')
    expect(post).not.toContain('.update({ last_digest_at: readAt')
    expect(post).toContain('} finally {')
    expect(post).toContain('legalClaimLeftovers(claimedEvents, writtenEvents)')
    expect(post).toContain('legalClaimLeftovers(claimedDigests, writtenDigests)')
  })
})
