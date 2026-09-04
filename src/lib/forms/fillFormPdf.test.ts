import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import * as pdfLib from 'pdf-lib'
import fontkit from '@pdf-lib/fontkit'
import { describe, expect, it } from 'vitest'
import { fillFormPdf, readPdfFields, type FormPdfLibLike } from './fillFormPdf'
import { buildFillPlan, draftSchemaFromPdfFields, sampleValues, validateFormSchema } from './formSchema'

const lib = pdfLib as unknown as FormPdfLibLike
const W9 = readFileSync(resolve(__dirname, '../../test/fixtures/fw9-2024-03.pdf'))
const CURSIVE = readFileSync(resolve(__dirname, '../../../public/fonts/GreatVibes-Regular.ttf'))

describe('readPdfFields on the IRS W-9 (Rev. March 2024)', () => {
  it('reads six Letter pages and 23 fillable fields with rectangles on page 1', async () => {
    const r = await readPdfFields(lib, W9)
    expect(r.pages).toHaveLength(6)
    expect(r.pages[0]).toEqual({ width: 611.98, height: 791.97 })
    expect(r.fields).toHaveLength(23)
    expect(r.fields.every((f) => f.page === 1)).toBe(true)
    const name = r.fields.find((f) => f.name.endsWith('f1_01[0]'))
    expect(name).toMatchObject({ kind: 'text', rect: { x: 58.6, w: 517.4, h: 14 } })
    expect(r.fields.filter((f) => f.kind === 'checkbox')).toHaveLength(8)
    expect(r.fields.find((f) => f.name.endsWith('f1_03[0]'))?.maxLength).toBe(1)
    expect(r.fields.find((f) => f.name.endsWith('f1_15[0]'))?.maxLength).toBe(7)
  })
})

describe('draft → fill → read back → flatten', () => {
  it('fills bound fields by name, splits digits across the SSN segments, and flattens away the form', async () => {
    const info = await readPdfFields(lib, W9)
    const schema = draftSchemaFromPdfFields(info.fields, info.pages)
    expect(validateFormSchema(schema)).toEqual([])
    // Promote the drafted SSN boxes into one masked digits box, the way the studio would.
    const ssnKeys = ['f1_11', 'f1_12', 'f1_13']
    const ssnBinds = ssnKeys.map((k) => schema.boxes.find((b) => b.key === k)!.bind!)
    schema.boxes = schema.boxes.filter((b) => !ssnKeys.includes(b.key))
    schema.boxes.push({ key: 'ssn', type: 'digits', page: 1, rect: { x: 417.6, y: 396, w: 158.4, h: 24 }, order: 500, label: 'SSN', mask: '###-##-####', bindSegments: ssnBinds, sensitive: true })
    schema.boxes.push({ key: 'signature', type: 'signature', page: 1, rect: { x: 131, y: 196, w: 250, h: 16 }, order: 900, label: 'Signature' })
    schema.boxes.push({ key: 'date', type: 'date', page: 1, rect: { x: 400, y: 196, w: 170, h: 16 }, order: 910, label: 'Date', dateMode: 'today' })
    schema.boxes.find((b) => b.key === 'f1_01')!.sample = 'Misses Taunya Rachelle'
    schema.boxes.find((b) => b.key === 'c1_1_0')!.sample = 'true'

    const values = { ...sampleValues(schema), ssn: '123-45-6789' }
    const plan = buildFillPlan(schema, values, { todayLabel: 'Sep 4, 2026', signature: { mode: 'type', text: 'Taunya Rachelle' } })

    // Unflattened: the field values are readable, proving the binds landed.
    const draft = await fillFormPdf(lib, W9, plan, { flatten: false })
    expect(draft.skipped).toEqual([])
    const reopened = await pdfLib.PDFDocument.load(draft.bytes, { ignoreEncryption: true })
    const form = reopened.getForm()
    expect(form.getTextField('topmostSubform[0].Page1[0].f1_01[0]').getText()).toBe('Misses Taunya Rachelle')
    expect(form.getCheckBox('topmostSubform[0].Page1[0].Boxes3a-b_ReadOrder[0].c1_1[0]').isChecked()).toBe(true)
    expect(form.getTextField('topmostSubform[0].Page1[0].f1_11[0]').getText()).toBe('123')
    expect(form.getTextField('topmostSubform[0].Page1[0].f1_12[0]').getText()).toBe('45')
    expect(form.getTextField('topmostSubform[0].Page1[0].f1_13[0]').getText()).toBe('6789')

    // Flattened with the cursive face embedded: no fields remain, six pages still.
    const final = await fillFormPdf(lib, W9, plan, { cursiveFontBytes: CURSIVE, fontkit })
    const flat = await pdfLib.PDFDocument.load(final.bytes, { ignoreEncryption: true })
    expect(flat.getForm().getFields()).toHaveLength(0)
    expect(flat.getPageCount()).toBe(6)
    expect(final.bytes.byteLength).toBeGreaterThan(W9.byteLength)
  })

  it('reports binds the PDF does not have instead of throwing', async () => {
    const r = await fillFormPdf(lib, W9, [{ kind: 'setText', bind: 'nope[0]', text: 'x' }, { kind: 'check', bind: 'nah[0]' }], { flatten: false })
    expect(r.skipped).toEqual(['nope[0]', 'nah[0]'])
  })
})
