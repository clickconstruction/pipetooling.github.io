/**
 * The signed hours statement drawn as a PDF with its form schema (punch list #212, PR 3). The builder lives in
 * `supabase/functions/_shared/hoursStatementPdf.ts` and takes pdf-lib as a parameter; the function imports it from
 * esm.sh, the app and vitest from node_modules.
 */
export * from '../../../supabase/functions/_shared/hoursStatementPdf'
