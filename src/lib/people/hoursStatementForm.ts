/**
 * The signed hours statement as a Contract Form (punch list #212, PR 3): the document's name, where its template lives,
 * the stated boxes' keys, the seed values and the stated days read back from the signer's answers. The kernel lives in
 * `supabase/functions/_shared/hoursStatementForm.ts` so the window, `accept-contract` and the dev MCP read one copy.
 */
export * from '../../../supabase/functions/_shared/hoursStatementForm'
