/**
 * The sample responses the public fetch functions return for the sample token (What customers
 * see, Settings dev tab). Each one lays the live Settings over `customerSample.ts` so the page
 * renders exactly what a real customer would get with today's copy, terms, footer and brand.
 */
import { SAMPLE_BID, SAMPLE_CHANGE_ORDER, SAMPLE_ESTIMATE, SAMPLE_GC, SAMPLE_HOMEOWNER, ymdPlusDays, type SampleState } from './customerSample.ts'
import { resolveEstimateCustomerExperience, toClientCustomerExperience } from './estimateCustomerExperience.ts'
import type { SharedBidRoomPayload } from './bidRoomPayload.ts'

export type AppSettingRow = { key: string; value_text: string | null }

export const ESTIMATE_PUBLIC_TERMS_KEY = 'estimate_public_terms_body'
export const BID_COVER_LETTER_TERMS_KEY = 'bid_cover_letter_terms_default_v1'
export const BID_COVER_LETTER_EXCLUSIONS_KEY = 'bid_cover_letter_exclusions_default_v1'

function setting(rows: AppSettingRow[], key: string): string | null {
  const v = rows.find((r) => r.key === key)?.value_text
  const t = (v ?? '').trim()
  return t ? t : null
}

/** get-estimate-for-customer, sample token: 200 with the live estimate, or the 409 the thank-you page reads. */
export function sampleEstimateResponse(rows: AppSettingRow[], state: SampleState, todayYmd: string): { status: number; body: Record<string, unknown> } {
  const resolved = resolveEstimateCustomerExperience(rows, null, { acceptUrl: '', title: SAMPLE_ESTIMATE.title, estimateNumber: SAMPLE_ESTIMATE.number }, { docKind: 'estimate' })
  const customer_experience = toClientCustomerExperience(resolved)
  if (state === 'done') {
    return { status: 409, body: { error: 'Already accepted', code: 'already_accepted', customer_experience, accept_header_brand: 'plum' } }
  }
  return {
    status: 200,
    body: {
      id: SAMPLE_ESTIMATE.id,
      title: SAMPLE_ESTIMATE.title,
      line_items_snapshot: SAMPLE_ESTIMATE.lines,
      terms_snapshot: setting(rows, ESTIMATE_PUBLIC_TERMS_KEY) ?? SAMPLE_ESTIMATE.termsFallback,
      total_cents: SAMPLE_ESTIMATE.totalCents,
      valid_until: ymdPlusDays(todayYmd, SAMPLE_ESTIMATE.validDays),
      for_line: SAMPLE_HOMEOWNER.address,
      customer_experience,
      accept_header_brand: 'plum',
      customer_attachment: null,
      doc_kind: 'estimate',
      change_order_fields: null,
      options: [],
    },
  }
}

/** get-bid-proposal-room, sample token: the room with one pending change order; `done` = signed. */
export function sampleBidRoomResponse(rows: AppSettingRow[], state: SampleState, nowIso: string, todayYmd: string): Record<string, unknown> {
  const payload: SharedBidRoomPayload = {
    v: 1,
    project_name: SAMPLE_BID.projectName,
    project_address: SAMPLE_BID.projectAddress,
    gc_name: SAMPLE_GC.company,
    service_type_name: SAMPLE_BID.serviceTypeName,
    options: SAMPLE_BID.options.map((o) => ({ key: o.key, name: o.name, is_base: o.is_base, total_cents: o.total_cents, fixture_rows: o.fixture_rows.map((r) => ({ ...r })) })),
    inclusions: SAMPLE_BID.inclusions,
    exclusions: setting(rows, BID_COVER_LETTER_EXCLUSIONS_KEY) ?? SAMPLE_BID.exclusionsFallback,
    terms: setting(rows, BID_COVER_LETTER_TERMS_KEY) ?? SAMPLE_BID.termsFallback,
    header_brand: SAMPLE_BID.headerBrand,
  }
  const base = SAMPLE_BID.options[0]
  const signed = state === 'done'
  return {
    revision: { id: 'sample-revision', rev_number: signed ? 2 : 1, note: signed ? SAMPLE_BID.revisionNote : '', published_at: nowIso },
    payload,
    attachment: null,
    outcome: signed
      ? { event_type: 'signed', metadata: { option_key: base.key, option_name: base.name, total_cents: base.total_cents, printed_name: SAMPLE_GC.contact }, occurred_at: nowIso }
      : null,
    documents: [
      {
        id: SAMPLE_CHANGE_ORDER.id,
        title: SAMPLE_CHANGE_ORDER.title,
        change_order_fields: {
          description_of_change: SAMPLE_CHANGE_ORDER.description,
          reason_for_change: SAMPLE_CHANGE_ORDER.reason,
          impact_on_schedule: '+2 working days',
          response_requested_by: ymdPlusDays(todayYmd, 7),
        },
        line_items_snapshot: SAMPLE_CHANGE_ORDER.lines,
        terms_snapshot: null,
        total_cents: SAMPLE_CHANGE_ORDER.netChangeCents,
        status: signed ? 'customer_accepted' : 'sent',
        sent_at: nowIso,
        acceptor_printed_name: signed ? SAMPLE_GC.contact : null,
        acceptor_consented_at: signed ? nowIso : null,
      },
    ],
  }
}
