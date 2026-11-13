/**
 * When each section of an HR document last changed (punch list #315, upgrade 5a): the kernel lives in
 * `supabase/functions/_shared/sectionFreshness.ts`, with no app import, so the People → HR tab and the dev seat can
 * read one implementation. This file is the app's door to it, as `personAmendments.ts` is to the links'.
 */
export * from '../../../supabase/functions/_shared/sectionFreshness'
