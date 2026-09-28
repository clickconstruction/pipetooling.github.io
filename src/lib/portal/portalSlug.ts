/**
 * Custom portal address (slug) kernel on the client. The pure part lives with the edge
 * functions (`supabase/functions/_shared/portalSlug.ts`) since the bill email assigns an
 * address on its own; tests live beside this file.
 */
export * from '../../../supabase/functions/_shared/portalSlug'
