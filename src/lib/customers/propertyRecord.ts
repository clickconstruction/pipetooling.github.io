/**
 * Client re-export of the shared Texas parcel-record kernel (customer
 * properties train, PR 1 — v2.3004). See
 * `supabase/functions/_shared/txParcelRecord.ts`; tests live beside this file.
 */
export {
  addressStreetKey,
  applyProposalToFields,
  cityStraddlesCounties,
  countyFromGoogleComponents,
  countySourceLabel,
  homesteadHint,
  normalizeCountyName,
  ownerLooksLikeCompany,
  parcelProvenanceLine,
  parseTxParcelIdentify,
  proposeCounty,
  proposePropertyRecord,
  titleCaseUpperWords,
  TX_PARCEL_IDENTIFY_URL,
  TX_STRADDLING_CITIES,
  type CountyProposal,
  type CountySource,
  type HomesteadHint,
  type ParcelRecord,
  type PropertyRecordFields,
  type ProposedPropertyRecord,
} from '../../../supabase/functions/_shared/txParcelRecord'
