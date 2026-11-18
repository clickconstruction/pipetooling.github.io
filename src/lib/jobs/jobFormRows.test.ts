import { describe, expect, it } from 'vitest'
import {
  fixtureRowHasUserContent,
  fixtureRowsAfterRemove,
  fixtureRowsWithDiscountRow,
  fixtureRowsWithGeneratedLines,
  materialRowHasUserContent,
  materialRowsAfterRemove,
  newEmptyPaymentRow,
  newJobFormHasBlockingContent,
  newJobImportButtonState,
  NEW_JOB_IMPORT_BLOCKED_HINT,
  normalizeFixtureDisplayName,
  paymentRowHasUserContent,
  paymentRowsFromJob,
} from './jobFormRows'
import type { FixtureRow, MaterialRow, PaymentRow } from './jobFormTypes'
import type { JobWithDetails } from '../../types/jobWithDetails'

const fixture = (o: Partial<FixtureRow> = {}): FixtureRow => ({ id: 'f', name: '', count: 1, line_unit_price: null, line_description: '', invoice_id: null, ...o })
const material = (o: Partial<MaterialRow> = {}): MaterialRow => ({ id: 'm', description: '', amount: 0, ...o })
const payment = (o: Partial<PaymentRow> = {}): PaymentRow => ({ id: 'p', amount: 0, paid_on: null, sent_on: null, note: null, payment_type: null, reference_number: null, invoice_id: null, mercury_transaction_id: null, ...o })

describe('normalizeFixtureDisplayName', () => {
  it('collapses whitespace/newlines and trims', () => {
    expect(normalizeFixtureDisplayName('  a\n b   c ')).toBe('a b c')
  })
})

describe('*RowHasUserContent', () => {
  it('material: description or nonzero amount', () => {
    expect(materialRowHasUserContent(material())).toBe(false)
    expect(materialRowHasUserContent(material({ amount: 5 }))).toBe(true)
    expect(materialRowHasUserContent(material({ description: 'x' }))).toBe(true)
  })
  it('fixture: name/desc/price or count != 1', () => {
    expect(fixtureRowHasUserContent(fixture())).toBe(false)
    expect(fixtureRowHasUserContent(fixture({ name: 'valve' }))).toBe(true)
    expect(fixtureRowHasUserContent(fixture({ count: 2 }))).toBe(true)
    expect(fixtureRowHasUserContent(fixture({ line_unit_price: 0 }))).toBe(true) // price set (even 0)
  })
  it('payment: any populated field', () => {
    expect(paymentRowHasUserContent(payment())).toBe(false)
    expect(paymentRowHasUserContent(payment({ amount: 1 }))).toBe(true)
    expect(paymentRowHasUserContent(payment({ reference_number: 'r' }))).toBe(true)
    expect(paymentRowHasUserContent(payment({ invoice_id: 'i' }))).toBe(true)
  })
})

describe('newEmptyPaymentRow / paymentRowsFromJob', () => {
  it('empty row has a uuid, zero amount, a paid_on date', () => {
    const r = newEmptyPaymentRow()
    expect(r.amount).toBe(0)
    expect(r.id).toMatch(/[0-9a-f-]{36}/)
    expect(r.paid_on).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })
  it('maps job payments, slicing paid_on to YMD; falls back to one empty row', () => {
    const job = { payments: [{ id: 'x', amount: '150.5', paid_on: '2026-07-19T10:00:00Z', note: 'n', payment_type: 't', reference_number: 'r', invoice_id: 'i', mercury_transaction_id: null }] } as unknown as JobWithDetails
    const rows = paymentRowsFromJob(job)
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ id: 'x', amount: 150.5, paid_on: '2026-07-19', note: 'n', invoice_id: 'i' })
    expect(paymentRowsFromJob({ payments: [] } as unknown as JobWithDetails)).toHaveLength(1)
  })
})

describe('newJobFormHasBlockingContent', () => {
  const base = {
    jobName: '', jobAddress: '', hcpNumber: '', customerName: '', customerEmail: '', customerPhone: '',
    dateMet: '', customerId: null, bidId: null, projectId: null, formServiceTypeId: 'svc', initialNewJobServiceTypeId: 'svc',
    googleDriveLink: '', jobPicturesLink: '', jobPlansLink: '',
    fixtures: [fixture()], materials: [material()], payments: [payment()], teamMemberIds: [] as string[],
  }
  it('is false for a pristine sheet (auto-picked service type does not count)', () => {
    expect(newJobFormHasBlockingContent(base)).toBe(false)
  })
  it('is true once any field, extra row, or team member is present', () => {
    expect(newJobFormHasBlockingContent({ ...base, jobName: 'x' })).toBe(true)
    expect(newJobFormHasBlockingContent({ ...base, formServiceTypeId: 'other' })).toBe(true)
    expect(newJobFormHasBlockingContent({ ...base, teamMemberIds: ['u1'] })).toBe(true)
    expect(newJobFormHasBlockingContent({ ...base, fixtures: [fixture({ name: 'v' })] })).toBe(true)
  })
})

describe('newJobImportButtonState', () => {
  it('is live on a blank New Job and greyed-with-hint once the sheet has content', () => {
    expect(newJobImportButtonState({ mode: 'new', isEditing: false, blocked: false })).toEqual({ visible: true, disabled: false, hint: null })
    expect(newJobImportButtonState({ mode: 'new', isEditing: false, blocked: true })).toEqual({
      visible: true,
      disabled: true,
      hint: NEW_JOB_IMPORT_BLOCKED_HINT,
    })
  })
  it('never renders on Edit Job', () => {
    expect(newJobImportButtonState({ mode: 'edit', isEditing: true, blocked: false }).visible).toBe(false)
    expect(newJobImportButtonState({ mode: 'new', isEditing: true, blocked: false }).visible).toBe(false)
  })
})

describe('materialRowsAfterRemove: an Other job charges row', () => {
  it('with more than one row, the pressed row goes and the rest keep their order', () => {
    const rows = [material({ id: 'a', description: 'Permit', amount: 125 }), material({ id: 'b', description: 'Dump fee', amount: 60 }), material({ id: 'c' })]
    expect(materialRowsAfterRemove(rows, 'b').map((r) => r.id)).toEqual(['a', 'c'])
  })

  it('the last row is cleared in place, never removed: it keeps its id and loses its words, amount, date and memo', () => {
    const only = material({ id: 'a', description: 'Permit', amount: 125, charged_on: '2026-11-03', memo: 'city hall' })
    expect(materialRowsAfterRemove([only], 'a')).toEqual([{ id: 'a', description: '', amount: 0, charged_on: null, memo: null }])
  })

  it('an id that is not the last row leaves the last row as it is, the same list handed back', () => {
    const rows = [material({ id: 'a', description: 'Permit', amount: 125 })]
    expect(materialRowsAfterRemove(rows, 'zz')).toBe(rows)
  })

  it('an id that is not on a longer list removes nothing', () => {
    const rows = [material({ id: 'a' }), material({ id: 'b' })]
    expect(materialRowsAfterRemove(rows, 'zz').map((r) => r.id)).toEqual(['a', 'b'])
  })

  it('an empty list stays empty', () => {
    const rows: MaterialRow[] = []
    expect(materialRowsAfterRemove(rows, 'a')).toBe(rows)
  })

  it('two rows down to one, then the one cleared: the list never drops below a row', () => {
    const two = [material({ id: 'a', description: 'Permit', amount: 125 }), material({ id: 'b', description: 'Dump fee', amount: 60 })]
    const one = materialRowsAfterRemove(two, 'a')
    expect(one.map((r) => r.id)).toEqual(['b'])
    const cleared = materialRowsAfterRemove(one, 'b')
    expect(cleared).toHaveLength(1)
    expect(materialRowHasUserContent(cleared[0]!)).toBe(false)
  })
})

describe('fixtureRowsAfterRemove: a line item', () => {
  it('with more than one line, the pressed line goes', () => {
    const rows = [fixture({ id: 'a', name: 'Rough-in' }), fixture({ id: 'b', name: 'Final' })]
    expect(fixtureRowsAfterRemove(rows, 'a').map((r) => r.id)).toEqual(['b'])
  })

  it('the last line is never removed, whatever it holds: the same list handed back', () => {
    const rows = [fixture({ id: 'a', name: 'Rough-in', line_unit_price: 1200 })]
    expect(fixtureRowsAfterRemove(rows, 'a')).toBe(rows)
    const blank = [fixture({ id: 'a' })]
    expect(fixtureRowsAfterRemove(blank, 'a')).toBe(blank)
  })

  it('unlike a charge, the last line is not cleared either', () => {
    const rows = [fixture({ id: 'a', name: 'Rough-in', line_unit_price: 1200 })]
    expect(fixtureRowsAfterRemove(rows, 'a')[0]).toMatchObject({ name: 'Rough-in', line_unit_price: 1200 })
  })

  it('an id that is not on the list removes nothing', () => {
    const rows = [fixture({ id: 'a' }), fixture({ id: 'b' })]
    expect(fixtureRowsAfterRemove(rows, 'zz').map((r) => r.id)).toEqual(['a', 'b'])
  })
})

describe('fixtureRowsWithDiscountRow: − Add discount', () => {
  const discount = fixture({ id: 'd', line_kind: 'discount' })

  it('takes the place of a lone blank placeholder', () => {
    expect(fixtureRowsWithDiscountRow([fixture({ id: 'a' })], discount)).toEqual([discount])
  })

  it('goes under the lines when the only line has a name or a price', () => {
    const named = fixture({ id: 'a', name: 'Rough-in' })
    expect(fixtureRowsWithDiscountRow([named], discount).map((r) => r.id)).toEqual(['a', 'd'])
    const priced = fixture({ id: 'a', line_unit_price: 0 })
    expect(fixtureRowsWithDiscountRow([priced], discount).map((r) => r.id)).toEqual(['a', 'd'])
  })

  it('a name of spaces is still a blank placeholder', () => {
    expect(fixtureRowsWithDiscountRow([fixture({ id: 'a', name: '   ' })], discount)).toEqual([discount])
  })

  it('a count or a scope note alone does not save the placeholder: this test reads name and price only', () => {
    expect(fixtureRowsWithDiscountRow([fixture({ id: 'a', count: 3 })], discount)).toEqual([discount])
    expect(fixtureRowsWithDiscountRow([fixture({ id: 'a', line_description: 'second floor' })], discount)).toEqual([discount])
  })

  it('a lone discount is not a placeholder: a second discount goes under it', () => {
    const first = fixture({ id: 'd1', line_kind: 'discount' })
    expect(fixtureRowsWithDiscountRow([first], discount).map((r) => r.id)).toEqual(['d1', 'd'])
  })

  it('with several lines it goes last, blank ones included', () => {
    const rows = [fixture({ id: 'a' }), fixture({ id: 'b' })]
    expect(fixtureRowsWithDiscountRow(rows, discount).map((r) => r.id)).toEqual(['a', 'b', 'd'])
  })

  it('on an empty list it is the only row', () => {
    expect(fixtureRowsWithDiscountRow([], discount)).toEqual([discount])
  })
})

describe('fixtureRowsWithGeneratedLines: the segment generator’s Add to job', () => {
  const made = [fixture({ id: 'g1', name: 'Rough-in', line_unit_price: 1200 }), fixture({ id: 'g2', name: 'Final', line_unit_price: 800 })]

  it('replaces a lone row nobody touched', () => {
    expect(fixtureRowsWithGeneratedLines([fixture({ id: 'a' })], made).map((r) => r.id)).toEqual(['g1', 'g2'])
  })

  it('keeps a lone row that holds anything: a name, a price, a scope note or a count other than 1', () => {
    for (const touched of [fixture({ id: 'a', name: 'Rough-in' }), fixture({ id: 'a', line_unit_price: 0 }), fixture({ id: 'a', line_description: 'second floor' }), fixture({ id: 'a', count: 3 })]) {
      expect(fixtureRowsWithGeneratedLines([touched], made).map((r) => r.id)).toEqual(['a', 'g1', 'g2'])
    }
  })

  it('its placeholder test is wider than the discount’s: a count of 3 keeps the row here and loses it there', () => {
    const counted = fixture({ id: 'a', count: 3 })
    expect(fixtureRowsWithGeneratedLines([counted], made)).toHaveLength(3)
    expect(fixtureRowsWithDiscountRow([counted], fixture({ id: 'd', line_kind: 'discount' }))).toHaveLength(1)
  })

  it('a lone blank discount row has no content of its own, so the generator replaces it', () => {
    expect(fixtureRowsWithGeneratedLines([fixture({ id: 'd', line_kind: 'discount' })], made).map((r) => r.id)).toEqual(['g1', 'g2'])
  })

  it('with several rows the lines go under them, blank ones kept', () => {
    const rows = [fixture({ id: 'a' }), fixture({ id: 'b' })]
    expect(fixtureRowsWithGeneratedLines(rows, made).map((r) => r.id)).toEqual(['a', 'b', 'g1', 'g2'])
  })

  it('on an empty list the lines are the list', () => {
    expect(fixtureRowsWithGeneratedLines([], made)).toEqual(made)
  })
})
