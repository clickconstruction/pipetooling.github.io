export type ClockBidsSearchParamsOpts = {
  serviceTypes: Array<{ id: string; name: string }>
  enabledBidServiceTypeIds: string[]
  subcontractorServiceTypeIds: string[] | null
}

/** Bid search args for `search_bids_for_clock` from toggle state (Clock In modals, Estimator reference search, etc.). */
export function buildClockBidsSearchParams(
  p_search_text: string,
  opts: ClockBidsSearchParamsOpts,
): { p_search_text: string; p_service_type_id?: string; p_service_type_ids?: string[] } {
  const bidsParams: { p_search_text: string; p_service_type_id?: string; p_service_type_ids?: string[] } = {
    p_search_text,
  }
  const typeIds = new Set(opts.serviceTypes.map((t) => t.id))
  const enabled = opts.enabledBidServiceTypeIds.filter((id) => typeIds.has(id))

  if (opts.subcontractorServiceTypeIds && opts.subcontractorServiceTypeIds.length > 0) {
    const allowed = opts.subcontractorServiceTypeIds
    const effective = allowed.filter((id) => enabled.includes(id))
    bidsParams.p_service_type_ids = effective.length > 0 ? effective : allowed
    return bidsParams
  }

  if (opts.serviceTypes.length <= 1) {
    if (enabled.length === 1) bidsParams.p_service_type_id = enabled[0]
    return bidsParams
  }

  if (enabled.length === 1) {
    bidsParams.p_service_type_id = enabled[0]
    return bidsParams
  }
  if (enabled.length === opts.serviceTypes.length) {
    return bidsParams
  }
  if (enabled.length > 1) {
    bidsParams.p_service_type_ids = enabled
  }
  return bidsParams
}
