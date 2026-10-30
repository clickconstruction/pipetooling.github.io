/**
 * The signed hours statement (punch list #212): one worker's recorded hours on one job for a period, what was paid, the
 * gap said plainly, and the attestation. The kernel lives in `supabase/functions/_shared/hoursStatement.ts`, with no
 * imports, so the job window's print and the dev MCP's verb read one implementation; this file is the app's door to it,
 * as `documents/folderName.ts` is to the Where files go kernel.
 */
export * from '../../../supabase/functions/_shared/hoursStatement'
