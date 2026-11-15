/**
 * What a signer typed or ticked on a form, keyed by box key; checkboxes are booleans. On its own so the hours statement's
 * form (`hoursStatementForm.ts`) takes the shape without the form schema's 22 KB (punch list #359, v2.7292): on the edge a
 * function uploads every file an import names, a type import too, and dev-mcp carried the schema for this one type.
 * `formSchema.ts` re-exports it, so every reader of the schema imports as before.
 */
export type FormValues = Record<string, string | boolean>
