import { describe, expect, it } from 'vitest'
import {
  buildEstimateDraftPersistPayload,
  estimateDraftHeldDateMessage,
  estimateDraftUnfinishedDateBlocksSend,
  estimateDraftUnfinishedDates,
  type EstimateDraftPersistFields,
} from './estimateDraftPersist'
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

  it('an Expires-on date caught mid-year is left out — not written, and not written as null', () => {
    for (const half of ['0002-10-15', '0020-10-15', '0202-10-15', '0026-10-15']) {
      const out = buildEstimateDraftPersistPayload({ ...base, validUntil: half }, att)
      expect('valid_until' in out).toBe(false)
      expect(out.title).toBe('Kitchen rough-in')
      expect(out.total_cents).toBe(150_000)
    }
    expect(buildEstimateDraftPersistPayload({ ...base, validUntil: '2026-10-15' }, att).valid_until).toBe('2026-10-15')
    // An emptied box is a cleared date.
    expect(buildEstimateDraftPersistPayload({ ...base, validUntil: '' }, att).valid_until).toBeNull()
  })

  it('a Response-requested-by date caught mid-year leaves change_order_fields out whole — the date rides inside it', () => {
    const co = { ...base, isChangeOrder: true }
    const half = buildEstimateDraftPersistPayload({ ...co, changeOrderFields: { ...base.changeOrderFields, response_requested_by: '0202-10-20' } }, att)
    expect('change_order_fields' in half).toBe(false)
    expect(half.valid_until).toBe('2026-10-15')
    const finished = buildEstimateDraftPersistPayload({ ...co, changeOrderFields: { ...base.changeOrderFields, response_requested_by: '2026-10-20' } }, att)
    expect(finished.change_order_fields?.response_requested_by).toBe('2026-10-20')
    const cleared = buildEstimateDraftPersistPayload({ ...co, changeOrderFields: { ...base.changeOrderFields, response_requested_by: '' } }, att)
    expect(cleared.change_order_fields?.response_requested_by).toBe('')
  })

  it('the dirty check sees a half-typed date as a change, and the finished one as another', () => {
    const json = (validUntil: string) => JSON.stringify(buildEstimateDraftPersistPayload({ ...base, validUntil }, att))
    expect(json('0002-10-15')).not.toBe(json('2026-10-15'))
    expect(json('0002-10-15')).toBe(json('0020-10-15'))
    expect(json('2026-10-16')).not.toBe(json('0002-10-15'))
  })
})

describe('estimateDraftUnfinishedDates', () => {
  const co = { ...base, isChangeOrder: true, changeOrderFields: { ...base.changeOrderFields, response_requested_by: '0002-10-20' } }

  it('names the boxes held, and none when every date is finished or empty', () => {
    expect(estimateDraftUnfinishedDates(base)).toEqual([])
    expect(estimateDraftUnfinishedDates({ ...base, validUntil: '' })).toEqual([])
    expect(estimateDraftUnfinishedDates({ ...base, validUntil: '0026-10-15' })).toEqual(['valid_until'])
    expect(estimateDraftUnfinishedDates({ ...co, validUntil: '0026-10-15' })).toEqual(['valid_until', 'response_requested_by'])
  })

  it('an estimate has no Response-requested-by box, so a value there holds nothing', () => {
    expect(estimateDraftUnfinishedDates({ ...co, isChangeOrder: false })).toEqual([])
  })

  it('says the plain line for Expires on, and that the change order details waited for Response requested by', () => {
    expect(estimateDraftHeldDateMessage(['valid_until'], 2026)).toBe('That date was not finished, so it was not saved. Type the year in full, like 2026.')
    expect(estimateDraftHeldDateMessage(['valid_until', 'response_requested_by'], 2026)).toBe(
      '“Response requested by” is not a finished date, so the change order details were not saved. Type the year in full, like 2026.',
    )
  })

  it('blocks a send while a date is unfinished, naming the box; nothing held blocks nothing', () => {
    expect(estimateDraftUnfinishedDateBlocksSend([], 2026)).toBeNull()
    expect(estimateDraftUnfinishedDateBlocksSend(['valid_until'], 2026)).toBe('Finish the “Expires on” date before this goes out. Type the year in full, like 2026.')
    expect(estimateDraftUnfinishedDateBlocksSend(['response_requested_by'], 2026)).toBe('Finish the “Response requested by” date before this goes out. Type the year in full, like 2026.')
  })
})
