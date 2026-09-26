import { describe, expect, it } from 'vitest'
import { buildEstimateDraftPersistPayload, type EstimateDraftPersistFields } from './estimateDraftPersist'
import type { EstimateOption } from './estimateOptions'

const line = (description: string, amount_cents: number) => ({ line_item: 'Work', description, quantity: 1, unit_price_cents: amount_cents, amount_cents })
const opt = (key: string, name: string, cents: number, recommended = false): EstimateOption =>
  ({ key, name, kind: 'choice', recommended, line_items: [line(name, cents)] }) as unknown as EstimateOption

const base: EstimateDraftPersistFields = {
  isChangeOrder: false,
  title: '  Kitchen rough-in ',
  terms: 'Net 15',
  lines: [line('rough', 120_000), line('trim', 30_000)],
  totalCents: 150_000,
  options: [],
  viewedOptionKey: null,
  validUntil: ' 2026-10-15 ',
  forAddress: '',
  linkedProjectId: '',
  internalNotes: '  ',
  customerId: 'cust-1',
  customerEmail: 'a@x.test',
  customerExperienceOverrides: null,
  acceptHeaderBrand: 'plum',
  acceptNotifyUserIds: ['u1', 'u2', 'u1', '', 7, null],
  changeOrderFields: { description_of_change: 'x', reason_for_change: 'y', impact_on_schedule: 'z', response_requested_by: '' },
}
const att = { url: 'https://drive/x', label: 'Plans' }

describe('buildEstimateDraftPersistPayload', () => {
  it('writes the lines and their total, trims the title, nulls the blanks, keeps the ids', () => {
    expect(buildEstimateDraftPersistPayload(base, att)).toEqual({
      title: 'Kitchen rough-in',
      terms_snapshot: 'Net 15',
      line_items_snapshot: base.lines,
      total_cents: 150_000,
      options_snapshot: null,
      valid_until: '2026-10-15',
      for_address: null,
      project_id: null,
      internal_notes: null,
      customer_id: 'cust-1',
      customer_email: 'a@x.test',
      customer_experience_overrides: null,
      accept_header_brand: 'plum',
      customer_attachment_url: 'https://drive/x',
      customer_attachment_label: 'Plans',
      accept_notify_user_ids: ['u1', 'u2'],
    })
  })

  it('the title falls back by kind: Estimate, or Change order', () => {
    expect(buildEstimateDraftPersistPayload({ ...base, title: '   ' }, att).title).toBe('Estimate')
    expect(buildEstimateDraftPersistPayload({ ...base, title: '', isChangeOrder: true }, att).title).toBe('Change order')
  })

  it('change_order_fields is written on a change order only — an estimate’s payload has no such key', () => {
    const co = buildEstimateDraftPersistPayload({ ...base, isChangeOrder: true }, att)
    expect(co.change_order_fields).toEqual(base.changeOrderFields)
    expect('change_order_fields' in buildEstimateDraftPersistPayload(base, att)).toBe(false)
  })

  it('with options, the legacy fields mirror the recommended option and options_snapshot carries them all, the viewed one synced to the lines on screen', () => {
    const options = [opt('a', 'Repair', 40_000), opt('b', 'Replace', 90_000, true)]
    const viewed = [line('Repair, edited', 45_000)]
    const out = buildEstimateDraftPersistPayload({ ...base, options, viewedOptionKey: 'a', lines: viewed, totalCents: 45_000 }, att)
    expect(out.total_cents).toBe(90_000)
    expect(out.line_items_snapshot).toEqual([line('Replace', 90_000)])
    expect(out.options_snapshot?.map((o) => o.key)).toEqual(['a', 'b'])
    expect(out.options_snapshot?.[0]?.line_items).toEqual(viewed)
  })

  it('without options the total and lines write exactly as given and options_snapshot clears', () => {
    const out = buildEstimateDraftPersistPayload({ ...base, options: [], totalCents: 7 }, att)
    expect(out.total_cents).toBe(7)
    expect(out.options_snapshot).toBeNull()
  })

  it('the attachment and a linked project pass through; the notify list drops empties and non-strings and de-duplicates', () => {
    const out = buildEstimateDraftPersistPayload({ ...base, linkedProjectId: 'proj-9', acceptNotifyUserIds: ['b', 'a', 'b'] }, { url: null, label: null })
    expect(out.project_id).toBe('proj-9')
    expect(out.customer_attachment_url).toBeNull()
    expect(out.customer_attachment_label).toBeNull()
    expect(out.accept_notify_user_ids).toEqual(['b', 'a'])
  })

  it('is the same object for the same fields — the autosave dirty check compares its JSON', () => {
    expect(JSON.stringify(buildEstimateDraftPersistPayload(base, att))).toBe(JSON.stringify(buildEstimateDraftPersistPayload({ ...base }, { ...att })))
  })
})
