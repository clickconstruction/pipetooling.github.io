// Lives in supabase/functions/_shared/legalMatterShape.ts so `legal-portal` and the client's tests
// agree on what of a referred matter may reach the firm. This path is the client's door to it; the
// tests beside it run here.
export * from '../../../supabase/functions/_shared/legalMatterShape'
