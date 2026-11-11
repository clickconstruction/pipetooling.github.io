/**
 * Supply house bill lines, the checks (punch list #298 PR 1, v2.6817). The kernel lives beside the edge functions
 * since PR 2 (v2.6882), where `bill-lines-sweep` runs it on every bill it reads, and is re-exported here so the app
 * and the function hold one definition (the way `bills/billRead.ts` re-exports the reader).
 */
export * from '../../../../supabase/functions/_shared/paperChecks'
