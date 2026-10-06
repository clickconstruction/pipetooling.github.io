// Lives in supabase/functions/_shared/legalContactScope.ts so `legal-portal` sends the firm only
// the contact log entries about the matter's jobs or the account. This path is the client's door
// to it; the tests beside it run here.
export * from '../../../supabase/functions/_shared/legalContactScope'
