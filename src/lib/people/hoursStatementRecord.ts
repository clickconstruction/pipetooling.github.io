/**
 * The record of a signed hours statement (punch list #212, PR 2): the `HS-<job>-<n>` id and the state words. The
 * kernel lives in `supabase/functions/_shared/hoursStatementRecord.ts`, with no imports, so the window and the dev
 * MCP's verb (PR 5) mint one id the same way; this file is the app's door to it, as `hoursStatement.ts` is to the
 * statement's kernel.
 */
export * from '../../../supabase/functions/_shared/hoursStatementRecord'
