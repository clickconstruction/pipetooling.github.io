/**
 * Client door to the estimate email builder. The Deno file is dependency-free, so the staff
 * Email preview renders the exact message `send-estimate-to-customer` sends — one builder, no
 * mirror to keep in sync (the bid-room email test set the precedent for importing it).
 */
export {
  buildEstimateLetterheadEmail,
  estimateEmailCompanyName,
  formatYmdForEmail,
  splitBodyTemplateParagraphs,
  type EstimateLetterheadBrand,
  type EstimateLetterheadEmail,
  type EstimateLetterheadInput,
  type EstimateLetterheadOption,
} from '../../supabase/functions/_shared/estimateEmailLetterhead'
