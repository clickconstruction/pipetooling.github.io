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
  SAMPLE_TOKEN_GC,
  SAMPLE_TOKEN_OWNER,
  SAMPLE_OWNER,
  SAMPLE_CONTRACT,
  SAMPLE_JOB_CONTRACT,
  sampleStateFromToken,
  ymdPlusDays,
  type SampleLineItem,
  type SampleState,
} from '../../supabase/functions/_shared/customerSample'

/**
 * `?t=sample-low` — a page's answer below its best, where the page has one (v2.5934: the rating page after two stars, with
 * the better question and the office's call). Client-side only and not a `SampleState`: the page draws it without a
 * fetch, so no edge function reads it and every other sample handler is unchanged.
 */
export const SAMPLE_TOKEN_LOW = 'sample-low'
