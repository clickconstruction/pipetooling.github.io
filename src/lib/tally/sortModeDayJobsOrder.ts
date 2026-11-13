// The order Sort mode offers a purchase's day jobs in (punch list #72). The rule lives in
// `supabase/functions/_shared/dayJobsOrder.ts` since v2.7101 (punch list #299), one source for Sort mode and the
// receipt link's page, which reads it on the edge with no sign-in. Pure.

export { orderSortModeDayJobIds, type SortModeSessionRow } from '../../../supabase/functions/_shared/dayJobsOrder'
