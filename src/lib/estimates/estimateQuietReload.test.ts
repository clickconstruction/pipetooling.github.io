import { describe, expect, it } from 'vitest'
import type { CustomerRow } from '../customerContactDisplay'
import { buildEstimateDraftPersistPayload } from './estimateDraftPersist'
import {
  estimateDraftPayloadOfForm,
  estimateServerFormFromRow,
  reseedEstimateFormAfterSave,
  settledEstimateFormAfterSave,
  type EstimateEditorForm,
  type EstimateServerForm,
} from './estimateQuietReload'

/** A local-calendar day, as `addCalendarDaysYmd` reads it. */
const TODAY = new Date(2026, 10, 18)

const LINE = { line_item: 'Water heater', description: '', quantity: 1, unit_price_cents: 90_000, amount_cents: 90_000 }
const STUB_CENTS = 0

function option(key: string, recommended: boolean, name: string) {
  return { key, name, description: '', recommended, kind: 'choice' as const, line_items: [{ ...LINE, line_item: name }] }
}

function form(over: Partial<EstimateEditorForm> = {}): EstimateEditorForm {
  return {
    title: 'Water heater swap',
    terms: 'Net 30',
    lines: [LINE],
    options: [],
    viewedOptionKey: null,
    previewSelectedOptionKeys: [],
    coFields: { description_of_change: '', reason_for_change: '', impact_on_schedule: '', response_requested_by: '' },
    customerId: 'c1',
    customerSearch: 'Test Customer - 1 Main St',
    sendEmailOverride: '',
    validUntil: '2026-12-18',
    validUntilPreset: 30,
    forAddress: '',
    linkedProjectId: '',
    internalNotes: '',
    attachmentUrl: '',
    attachmentLabel: '',
    acceptHeaderBrand: null,
    cxOverrideFields: {},
    acceptNotifyUserIds: ['u1'],
    ...over,
  }
}

/** The server holding exactly what a form wrote. */
const serverOf = (f: EstimateEditorForm, over: Partial<EstimateServerForm> = {}): EstimateServerForm => ({ ...f, ...over })

function reseed(input: { sent: EstimateEditorForm; now?: EstimateEditorForm; server?: EstimateServerForm; isChangeOrder?: boolean }) {
  return reseedEstimateFormAfterSave({ sent: input.sent, now: input.now ?? input.sent, server: input.server ?? serverOf(input.sent), isChangeOrder: input.isChangeOrder ?? false })
}

describe('reseedEstimateFormAfterSave — nothing typed since the save', () => {
  it('moves nothing when the row holds what the editor wrote', () => {
    const sent = form()
    const out = reseed({ sent })
    expect(out.changed).toEqual([])
    expect(out.typedSince).toEqual([])
    // Every value is the screen's own, by reference: the page sets nothing and nothing re-renders for it.
    expect(out.form.lines).toBe(sent.lines)
    expect(out.form.coFields).toBe(sent.coFields)
  })

  it('takes what the row normalized: a trimmed title, a filled date, the stub line', () => {
    const sent = form({ title: 'Water heater swap  ', validUntil: '', validUntilPreset: null, lines: [] })
    const stub = { line_item: 'Line item', description: '', quantity: 1, unit_price_cents: STUB_CENTS, amount_cents: STUB_CENTS }
    const out = reseed({ sent, server: serverOf(sent, { title: 'Water heater swap', validUntil: '2026-12-18', validUntilPreset: 30, lines: [stub] }) })
    expect(out.form.title).toBe('Water heater swap')
    expect(out.form.validUntil).toBe('2026-12-18')
    expect(out.form.validUntilPreset).toBe(30)
    expect(out.form.lines).toEqual([stub])
    expect([...out.changed].sort()).toEqual(['lines', 'title', 'validUntil', 'validUntilPreset'])
    expect(out.typedSince).toEqual([])
  })

  it('takes a value somebody else wrote', () => {
    const sent = form()
    const out = reseed({ sent, server: serverOf(sent, { internalNotes: 'Call before 9', linkedProjectId: 'p1' }) })
    expect(out.form.internalNotes).toBe('Call before 9')
    expect(out.form.linkedProjectId).toBe('p1')
    expect([...out.changed].sort()).toEqual(['internalNotes', 'linkedProjectId'])
  })

  it('keeps its own notify list when the row has never had one', () => {
    const sent = form({ acceptNotifyUserIds: ['u1', 'u2'] })
    const out = reseed({ sent, server: serverOf(sent, { acceptNotifyUserIds: null }) })
    expect(out.form.acceptNotifyUserIds).toBe(sent.acceptNotifyUserIds)
    expect(out.changed).toEqual([])
  })
})

describe('reseedEstimateFormAfterSave — typed while the save was in flight', () => {
  it('keeps the newer typing and names it, field by field', () => {
    const sent = form({ title: 'Water heater swap  ' })
    const now = { ...sent, terms: 'Net 15', internalNotes: 'Gate code 4' }
    const out = reseed({ sent, now, server: serverOf(sent, { title: 'Water heater swap' }) })
    // The typed fields stand; the untouched one still takes the row's.
    expect(out.form.terms).toBe('Net 15')
    expect(out.form.internalNotes).toBe('Gate code 4')
    expect(out.form.title).toBe('Water heater swap')
    expect(out.changed).toEqual(['title'])
    expect([...out.typedSince].sort()).toEqual(['internalNotes', 'terms'])
  })

  it('keeps a field typed back to what it was before the save, and still names it', () => {
    const sent = form({ terms: 'Net 15' })
    const now = { ...sent, terms: 'Net 30' }
    const out = reseed({ sent, now })
    expect(out.form.terms).toBe('Net 30')
    expect(out.typedSince).toEqual(['terms'])
  })

  it('keeps the typing when the row moved too: the next save writes over it, as a save always has', () => {
    const sent = form()
    const now = { ...sent, internalNotes: 'Mine' }
    const out = reseed({ sent, now, server: serverOf(sent, { internalNotes: 'Theirs' }) })
    expect(out.form.internalNotes).toBe('Mine')
    expect(out.changed).toEqual([])
    expect(out.typedSince).toEqual(['internalNotes'])
  })

  it('keeps a line typed in since the save, whole', () => {
    const sent = form()
    const now = { ...sent, lines: [{ ...LINE, line_item: 'Water heater, 50 gal' }] }
    const out = reseed({ sent, now })
    expect(out.form.lines).toBe(now.lines)
    expect(out.typedSince).toEqual(['lines'])
  })

  it('keeps a customer picked since the save', () => {
    const sent = form()
    const now = { ...sent, customerId: 'c2', customerSearch: 'Other Customer' }
    const out = reseed({ sent, now })
    expect(out.form.customerId).toBe('c2')
    expect(out.form.customerSearch).toBe('Other Customer')
    expect(out.typedSince).toEqual(['customerId'])
  })
})

describe('reseedEstimateFormAfterSave — a date caught half typed', () => {
  it('keeps the half-typed Expires on, which the save left out, and its preset', () => {
    const sent = form({ validUntil: '0002-12-18', validUntilPreset: null })
    const out = reseed({ sent, server: serverOf(sent, { validUntil: '2026-12-01', validUntilPreset: 30 }) })
    expect(out.form.validUntil).toBe('0002-12-18')
    expect(out.form.validUntilPreset).toBeNull()
    expect(out.changed).toEqual([])
  })

  it('keeps a change order’s details whole when its response date was half typed', () => {
    const typed = { description_of_change: 'Add a hose bibb', reason_for_change: 'Owner asked', impact_on_schedule: 'none', response_requested_by: '0020-12-01' }
    const sent = form({ coFields: typed })
    const saved = { description_of_change: 'Add a bibb', reason_for_change: '', impact_on_schedule: '', response_requested_by: '' }
    const out = reseed({ sent, server: serverOf(sent, { coFields: saved }), isChangeOrder: true })
    expect(out.form.coFields).toBe(typed)
    expect(out.changed).toEqual([])
  })

  it('takes the row’s details on an estimate, whose response date is never held', () => {
    const sent = form({ coFields: { description_of_change: '', reason_for_change: '', impact_on_schedule: '', response_requested_by: '0020-12-01' } })
    const saved = { description_of_change: '', reason_for_change: '', impact_on_schedule: '', response_requested_by: '' }
    const out = reseed({ sent, server: serverOf(sent, { coFields: saved }) })
    expect(out.form.coFields).toEqual(saved)
  })
})

describe('reseedEstimateFormAfterSave — the screen’s own fields', () => {
  const A = option('a', true, 'Standard')
  const B = option('b', false, 'Premium')

  it('stays on the option being viewed, where a row opens on the starred one', () => {
    const sent = form({ options: [A, B], viewedOptionKey: 'b', lines: B.line_items, previewSelectedOptionKeys: ['b'] })
    const server = serverOf(sent, { viewedOptionKey: 'a', lines: A.line_items, previewSelectedOptionKeys: ['a'] })
    const out = reseed({ sent, server })
    expect(out.form.viewedOptionKey).toBe('b')
    expect(out.form.lines).toEqual(B.line_items)
    // The Page preview keeps what was ticked to rehearse.
    expect(out.form.previewSelectedOptionKeys).toEqual(['b'])
    expect(out.changed).toEqual([])
  })

  it('opens the starred option when the viewed one is gone from the row', () => {
    const sent = form({ options: [A, B], viewedOptionKey: 'b', lines: B.line_items, previewSelectedOptionKeys: ['b'] })
    const server = serverOf(sent, { options: [A], viewedOptionKey: 'a', lines: A.line_items, previewSelectedOptionKeys: ['a'] })
    const out = reseed({ sent, server })
    expect(out.form.options).toEqual([A])
    expect(out.form.viewedOptionKey).toBe('a')
    expect(out.form.lines).toEqual(A.line_items)
    expect(out.form.previewSelectedOptionKeys).toEqual(['a'])
  })

  it('keeps the options, the view and the lines together when any of them was touched', () => {
    const sent = form({ options: [A, B], viewedOptionKey: 'b', lines: B.line_items, previewSelectedOptionKeys: ['a'] })
    const now = { ...sent, lines: [{ ...LINE, line_item: 'Premium, tankless' }] }
    const server = serverOf(sent, { options: [A], viewedOptionKey: 'a', lines: A.line_items })
    const out = reseed({ sent, now, server })
    expect(out.form.options).toBe(now.options)
    expect(out.form.viewedOptionKey).toBe('b')
    expect(out.form.lines).toBe(now.lines)
  })

  it('keeps the text in the customer box while the customer is the same one', () => {
    // Typing over a picked customer clears the pick and saves: the box holds a search, not a name.
    const sent = form({ customerId: null, customerSearch: 'Tes' })
    const now = { ...sent, customerSearch: 'Test C' }
    const out = reseed({ sent, now, server: serverOf(sent, { customerSearch: '' }) })
    expect(out.form.customerSearch).toBe('Test C')
    expect(out.changed).toEqual([])
    expect(out.typedSince).toEqual([])
  })

  it('takes the row’s customer and its name when the row holds another customer', () => {
    const sent = form()
    const out = reseed({ sent, server: serverOf(sent, { customerId: 'c9', customerSearch: 'Ninth Customer' }) })
    expect(out.form.customerId).toBe('c9')
    expect(out.form.customerSearch).toBe('Ninth Customer')
  })
})

describe('settledEstimateFormAfterSave — the autosave’s baseline after a save', () => {
  it('is the screen when nothing was typed, and differs from it by what was typed', () => {
    const sent = form({ title: 'Water heater swap  ' })
    const server = serverOf(sent, { title: 'Water heater swap' })
    const settled = settledEstimateFormAfterSave({ sent, server, isChangeOrder: false })
    expect(settled).toEqual(reseed({ sent, server }).form)
    const typed = reseed({ sent, now: { ...sent, terms: 'Net 15' }, server }).form
    const ctx = { isChangeOrder: false, customers: [] }
    const a = estimateDraftPayloadOfForm(settled, ctx)
    const b = estimateDraftPayloadOfForm(typed, ctx)
    expect(a.title).toBe(b.title)
    expect(a.terms_snapshot).toBe('Net 30')
    expect(b.terms_snapshot).toBe('Net 15')
  })

  it('holds a field typed back to its old value as unsaved: the row has the saved one', () => {
    const sent = form({ terms: 'Net 15' })
    const settled = settledEstimateFormAfterSave({ sent, server: serverOf(sent), isChangeOrder: false })
    const screen = reseed({ sent, now: { ...sent, terms: 'Net 30' } }).form
    const ctx = { isChangeOrder: false, customers: [] }
    expect(JSON.stringify(estimateDraftPayloadOfForm(screen, ctx))).not.toBe(JSON.stringify(estimateDraftPayloadOfForm(settled, ctx)))
  })
})

describe('estimateDraftPayloadOfForm', () => {
  const customers = [
    { id: 'c1', contact_info: { email: 'owner@customer.test' } },
    { id: 'c2', contact_info: null },
  ] as unknown as Array<Pick<CustomerRow, 'id' | 'contact_info'>>

  it('sends to the customer’s own email, else the one typed under Send to, else nobody', () => {
    const ctx = { isChangeOrder: false, customers }
    expect(estimateDraftPayloadOfForm(form({ sendEmailOverride: 'typed@customer.test' }), ctx).customer_email).toBe('owner@customer.test')
    expect(estimateDraftPayloadOfForm(form({ customerId: 'c2', sendEmailOverride: ' typed@customer.test ' }), ctx).customer_email).toBe('typed@customer.test')
    expect(estimateDraftPayloadOfForm(form({ customerId: 'c2' }), ctx).customer_email).toBeNull()
    expect(estimateDraftPayloadOfForm(form({ customerId: null, sendEmailOverride: 'typed@customer.test' }), ctx).customer_email).toBeNull()
  })

  it('writes the customer copy only when a line of it is overridden, and the attachment only with a link', () => {
    const ctx = { isChangeOrder: false, customers }
    const plain = estimateDraftPayloadOfForm(form({ attachmentLabel: 'Spec sheet' }), ctx)
    expect(plain.customer_experience_overrides).toBeNull()
    expect(plain.customer_attachment_url).toBeNull()
    expect(plain.customer_attachment_label).toBeNull()
    const full = estimateDraftPayloadOfForm(form({ cxOverrideFields: { thank_you_title: ' Thank you, neighbor ' }, attachmentUrl: 'https://drive.example/spec', attachmentLabel: 'Spec sheet' }), ctx)
    expect(full.customer_experience_overrides).toEqual({ thank_you_title: 'Thank you, neighbor' })
    expect(full.customer_attachment_url).toBe('https://drive.example/spec')
    expect(full.customer_attachment_label).toBe('Spec sheet')
  })

  it('is the one builder’s payload for the same fields', () => {
    const f = form({ linkedProjectId: 'p1' })
    const direct = buildEstimateDraftPersistPayload(
      {
        isChangeOrder: false,
        title: f.title,
        terms: f.terms,
        lines: f.lines,
        totalCents: 90_000,
        options: f.options,
        viewedOptionKey: f.viewedOptionKey,
        validUntil: f.validUntil,
        forAddress: f.forAddress,
        linkedProjectId: f.linkedProjectId,
        internalNotes: f.internalNotes,
        customerId: f.customerId,
        customerEmail: 'owner@customer.test',
        customerExperienceOverrides: null,
        acceptHeaderBrand: null,
        acceptNotifyUserIds: f.acceptNotifyUserIds,
        changeOrderFields: f.coFields,
      },
      { url: null, label: null },
    )
    // Key for key and in the same order: the autosave compares the JSON.
    expect(JSON.stringify(estimateDraftPayloadOfForm(f, { isChangeOrder: false, customers }))).toBe(JSON.stringify(direct))
  })
})

describe('estimateServerFormFromRow', () => {
  const row = {
    status: 'draft',
    doc_kind: 'estimate',
    title: 'Estimate',
    accept_header_brand: null,
    terms_snapshot: 'Net 30',
    line_items_snapshot: [],
    options_snapshot: null,
    change_order_fields: null,
    customer_id: 'c1',
    customer_email: 'saved@customer.test',
    customer_experience_overrides: { thank_you_title: 'Thank you' },
    valid_until: null,
    for_address: null,
    project_id: null,
    internal_notes: null,
    accept_notify_user_ids: null,
    customer_attachment_url: null,
    customer_attachment_label: null,
    customer_attachment_sent: null,
  } as unknown as Parameters<typeof estimateServerFormFromRow>[0]
  const customers = [{ id: 'c1', name: 'Test Customer', address: '1 Main St', contact_info: null }] as unknown as Parameters<typeof estimateServerFormFromRow>[1]

  it('opens a row by the rules the page opens it with', () => {
    const f = estimateServerFormFromRow(row, customers, TODAY)
    // A generic title on a draft with a customer takes the customer's default.
    expect(f.title).not.toBe('Estimate')
    expect(f.title).toContain('Test Customer')
    expect(f.customerSearch).toBe('Test Customer - 1 Main St')
    // No email on the customer's record, so the saved address shows under Send to.
    expect(f.sendEmailOverride).toBe('saved@customer.test')
    expect(f.validUntil).toBe('2026-12-18')
    expect(f.validUntilPreset).toBe(30)
    expect(f.lines).toHaveLength(1)
    expect(f.cxOverrideFields).toEqual({ thank_you_title: 'Thank you' })
    // Never had a notify list: the page keeps its own.
    expect(f.acceptNotifyUserIds).toBeNull()
  })

  it('reads a saved notify list', () => {
    const f = estimateServerFormFromRow({ ...row, accept_notify_user_ids: ['u1', 'u2'] } as typeof row, customers, TODAY)
    expect(f.acceptNotifyUserIds).toEqual(['u1', 'u2'])
  })
})
