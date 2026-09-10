/**
 * Discount line items kernel — the implementation lives in
 * supabase/functions/_shared/discountLine.ts so the Stripe edge functions,
 * the form, the segment bar and the PDF builder all run one set of rules;
 * this module re-exports it for the app (same pattern as stagePlan.ts).
 */
export * from '../../../supabase/functions/_shared/discountLine.ts'
