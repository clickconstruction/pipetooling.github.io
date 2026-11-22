// The helper beside `jobIsScheduledInKind` (punch list #301, the sweep of the readers): open bills with the ones a
// deal pays set apart, counted and named in one line. It lives in supabase/functions/_shared/inKindApart.ts so the
// emails read the same file the screens do. This path is the screens' door to it; the tests beside it run it.
export * from '../../../supabase/functions/_shared/inKindApart'
