/**
 * Client door to the contract-forms schema kernel. The Deno file is
 * dependency-free, so the Form Studio, the signer overlay, and the tests
 * import the exact code `accept-contract` runs (the letterhead-email precedent).
 */
export * from '../../../supabase/functions/_shared/formSchema'
