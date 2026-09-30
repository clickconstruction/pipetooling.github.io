/**
 * Where the checks went (v2.4043) — the kernel lives in
 * `supabase/functions/_shared/gcChecksApplied.ts` since v2.4260, so the
 * scheduled statement can read a GC's checks the way Find a check and the
 * printed sheet do. This is the client's door to it; the tests stay here.
 */
export * from '../../../supabase/functions/_shared/gcChecksApplied'
