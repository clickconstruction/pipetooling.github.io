import { describe, expect, it } from 'vitest'
import { customerFieldsFromEstimate, defaultAcceptNotifyIds, estimateFormFromRow, estimateInitialTitle } from './estimateDetailHydration'

/** A local-calendar day, as `addCalendarDaysYmd` reads it. */
const TODAY = new Date(2026, 10, 17)

type Row = Parameters<typeof estimateFormFromRow>[0]

function row(over: Partial<Row> = {}): Row {
  return {
    status: 'draft',
    doc_kind: 'estimate',
    accept_header_brand: null,
    terms_snapshot: null,
    line_items_snapshot: [],
    options_snapshot: null,
    change_order_fields: null,
    customer_id: null,
    valid_until: null,
    for_address: null,
    project_id: null,
    internal_notes: null,
    accept_notify_user_ids: null,
    customer_attachment_url: null,
    customer_attachment_label: null,
    customer_attachment_sent: null,
    ...over,
  } as Row
}

const LINE = { line_item: 'Water heater', description: '', quantity: 1, unit_price_cents: 90_000, amount_cents: 90_000 }
function optionJson(key: string, recommended: boolean, name: string) {
  return { key, name, description: '', recommended, kind: 'choice', line_items: [{ ...LINE, line_item: name }] }
}

describe('estimateFormFromRow — the lines a row opens on', () => {
  it('opens an empty estimate draft on the stub line', () => {
    const form = estimateFormFromRow(row(), TODAY)
    expect(form.lines).toHaveLength(1)
    expect(form.lines[0]!.amount_cents).toBe(0)
    expect(form.options).toEqual([])
    expect(form.viewedOptionKey).toBeNull()
    expect(form.previewSelectedOptionKeys).toEqual([])
  })

  it('opens an empty change-order draft with no lines, for the guided prompt', () => {
    expect(estimateFormFromRow(row({ doc_kind: 'change_order' }), TODAY).lines).toEqual([])
  })

  it('opens a draft with lines on its own lines', () => {
    const form = estimateFormFromRow(row({ line_items_snapshot: [LINE] }), TODAY)
    expect(form.lines).toHaveLength(1)
    expect(form.lines[0]).toMatchObject({ line_item: 'Water heater', amount_cents: 90_000 })
  })

  it('leaves a sent row with no lines empty', () => {
    expect(estimateFormFromRow(row({ status: 'sent' }), TODAY).lines).toEqual([])
  })

  it('opens an estimate with options on the recommended option’s lines, with the default selection', () => {
    const form = estimateFormFromRow(
      row({ line_items_snapshot: [LINE], options_snapshot: [optionJson('a', false, 'Repair'), optionJson('b', true, 'Replace')] }),
      TODAY,
    )
    expect(form.options.map((o) => o.key)).toEqual(['a', 'b'])
    expect(form.viewedOptionKey).toBe('b')
    expect(form.previewSelectedOptionKeys).toEqual(['b'])
    expect(form.lines).toBe(form.options[1]!.line_items)
    expect(form.lines[0]!.line_item).toBe('Replace')
  })

  it('never gives a change order options, whatever the row holds', () => {
    const form = estimateFormFromRow(row({ doc_kind: 'change_order', options_snapshot: [optionJson('a', true, 'Repair')] }), TODAY)
    expect(form.options).toEqual([])
    expect(form.viewedOptionKey).toBeNull()
  })

  it('keeps a credit line negative on a change order and not on an estimate', () => {
    const credit = { line_item: 'Credit: omitted fixture', description: '', quantity: 1, unit_price_cents: -5_000, amount_cents: -5_000 }
    expect(estimateFormFromRow(row({ doc_kind: 'change_order', line_items_snapshot: [credit] }), TODAY).lines[0]!.amount_cents).toBe(-5_000)
    expect(estimateFormFromRow(row({ line_items_snapshot: [credit] }), TODAY).lines[0]!.amount_cents).toBeGreaterThanOrEqual(0)
  })
})

describe('estimateFormFromRow — the good-through date', () => {
  it('gives a draft with none today plus 30, with that preset lit', () => {
    const form = estimateFormFromRow(row(), TODAY)
    expect(form.validUntil).toBe('2026-12-17')
    expect(form.validUntilPreset).toBe(30)
  })

  it('keeps a draft’s own date and lights the preset it matches', () => {
    expect(estimateFormFromRow(row({ valid_until: '2026-11-24' }), TODAY)).toMatchObject({ validUntil: '2026-11-24', validUntilPreset: 7 })
    expect(estimateFormFromRow(row({ valid_until: '2026-12-02' }), TODAY)).toMatchObject({ validUntil: '2026-12-02', validUntilPreset: 15 })
    expect(estimateFormFromRow(row({ valid_until: '2026-12-25' }), TODAY)).toMatchObject({ validUntil: '2026-12-25', validUntilPreset: null })
  })

  it('never lights a preset on a sent row, and leaves a missing date blank', () => {
    expect(estimateFormFromRow(row({ status: 'sent', valid_until: '2026-11-24' }), TODAY)).toMatchObject({ validUntil: '2026-11-24', validUntilPreset: null })
    expect(estimateFormFromRow(row({ status: 'sent' }), TODAY)).toMatchObject({ validUntil: '', validUntilPreset: null })
  })
})

describe('estimateFormFromRow — who is told on acceptance', () => {
  it('asks for the default on a draft that never had a list', () => {
    const form = estimateFormFromRow(row(), TODAY)
    expect(form.acceptNotifyIds).toBe('draft-default')
    expect(form.acceptNotifyDisplayIds).toEqual([])
  })

  it('keeps a draft’s saved list, an empty one included', () => {
    expect(estimateFormFromRow(row({ accept_notify_user_ids: [] }), TODAY).acceptNotifyIds).toEqual([])
    expect(estimateFormFromRow(row({ accept_notify_user_ids: ['u1', '', 'u2'] }), TODAY).acceptNotifyIds).toEqual(['u1', 'u2'])
  })

  it('shows a sent row’s locked list, and nobody when it never had one', () => {
    expect(estimateFormFromRow(row({ status: 'sent', accept_notify_user_ids: ['u1'] }), TODAY)).toMatchObject({ acceptNotifyIds: ['u1'], acceptNotifyDisplayIds: ['u1'] })
    expect(estimateFormFromRow(row({ status: 'sent' }), TODAY)).toMatchObject({ acceptNotifyIds: [], acceptNotifyDisplayIds: [] })
  })
})

describe('defaultAcceptNotifyIds', () => {
  it('is the person editing, then every master technician, no one twice', () => {
    expect(defaultAcceptNotifyIds('me', ['m1', 'me', 'm2', null, ''])).toEqual(['me', 'm1', 'm2'])
    expect(defaultAcceptNotifyIds('me', [])).toEqual(['me'])
  })
})

describe('estimateFormFromRow — the attachment and the plain fields', () => {
  it('reads a draft’s live attachment', () => {
    const form = estimateFormFromRow(row({ customer_attachment_url: 'https://drive.example/a', customer_attachment_label: 'Plans', customer_attachment_sent: { url: 'https://drive.example/old', label: 'Old' } }), TODAY)
    expect(form).toMatchObject({ attachmentUrl: 'https://drive.example/a', attachmentLabel: 'Plans' })
  })

  it('reads a sent row’s frozen attachment, not the live columns', () => {
    const form = estimateFormFromRow(row({ status: 'sent', customer_attachment_url: 'https://drive.example/a', customer_attachment_label: 'Plans', customer_attachment_sent: { url: 'https://drive.example/sent', label: 'As sent' } }), TODAY)
    expect(form).toMatchObject({ attachmentUrl: 'https://drive.example/sent', attachmentLabel: 'As sent' })
    expect(estimateFormFromRow(row({ status: 'sent', customer_attachment_url: 'https://drive.example/a' }), TODAY)).toMatchObject({ attachmentUrl: '', attachmentLabel: '' })
  })

  it('turns missing text into empty strings and a missing customer into null', () => {
    expect(estimateFormFromRow(row(), TODAY)).toMatchObject({ terms: '', forAddress: '', linkedProjectId: '', internalNotes: '', customerId: null, acceptHeaderBrand: null })
    expect(
      estimateFormFromRow(row({ terms_snapshot: 'Net 30', for_address: '1 Main St', project_id: 'p1', internal_notes: 'gate code', customer_id: 'c1', accept_header_brand: 'plum' }), TODAY),
    ).toMatchObject({ terms: 'Net 30', forAddress: '1 Main St', linkedProjectId: 'p1', internalNotes: 'gate code', customerId: 'c1', acceptHeaderBrand: 'plum' })
  })

  it('reads the change-order fields', () => {
    const form = estimateFormFromRow(row({ doc_kind: 'change_order', change_order_fields: { description_of_change: 'Add a hose bibb' } }), TODAY)
    expect(form.coFields.description_of_change).toBe('Add a hose bibb')
    expect(form.coFields.reason_for_change).toBe('')
  })
})

describe('customerFieldsFromEstimate', () => {
  const customers = [
    { id: 'c1', name: 'ZZ Test Customer', address: '1 Main St', contact_info: { email: 'owner@customer.test' } },
    { id: 'c2', name: 'ZZ No Email', address: null, contact_info: {} },
  ]

  it('is blank with no customer on the row', () => {
    expect(customerFieldsFromEstimate({ customer_id: null, customer_email: 'x@y.test' }, customers)).toEqual({ customerSearch: '', sendEmailOverride: '' })
  })

  it('names the customer and drops the saved address when they have their own email', () => {
    expect(customerFieldsFromEstimate({ customer_id: 'c1', customer_email: 'typed@customer.test' }, customers)).toEqual({ customerSearch: 'ZZ Test Customer - 1 Main St', sendEmailOverride: '' })
  })

  it('keeps the saved address for a customer with no email', () => {
    expect(customerFieldsFromEstimate({ customer_id: 'c2', customer_email: 'typed@customer.test' }, customers)).toEqual({ customerSearch: 'ZZ No Email', sendEmailOverride: 'typed@customer.test' })
    expect(customerFieldsFromEstimate({ customer_id: 'c2', customer_email: null }, customers)).toEqual({ customerSearch: 'ZZ No Email', sendEmailOverride: '' })
  })

  it('keeps the saved address and a blank box when the customer is not in the list', () => {
    expect(customerFieldsFromEstimate({ customer_id: 'gone', customer_email: 'typed@customer.test' }, customers)).toEqual({ customerSearch: '', sendEmailOverride: 'typed@customer.test' })
  })
})

describe('estimateInitialTitle', () => {
  const customers = [{ id: 'c1', name: 'ZZ Test Customer' }, { id: 'c2', name: '   ' }]

  it('gives a generic-titled draft with a customer the customer’s default', () => {
    const estimate = estimateInitialTitle({ status: 'draft', customer_id: 'c1', title: '', doc_kind: 'estimate' }, customers)
    const changeOrder = estimateInitialTitle({ status: 'draft', customer_id: 'c1', title: 'Change order', doc_kind: 'change_order' }, customers)
    expect(estimate).toContain('ZZ Test Customer')
    expect(changeOrder).toContain('ZZ Test Customer')
    expect(changeOrder).not.toBe(estimate)
  })

  it('keeps a title someone wrote', () => {
    expect(estimateInitialTitle({ status: 'draft', customer_id: 'c1', title: 'Kitchen repipe', doc_kind: 'estimate' }, customers)).toBe('Kitchen repipe')
  })

  it('keeps a sent row’s title, generic or not', () => {
    expect(estimateInitialTitle({ status: 'sent', customer_id: 'c1', title: 'Estimate', doc_kind: 'estimate' }, customers)).toBe('Estimate')
  })

  it('keeps the title with no customer, a customer not in the list, or a blank name', () => {
    expect(estimateInitialTitle({ status: 'draft', customer_id: null, title: '', doc_kind: 'estimate' }, customers)).toBe('')
    expect(estimateInitialTitle({ status: 'draft', customer_id: 'gone', title: 'Estimate', doc_kind: 'estimate' }, customers)).toBe('Estimate')
    expect(estimateInitialTitle({ status: 'draft', customer_id: 'c2', title: '', doc_kind: 'estimate' }, customers)).toBe('')
  })
})
