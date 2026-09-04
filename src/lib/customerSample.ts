/**
 * Client door to the sample fixture every public surface renders in Settings → What customers
 * see. Same file the edge functions serve — one fixture, no mirror.
 */
export {
  SAMPLE_BID,
  SAMPLE_CHANGE_ORDER,
  SAMPLE_ESTIMATE,
  SAMPLE_GC,
  SAMPLE_HOMEOWNER,
  SAMPLE_SUB,
  SAMPLE_TOKEN,
  SAMPLE_TOKEN_DONE,
  SAMPLE_VIEWER_ROLES,
  sampleStateFromToken,
  ymdPlusDays,
  type SampleLineItem,
  type SampleState,
} from '../../supabase/functions/_shared/customerSample'
