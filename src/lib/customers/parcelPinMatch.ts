/**
 * Client re-export of the shared pin-and-parcel match kernel (v2.6520). See
 * `supabase/functions/_shared/parcelPinMatch.ts`; tests live beside this file.
 */
export {
  geocodePinHold,
  isBlankSitus,
  parcelSitusHold,
  pinHoldWords,
  streetCore,
  typedHouseNumber,
  type GeocodePrecision,
  type PinHold,
  type PinHoldKind,
} from '../../../supabase/functions/_shared/parcelPinMatch'
