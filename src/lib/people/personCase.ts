/**
 * Rows the system numbers on a person's HR file (punch list #315): the kernel lives in
 * `supabase/functions/_shared/personCase.ts`, with no app import, so the People → HR tab and the dev seat read one
 * implementation. This file is the app's door to it.
 */
export * from '../../../supabase/functions/_shared/personCase'
