/**
 * Employer block at top of printed/preview pay reports (People → Pay), and of a signed hours statement. The values live
 * in `supabase/functions/_shared/payReportEmployerHeader.ts` since v2.6411, so the statement's PDF (drawn in a function)
 * and its HTML print (drawn here) name one company block; this file re-exports them.
 */
export { PAY_REPORT_ADDRESS, PAY_REPORT_EIN, PAY_REPORT_EMPLOYER_NAME } from '../../supabase/functions/_shared/payReportEmployerHeader'
