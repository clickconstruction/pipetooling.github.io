import { describe, expect, it } from 'vitest'
import type { FormSchema } from './formSchema'
import { buildPaperEntryRequest, checkScanFile, keyableBoxes, missingRequired, paperEntryBlockers } from './formPaperEntry'

const schema: FormSchema = {
  version: 1,
  pages: [{ width: 612, height: 792 }],
  boxes: [
    { key: 'name', type: 'text', page: 1, rect: { x: 0, y: 700, w: 100, h: 12 }, order: 10, label: 'Name', required: true },
    { key: 'cls_a', type: 'checkbox', page: 1, rect: { x: 0, y: 680, w: 8, h: 8 }, order: 20, label: 'Individual', group: 'cls' },
    { key: 'cls_b', type: 'checkbox', page: 1, rect: { x: 20, y: 680, w: 8, h: 8 }, order: 21, label: 'S corp', group: 'cls' },
    { key: 'ssn', type: 'digits', page: 1, rect: { x: 0, y: 600, w: 100, h: 12 }, order: 30, label: 'SSN', mask: '###-##-####', sensitive: true, oneOf: 'tin' },
    { key: 'ein', type: 'digits', page: 1, rect: { x: 0, y: 580, w: 100, h: 12 }, order: 31, label: 'EIN', mask: '##-#######', sensitive: true, oneOf: 'tin' },
    { key: 'requester', type: 'constant', page: 1, rect: { x: 0, y: 500, w: 100, h: 12 }, order: 40, label: '', text: 'Click' },
    { key: 'signature', type: 'signature', page: 1, rect: { x: 0, y: 400, w: 100, h: 12 }, order: 50, label: 'Signature' },
    { key: 'date', type: 'date', page: 1, rect: { x: 0, y: 380, w: 100, h: 12 }, order: 60, label: 'Date', dateMode: 'today' },
  ],
  groups: [{ key: 'cls', label: 'Classification', exactlyOne: true, required: true }],
  oneOfs: [{ key: 'tin', label: 'Taxpayer number', required: true }],
}

describe('missingRequired', () => {
  it('lists required boxes, groups, and one-of sets the answers leave empty, in order, once each', () => {
    expect(missingRequired(schema, {})).toEqual([
      { key: 'name', label: 'Name' },
      { key: 'group:cls', label: 'Classification' },
      { key: 'oneof:tin', label: 'Taxpayer number' },
    ])
    expect(missingRequired(schema, { name: 'A', cls_b: true, ein: '123456789' })).toEqual([])
    expect(missingRequired(schema, { name: 'A', ssn: '1' })).toEqual([{ key: 'group:cls', label: 'Classification' }])
  })
})

describe('checkScanFile + keyableBoxes', () => {
  it('accepts photos and PDFs under 8 MB, refuses the rest', () => {
    expect(checkScanFile({ type: 'image/jpeg', size: 2_000_000, name: 'w9.jpg' })).toEqual({ ok: true, ext: 'jpg' })
    expect(checkScanFile({ type: '', size: 500, name: 'scan.PDF' })).toEqual({ ok: true, ext: 'pdf' })
    expect(checkScanFile({ type: 'text/plain', size: 10, name: 'x.txt' })).toMatchObject({ ok: false })
    expect(checkScanFile({ type: 'image/png', size: 9 * 1024 * 1024, name: 'x.png' })).toMatchObject({ ok: false, error: expect.stringMatching(/8 MB/) })
    expect(checkScanFile({ type: 'image/png', size: 0, name: 'x.png' })).toMatchObject({ ok: false })
    expect(keyableBoxes(schema).map((b) => b.key)).toEqual(['name', 'cls_a', 'cls_b', 'ssn', 'ein'])
  })
})

describe('buildPaperEntryRequest + blockers', () => {
  it('drops the values when the boxes are skipped and names what still blocks filing', () => {
    const req = buildPaperEntryRequest({ bookEntryId: 'b', personName: ' Taunya ', personId: 'p', values: { name: 'T' }, signerPrintedName: ' Taunya R ', signedOnYmd: '2026-09-02', skipBoxes: true, scan: null })
    expect(req).toMatchObject({ action: 'file', person_name: 'Taunya', formValues: {}, signer_printed_name: 'Taunya R', skip_boxes: true, attested: true })
    expect(buildPaperEntryRequest({ ...{ bookEntryId: 'b', personName: 'T', personId: null, values: { name: 'T' }, signerPrintedName: 'T', signedOnYmd: '2026-09-02', skipBoxes: false, scan: null } }).formValues).toEqual({ name: 'T' })
    expect(paperEntryBlockers({ signerPrintedName: '', signedOnYmd: 'bad', attested: false, hasScan: false, skipBoxes: true, anyValue: false })).toHaveLength(4)
    expect(paperEntryBlockers({ signerPrintedName: 'T', signedOnYmd: '2026-09-02', attested: true, hasScan: false, skipBoxes: false, anyValue: true })).toEqual([])
    expect(paperEntryBlockers({ signerPrintedName: 'T', signedOnYmd: '2026-09-02', attested: true, hasScan: false, skipBoxes: false, anyValue: false })).toHaveLength(1)
  })
})
