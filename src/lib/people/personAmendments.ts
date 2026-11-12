/**
 * Corrections as links on a person's HR file (punch list #315): the kernel lives in
 * `supabase/functions/_shared/personAmendments.ts`, with no app import, so the People → HR tab and the dev seat read
 * one implementation. This file is the app's door to it, as `personTimeline.ts` is to the Timeline's.
 */
export * from '../../../supabase/functions/_shared/personAmendments'
