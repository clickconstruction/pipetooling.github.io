/**
 * Stage Plan kernel — the line item is the stage. The implementation lives in
 * supabase/functions/_shared/stagePlan.ts so the customer-portal and
 * submit-portal-request functions run the same rules the Bill tab, the Edit
 * read-out and the customer drawer do; this module re-exports it for the app.
 */
export * from '../../../supabase/functions/_shared/stagePlan.ts'
