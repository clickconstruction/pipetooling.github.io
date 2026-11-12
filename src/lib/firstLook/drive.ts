/**
 * First look in Google Drive (punch list #319 PR 2): the pure rules the card shares with the photo sweep. They live in
 * `supabase/functions/_shared/firstLookDrive.ts`, which has no imports, so the function and the app's tests read one copy.
 */
export * from '../../../supabase/functions/_shared/firstLookDrive'
