import { describe, expect, it } from 'vitest'
import {
  hasOfficeBoxes,
  schemaForParty,
  applyPrefill,
  askedBoxes,
  buildFillPlan,
  draftSchemaFromPdfFields,
  emptyFormSchema,
  formatDigitsWithMask,
  keyFromFieldName,
  lastFour,
  maskSegments,
  pdfRectToScreen,
  round2,
  screenRectToPdf,
  splitDigitsByMask,
  splitFormValuesForStorage,
  validateFormSchema,
  validateFormValues,
  type FormSchema,
  type PdfFieldInfo,
} from './formSchema'

const LETTER = { width: 612, height: 792 }

/** A W-9-shaped schema: name, classification group, address, SSN|EIN one-of, signature, date, requester constant. */
function w9Schema(): FormSchema {
  const s = emptyFormSchema([LETTER])
  s.boxes.push(
    { key: 'name', type: 'text', page: 1, rect: { x: 58, y: 660, w: 517, h: 14 }, order: 10, label: 'Name', required: true, bind: 'f1_01', prefill: 'person_name' },
    { key: 'business_name', type: 'text', page: 1, rect: { x: 58, y: 636, w: 517, h: 14 }, order: 20, label: 'Business name', bind: 'f1_02' },
    { key: 'cls_individual', type: 'checkbox', page: 1, rect: { x: 73, y: 603, w: 8, h: 8 }, order: 30, label: 'Individual', bind: 'c1_1[0]', group: 'classification' },
    { key: 'cls_ccorp', type: 'checkbox', page: 1, rect: { x: 180, y: 603, w: 8, h: 8 }, order: 31, label: 'C corp', bind: 'c1_1[1]', group: 'classification' },
    { key: 'address', type: 'text', page: 1, rect: { x: 58, y: 492, w: 329, h: 14 }, order: 40, label: 'Address', required: true, bind: 'f1_07' },
    { key: 'requester', type: 'constant', page: 1, rect: { x: 389, y: 468, w: 186, h: 38 }, order: 45, label: '', text: 'Click Plumbing and Electrical', bind: 'f1_09' },
    { key: 'ssn', type: 'digits', page: 1, rect: { x: 417, y: 396, w: 158, h: 24 }, order: 50, label: 'SSN', mask: '###-##-####', bindSegments: ['f1_11', 'f1_12', 'f1_13'], sensitive: true, oneOf: 'tin' },
    { key: 'ein', type: 'digits', page: 1, rect: { x: 417, y: 348, w: 144, h: 24 }, order: 51, label: 'EIN', mask: '##-#######', sensitive: true, oneOf: 'tin' },
    { key: 'signature', type: 'signature', page: 1, rect: { x: 105, y: 205, w: 400, h: 18 }, order: 60, label: 'Signature' },
    { key: 'date', type: 'date', page: 1, rect: { x: 530, y: 205, w: 60, h: 14 }, order: 61, label: 'Date', dateMode: 'today' },
  )
  s.groups.push({ key: 'classification', label: 'Federal tax classification', exactlyOne: true, required: true })
  s.oneOfs.push({ key: 'tin', label: 'Taxpayer number', required: true })
  return s
}

describe('masks', () => {
  it('splits, formats, and counts', () => {
    expect(maskSegments('###-##-####')).toEqual([3, 2, 4])
    expect(formatDigitsWithMask('123456789', '###-##-####')).toBe('123-45-6789')
    expect(formatDigitsWithMask('12345', '###-##-####')).toBe('123-45')
    expect(splitDigitsByMask('12 345 6789', '###-##-####')).toEqual(['123', '45', '6789'])
    expect(formatDigitsWithMask('123456789', '##-#######')).toBe('12-3456789')
    expect(lastFour('123-45-6789')).toBe('6789')
    expect(lastFour(true)).toBe('')
  })
})

describe('validateFormSchema', () => {
  it('accepts the W-9 shape and refuses structural mistakes', () => {
    expect(validateFormSchema(w9Schema())).toEqual([])
    const bad = w9Schema()
    bad.boxes.push({ key: 'Bad Key', type: 'digits', page: 3, rect: { x: 0, y: 0, w: 0, h: 5 }, order: 1, label: '' })
    const msgs = validateFormSchema(bad).map((e) => e.message)
    expect(msgs).toEqual(expect.arrayContaining([expect.stringContaining('Key must be'), expect.stringContaining('outside the document'), 'Box has no size', 'Label is empty', 'Digits box needs a mask']))
  })
})

describe('validateFormValues', () => {
  it('enforces required, digit counts, exactly-one groups, and one-of sets', () => {
    const s = w9Schema()
    const errs = validateFormValues(s, { business_name: 'x', cls_individual: true, cls_ccorp: true, ssn: '123', ein: '12-3456789', stray: 'y' })
    const msgs = errs.map((e) => e.message)
    expect(msgs).toContain('Name is required')
    expect(msgs).toContain('Address is required')
    expect(msgs).toContain('SSN needs 9 digits')
    expect(msgs).toContain('Pick only one: Federal tax classification')
    expect(msgs).toContain('Fill only one: Taxpayer number')
    expect(msgs).toContain('Unknown field')
  })

  it('passes a complete submission', () => {
    const s = w9Schema()
    expect(validateFormValues(s, { name: 'Taunya Rachelle', cls_individual: true, address: '4410 Oak Hollow Dr', ssn: '123-45-6789' })).toEqual([])
  })

  it('one-of required: neither filled is an error, one filled is fine', () => {
    const s = w9Schema()
    const base = { name: 'T', cls_individual: true, address: 'A' }
    expect(validateFormValues(s, base).map((e) => e.message)).toContain('Taxpayer number is required')
    expect(validateFormValues(s, { ...base, ein: '123456789' })).toEqual([])
  })
})

describe('applyPrefill + askedBoxes', () => {
  it('fills empty prefillable boxes only, and asks neither constants nor auto dates', () => {
    const s = w9Schema()
    const v = applyPrefill(s, { address: 'kept' }, { name: 'Misses Taunya', email: null, phone: null })
    expect(v).toEqual({ address: 'kept', name: 'Misses Taunya' })
    expect(applyPrefill(s, { name: 'typed' }, { name: 'roster', email: null, phone: null }).name).toBe('typed')
    expect(askedBoxes(s).map((b) => b.key)).toEqual(['name', 'business_name', 'cls_individual', 'cls_ccorp', 'address', 'ssn', 'ein', 'signature'])
  })
})

describe('splitFormValuesForStorage', () => {
  it('drops sensitive answers to a last-four hint', () => {
    const s = w9Schema()
    const r = splitFormValuesForStorage(s, { name: 'T', cls_individual: true, ssn: '123-45-6789', stray: 'x' })
    expect(r.values).toEqual({ name: 'T', cls_individual: true })
    expect(r.hints).toEqual({ ssn: '6789' })
  })
})

describe('buildFillPlan', () => {
  it('binds by name, splits digits across segments, draws signatures and unbound boxes', () => {
    const s = w9Schema()
    const plan = buildFillPlan(s, { name: 'Taunya', cls_individual: true, address: 'A St', ssn: '123456789' }, { todayLabel: 'Sep 4, 2026', signature: { mode: 'type', text: 'Taunya Rachelle' } })
    // Bound ops also carry page / rect / align so the executor can fall back to drawing; strip them here.
    const bare = plan.map((o) => (o.kind === 'setText' ? { kind: o.kind, bind: o.bind, text: o.text, fontSize: o.fontSize } : o.kind === 'check' ? { kind: o.kind, bind: o.bind } : o))
    expect(plan.filter((o) => o.kind === 'setText' && o.bind === 'f1_01')[0]).toMatchObject({ page: 1, rect: expect.objectContaining({ x: expect.any(Number) }) })
    expect(bare).toEqual([
      { kind: 'setText', bind: 'f1_01', text: 'Taunya', fontSize: undefined },
      { kind: 'check', bind: 'c1_1[0]' },
      { kind: 'setText', bind: 'f1_07', text: 'A St', fontSize: undefined },
      { kind: 'setText', bind: 'f1_09', text: 'Click Plumbing and Electrical', fontSize: undefined },
      { kind: 'setText', bind: 'f1_11', text: '123', fontSize: undefined },
      { kind: 'setText', bind: 'f1_12', text: '45', fontSize: undefined },
      { kind: 'setText', bind: 'f1_13', text: '6789', fontSize: undefined },
      { kind: 'drawText', page: 1, rect: { x: 105, y: 205, w: 400, h: 18 }, text: 'Taunya Rachelle', fontSize: 14, align: 'left', font: 'cursive' },
      { kind: 'drawText', page: 1, rect: { x: 530, y: 205, w: 60, h: 14 }, text: 'Sep 4, 2026', fontSize: 10, align: 'left', font: 'body' },
    ])
  })

  it('draws a masked EIN when the box is unbound, and a drawn signature as an image', () => {
    const s = w9Schema()
    const png = new Uint8Array([137, 80, 78, 71])
    const plan = buildFillPlan(s, { ein: '123456789' }, { todayLabel: 'Sep 4, 2026', signature: { mode: 'draw', png } })
    expect(plan).toContainEqual({ kind: 'drawText', page: 1, rect: { x: 417, y: 348, w: 144, h: 24 }, text: '12-3456789', fontSize: 10, align: 'left', font: 'body' })
    expect(plan).toContainEqual({ kind: 'drawImage', page: 1, rect: { x: 105, y: 205, w: 400, h: 18 }, png })
  })
})

describe('draftSchemaFromPdfFields', () => {
  it('turns text fields into bound boxes and sibling checkboxes into one exactly-one group, in reading order', () => {
    const fields: PdfFieldInfo[] = [
      { name: 'topmostSubform[0].Page1[0].f1_02[0]', kind: 'text', page: 1, rect: { x: 58, y: 636, w: 517, h: 14 } },
      { name: 'topmostSubform[0].Page1[0].f1_01[0]', kind: 'text', page: 1, rect: { x: 58, y: 660, w: 517, h: 14 } },
      { name: 'topmostSubform[0].Page1[0].Boxes3a-b_ReadOrder[0].c1_1[0]', kind: 'checkbox', page: 1, rect: { x: 73, y: 603, w: 8, h: 8 } },
      { name: 'topmostSubform[0].Page1[0].Boxes3a-b_ReadOrder[0].c1_1[1]', kind: 'checkbox', page: 1, rect: { x: 180, y: 603, w: 8, h: 8 } },
      { name: 'topmostSubform[0].Page1[0].Boxes3a-b_ReadOrder[0].c1_2[0]', kind: 'checkbox', page: 1, rect: { x: 440, y: 521, w: 8, h: 8 } },
      { name: 'topmostSubform[0].Page1[0].f1_03[0]', kind: 'text', page: 1, rect: { x: 417, y: 589, w: 28, h: 11 }, maxLength: 1 },
    ]
    const s = draftSchemaFromPdfFields(fields, [LETTER])
    expect(s.boxes.map((b) => b.key)).toEqual(['f1_01', 'f1_02', 'c1_1_0', 'c1_1_1', 'f1_03', 'c1_2_0'])
    expect(s.boxes[0]).toMatchObject({ type: 'text', bind: 'topmostSubform[0].Page1[0].f1_01[0]', label: 'Field f1_01', order: 10 })
    expect(s.boxes[4]).toMatchObject({ maxLength: 1 })
    expect(s.boxes.find((b) => b.key === 'c1_1_0')?.group).toBe('c1_1')
    expect(s.boxes.find((b) => b.key === 'c1_2_0')?.group).toBeUndefined()
    expect(s.groups).toEqual([{ key: 'c1_1', label: 'Choose one (c1_1)', exactlyOne: true, required: false }])
    expect(validateFormSchema(s)).toEqual([])
    expect(keyFromFieldName('a.b.Weird Name[2]')).toBe('weird_name_2')
  })
})

describe('geometry', () => {
  it('round-trips PDF rects through screen space', () => {
    const r = { x: 58.6, y: 660, w: 517.4, h: 14 }
    const s = pdfRectToScreen(r, LETTER, 1.5)
    expect({ left: round2(s.left), top: round2(s.top), width: round2(s.width), height: round2(s.height) }).toEqual({ left: 87.9, top: 177, width: 776.1, height: 21 })
    expect(screenRectToPdf(s, LETTER, 1.5)).toEqual(r)
  })
})

describe('parties (two-party forms)', () => {
  it('splits a schema by party, pruning groups and one-of sets, and fills office signature/date only from the office context', () => {
    const s = w9Schema()
    s.boxes.push({ key: 'emp_name', type: 'text', page: 1, rect: { x: 36, y: 79, w: 250, h: 19 }, order: 950, label: 'Employer', party: 'office' })
    s.boxes.push({ key: 'emp_sig', type: 'signature', page: 1, rect: { x: 294, y: 79, w: 190, h: 19 }, order: 960, label: 'Employer signature', party: 'office' })
    s.boxes.push({ key: 'emp_date', type: 'date', page: 1, rect: { x: 489, y: 79, w: 78, h: 19 }, order: 970, label: 'Date', dateMode: 'today', party: 'office' })
    expect(hasOfficeBoxes(s)).toBe(true)
    expect(hasOfficeBoxes(w9Schema())).toBe(false)
    const signer = schemaForParty(s, 'signer')
    const office = schemaForParty(s, 'office')
    expect(signer.boxes.map((b) => b.key)).not.toContain('emp_name')
    expect(office.boxes.map((b) => b.key)).toEqual(['emp_name', 'emp_sig', 'emp_date'])
    expect(office.groups).toEqual([])
    expect(office.oneOfs).toEqual([])
    expect(signer.groups.map((g) => g.key)).toEqual(s.groups.map((g) => g.key))
    // Without an office context the office signature and date produce nothing.
    const noOffice = buildFillPlan(office, { emp_name: 'Robert Douglas, Owner' }, { todayLabel: 'Sep 5, 2026', signature: { mode: 'type', text: 'Taunya' } })
    expect(noOffice.map((o) => o.kind)).toEqual(['drawText'])
    const withOffice = buildFillPlan(office, { emp_name: 'Robert Douglas, Owner' }, { todayLabel: 'x', signature: null, office: { signature: { mode: 'type', text: 'Robert Douglas' }, todayLabel: 'Sep 5, 2026' } })
    expect(withOffice.map((o) => (o.kind === 'drawText' ? o.text : o.kind))).toEqual(['Robert Douglas, Owner', 'Robert Douglas', 'Sep 5, 2026'])
  })
})
