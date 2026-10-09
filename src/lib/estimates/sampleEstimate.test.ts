import { describe, expect, it } from 'vitest'
import { ESTIMATE_PUBLIC_TERMS_KEY, sampleEstimateResponse } from '../../../supabase/functions/_shared/customerSampleFixtures'
import { normalizeSharedEstimateOptions, sharedEstimateOptionTotalCents } from '../../../supabase/functions/_shared/estimateOptions'
import { SAMPLE_ESTIMATE } from '../../../supabase/functions/_shared/customerSample'
import { buildSampleEstimateEmail } from '../customerSampleEmails'
import { defaultEstimateSelection, estimateOptionsDraftPersistFields, normalizeEstimateOptionsFromJson } from './estimateOptions'

const today = '2026-10-09'
type Body = { options: ReturnType<typeof normalizeSharedEstimateOptions>; line_items_snapshot: unknown; total_cents: number; terms_snapshot: string }
const live = sampleEstimateResponse([], 'live', today)
const body = live.body as unknown as Body

describe('the sample estimate, through the options kernels (v2.5112, #103)', () => {
  it('offers what a saved estimate offers: two choices with the ★ on the tank, and one add-on', () => {
    expect(live.status).toBe(200)
    expect(body.options.map((o) => [o.key, o.kind, o.recommended, sharedEstimateOptionTotalCents(o)])).toEqual([
      ['sample-option-tank', 'choice', true, 438_000],
      ['sample-option-tankless', 'choice', false, 620_000],
      ['sample-option-recirc', 'add_on', false, 65_000],
    ])
  })

  it('is the save kernel’s output, read back the way get-estimate-for-customer reads a row', () => {
    // The save mirrors the recommended option into the legacy fields; the sample serves exactly that.
    const resaved = estimateOptionsDraftPersistFields(body.options, null, [])
    expect(body.line_items_snapshot).toEqual(resaved.line_items_snapshot)
    expect(body.total_cents).toBe(resaved.total_cents)
    expect(body.line_items_snapshot).toEqual(SAMPLE_ESTIMATE.lines)
    expect(body.total_cents).toBe(SAMPLE_ESTIMATE.totalCents)
    // The shared read is idempotent on the served options, and the accept page's own parse agrees.
    expect(normalizeSharedEstimateOptions(JSON.parse(JSON.stringify(body.options)))).toEqual(body.options)
    expect(normalizeEstimateOptionsFromJson(body.options)).toEqual(body.options)
  })

  it('starts the customer on the ★ choice alone; the add-on waits for a tick', () => {
    expect(defaultEstimateSelection(normalizeEstimateOptionsFromJson(body.options))).toEqual(['sample-option-tank'])
  })

  it('takes today’s Settings for the terms, and the thank-you state is unchanged', () => {
    const withTerms = sampleEstimateResponse([{ key: ESTIMATE_PUBLIC_TERMS_KEY, value_text: 'Net 15.' }], 'live', today).body as unknown as Body
    expect(withTerms.terms_snapshot).toBe('Net 15.')
    const done = sampleEstimateResponse([], 'done', today)
    expect(done.status).toBe(409)
    expect(done.body).not.toHaveProperty('options')
  })

  it('the sample email prices every option, as send-estimate-to-customer does', () => {
    const mail = buildSampleEstimateEmail({ rows: [], origin: 'https://clicktooling.com', todayYmd: today, dateLabel: 'Oct 9, 2026', sender: null })
    expect(mail.html).toContain('Tankless gas heater')
    expect(mail.html).toContain('Hot water recirculation pump')
    expect(mail.html).toContain('$6,200.00')
  })
})
