import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { plainWordsFailures } from '../../plainWords'
import {
  BILL_FIELD_KEYS,
  BILL_FILE_MAX_BYTES,
  BILL_MODEL,
  BILL_READ_WORDS,
  BILL_SCHEMA,
  BILL_TRIAL_MODEL,
  EMPTY_FIELD,
  billCostCents,
  billFromAnswer,
  billMedia,
  billReadIsOn,
  billRowRead,
  billStoragePath,
  dateYmd,
  field,
  guessCount,
  moneyCents,
  quantityNumber,
  readBillAnswer,
  readBillRequest,
  safeFileName,
  signedMoneyCents,
  typedCount,
  typedOver,
  type BillFields,
  type BillRead,
} from './billRead'

/**
 * `bill-read`'s pure parts (punch list #179 PR 2), held from the app's side: the request it reads, the shape it asks
 * for, the answer it trusts, the cost it reports, and the row's read. The made-up set in `src/test/fixtures/bills/`
 * (Ridgeway Supply, Cedar Bend Pipe & Supply, Oakmont Dental) is what the two models are scored against live.
 */

const FIXTURES = resolve(__dirname, '../../../test/fixtures/bills')
const answerOf = (slug: string): unknown => JSON.parse(readFileSync(resolve(FIXTURES, `${slug}.answer.json`), 'utf8'))
const INDEX = JSON.parse(readFileSync(resolve(FIXTURES, 'index.json'), 'utf8')) as Array<{ slug: string; pdf: string; answer: string }>
const HOUSE = '3f6c1d2e-8a4b-4c5d-9e0f-1a2b3c4d5e6f'
const ATTACHMENT = '9b8a7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d'

describe('readBillRequest', () => {
  it('reads a thread file, with the house when the caller knows it', () => {
    expect(readBillRequest({ attachment_id: ATTACHMENT })).toEqual({ ok: true, request: { source: 'attachment', attachmentId: ATTACHMENT, supplyHouseId: null, model: BILL_MODEL } })
    expect(readBillRequest({ attachment_id: ATTACHMENT, supply_house_id: HOUSE, model: BILL_TRIAL_MODEL })).toEqual({
      ok: true,
      request: { source: 'attachment', attachmentId: ATTACHMENT, supplyHouseId: HOUSE, model: BILL_TRIAL_MODEL },
    })
    expect(readBillRequest({ attachment_id: 'not-a-uuid' }).ok).toBe(false)
  })
  it('reads a dropped-in file only with its house, a readable kind and a size under the cap', () => {
    const file = { name: 'ticket.jpg', mime: 'image/jpeg', base64: 'AAAA' }
    expect(readBillRequest({ supply_house_id: HOUSE, file })).toEqual({ ok: true, request: { source: 'upload', supplyHouseId: HOUSE, name: 'ticket.jpg', mime: 'image/jpeg', base64: 'AAAA', model: BILL_MODEL } })
    expect(readBillRequest({ file })).toMatchObject({ ok: false, why: 'A dropped-in file needs the house it is for.' })
    expect(readBillRequest({ supply_house_id: HOUSE, file: { ...file, name: 'bill.docx', mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' } }).ok).toBe(false)
    expect(readBillRequest({ supply_house_id: HOUSE, file: { ...file, base64: 'A'.repeat(Math.ceil((BILL_FILE_MAX_BYTES * 4) / 3) + 8) } })).toMatchObject({ ok: false, why: expect.stringContaining('MB') })
    expect(readBillRequest({ supply_house_id: HOUSE, file: { name: '', mime: 'application/pdf', base64: 'AAAA' } }).ok).toBe(false)
  })
  it('refuses a model the card did not name, and nothing at all', () => {
    expect(readBillRequest({ attachment_id: ATTACHMENT, model: 'claude-opus-5-5' }).ok).toBe(false)
    expect(readBillRequest(null).ok).toBe(false)
    expect(readBillRequest({}).ok).toBe(false)
  })
})

describe('billMedia', () => {
  it('reads a PDF by mime or by name, and the four picture kinds', () => {
    expect(billMedia('application/pdf', 'S1183420.pdf')).toEqual({ kind: 'pdf', mediaType: 'application/pdf' })
    expect(billMedia('application/octet-stream', 'scan.PDF')).toEqual({ kind: 'pdf', mediaType: 'application/pdf' })
    expect(billMedia(null, 'ticket.jpeg')).toEqual({ kind: 'image', mediaType: 'image/jpeg' })
    expect(billMedia('image/png; charset=binary', 'x')).toEqual({ kind: 'image', mediaType: 'image/png' })
    expect(billMedia('image/webp', 'x.webp')?.kind).toBe('image')
  })
  it('reads nothing else: a HEIC, a Word file, a plain text', () => {
    expect(billMedia('image/heic', 'IMG_0412.HEIC')).toBeNull()
    expect(billMedia('application/msword', 'bill.doc')).toBeNull()
    expect(billMedia('text/plain', 'bill.txt')).toBeNull()
  })
})

describe('the printed digits', () => {
  it('money to cents, the sign dropped, a stray symbol forgiven', () => {
    expect(moneyCents('952.28')).toBe(95228)
    expect(moneyCents('$1,284.10')).toBe(128410)
    expect(moneyCents('(128.40)')).toBe(12840)
    expect(moneyCents('-138.99')).toBe(13899)
    expect(moneyCents('12')).toBe(1200)
    expect(moneyCents('7.5')).toBe(750)
    expect(moneyCents('')).toBeNull()
    expect(moneyCents('n/a')).toBeNull()
    expect(moneyCents(952.28)).toBe(95228)
  })
  it('quantities and dates', () => {
    expect(quantityNumber('12')).toBe(12)
    expect(quantityNumber('2.5')).toBe(2.5)
    expect(quantityNumber('')).toBeNull()
    expect(dateYmd('2026-10-22')).toBe('2026-10-22')
    expect(dateYmd('10/22/2026')).toBe('2026-10-22')
    expect(dateYmd('1/2/26')).toBe('2026-01-02')
    expect(dateYmd('Oct 22')).toBe('')
  })
})

describe('a line that takes money off keeps its sign', () => {
  it('reads a minus, parentheses, a trailing minus and CR as negative, and a plain amount as it is', () => {
    expect(signedMoneyCents('-40.00')).toBe(-4000)
    expect(signedMoneyCents('(40.00)')).toBe(-4000)
    expect(signedMoneyCents('40.00-')).toBe(-4000)
    expect(signedMoneyCents('40.00 CR')).toBe(-4000)
    expect(signedMoneyCents('$1,284.10')).toBe(128410)
    expect(signedMoneyCents('0.00')).toBe(0)
    expect(signedMoneyCents('-0.00')).toBe(0)
    expect(signedMoneyCents('')).toBeNull()
    expect(signedMoneyCents(-12.4)).toBe(-1240)
  })
  it('leaves the paper\'s own money unsigned: the kind carries the direction', () => {
    expect(moneyCents('-138.99')).toBe(13899)
  })
  it('asks the model for the sign on the line and nowhere else', () => {
    expect(BILL_SCHEMA.properties.lines.items.properties.extended.description).toMatch(/keeps a minus sign/)
    expect(BILL_SCHEMA.properties.total.description).toMatch(/always positive/)
  })
})

describe('readBillAnswer over the made-up set', () => {
  it('reads every fixture into a kind, a number, a date and cents', () => {
    for (const f of INDEX) {
      const read = readBillAnswer(answerOf(f.slug))
      expect(read, f.slug).not.toBeNull()
      expect(read!.number, f.slug).not.toBe('')
      expect(read!.dateYmd, f.slug).toMatch(/^\d{4}-\d{2}-\d{2}$/)
      expect(read!.totalCents, f.slug).toBeGreaterThan(0)
    }
  })
  it("the card's bill: five lines that add to the total with the tax", () => {
    const read = readBillAnswer(answerOf('ridgeway-S1183420'))!
    expect(read).toMatchObject({ houseName: 'Ridgeway Supply', kind: 'invoice', number: 'S1183420', dateYmd: '2026-10-22', poText: '41207', accountRef: 'CLICK PLUMBING', terms: 'Net 30', totalCents: 95228, taxCents: 7258, subtotalCents: 87970 })
    expect(read.lines).toHaveLength(5)
    expect(read.lines[0]).toEqual({ description: '3/4" Type L copper 20\'', quantity: 12, unitPriceCents: 4810, extendedCents: 57720, lineKind: 'part', houseCode: '', mfrNumber: '', unit: '', qtyOrdered: null, qtyShipped: null, qtyBackordered: null, unitPrice: 48.1, pricingUnit: 'each' })
    expect(read.lines.reduce((s, l) => s + (l.extendedCents ?? 0), 0) + read.taxCents!).toBe(read.totalCents)
    expect(read).toMatchObject({ orderNumber: '', freightCents: null })
  })
  it("reads the paper's own columns when the answer carries them (punch list #298): the code, the unit, the three quantities, the price whole with its pricing unit, the kind of line", () => {
    const read = readBillAnswer({
      document_kind: 'ship_ticket',
      number: 'S2394388.004',
      order_number: 'S2394388',
      freight: '45.00',
      lines: [
        { line_kind: 'part', house_code: '48370', mfr_number: '', description: 'PIPE 2X20 PVC DWV', unit: 'FT', quantity: '', qty_ordered: '200', qty_shipped: '120', qty_backordered: '80', unit_price: '0.507', pricing_unit: 'each', extended: '60.84' },
        { line_kind: 'charge', house_code: '', description: 'FUEL SURCHARGE', unit: '', quantity: '1', unit_price: '12.00', pricing_unit: 'EACH', extended: '12.00' },
        { line_kind: 'component', house_code: '', description: 'KINGSTON TANK RH', unit: 'EA', quantity: '1', unit_price: '', extended: '' },
        { line_kind: 'nonsense', house_code: 'C-10', description: '10 BRASS NIPPLE', unit: 'C', quantity: '10', unit_price: '79.31', pricing_unit: 'per_hundred', extended: '7.93' },
      ],
    })!
    expect(read).toMatchObject({ kind: 'ship_ticket', orderNumber: 'S2394388', freightCents: 4500 })
    expect(read.lines[0]).toMatchObject({ lineKind: 'part', houseCode: '48370', unit: 'FT', quantity: 120, qtyOrdered: 200, qtyShipped: 120, qtyBackordered: 80, unitPrice: 0.507, unitPriceCents: 51, pricingUnit: 'each', extendedCents: 6084 })
    expect(read.lines[1]).toMatchObject({ lineKind: 'charge', pricingUnit: 'each', unitPrice: 12 })
    expect(read.lines[2]).toMatchObject({ lineKind: 'component', unitPrice: null, extendedCents: null })
    expect(read.lines[3]).toMatchObject({ lineKind: 'part', pricingUnit: 'per_hundred', unitPrice: 79.31 })
    for (const kind of ['acknowledgement', 'quote', 'bid']) expect(readBillAnswer({ document_kind: kind })?.kind).toBe(kind)
  })
  it('the credit memo reads as a credit naming its invoice', () => {
    const read = readBillAnswer(answerOf('ridgeway-CM-20991'))!
    expect(read).toMatchObject({ kind: 'credit', number: 'CM-20991', referencesNumber: 'S1183420', totalCents: 13899 })
    expect(read.lines).toHaveLength(1)
  })
  it('the wrong total is kept as printed, so the sum check can catch it', () => {
    const read = readBillAnswer(answerOf('ridgeway-S1183455-wrong-total'))!
    expect(read.totalCents).toBe(128410)
    expect(read.lines.reduce((s, l) => s + (l.extendedCents ?? 0), 0) + read.taxCents!).toBe(124810)
  })
  it('the statement reads as a statement with its numbers', () => {
    const read = readBillAnswer(answerOf('ridgeway-statement-oct-2026'))!
    expect(read.kind).toBe('statement')
    expect(read.statementNumbers).toEqual(['S1183420', 'CM-20991', 'S1183455', 'S1184020'])
    expect(read.lines).toHaveLength(0)
  })
  it('refuses an answer that is not the shape, and forgives a US date and a missing page count', () => {
    expect(readBillAnswer(null)).toBeNull()
    expect(readBillAnswer({ document_kind: 'receipt' })).toBeNull()
    const loose = readBillAnswer({ document_kind: 'invoice', number: ' S1 ', date: '10/22/2026', lines: [{ description: '', extended: '' }, { description: 'x', extended: '1.00' }] })!
    expect(loose).toMatchObject({ number: 'S1', dateYmd: '2026-10-22', pageCount: 1 })
    expect(loose.lines).toHaveLength(1)
  })
  it('parses the text block of an answer, and nothing else', () => {
    expect(billFromAnswer([{ type: 'text', text: JSON.stringify(answerOf('ridgeway-S1183420')) }])?.number).toBe('S1183420')
    expect(billFromAnswer([{ type: 'text', text: 'not json' }])).toBeNull()
    expect(billFromAnswer([{ type: 'thinking' }])).toBeNull()
  })
})

describe('BILL_SCHEMA', () => {
  it('requires every property it names, with nothing structured output refuses', () => {
    expect([...BILL_SCHEMA.required].sort()).toEqual(Object.keys(BILL_SCHEMA.properties).sort())
    expect(BILL_SCHEMA.additionalProperties).toBe(false)
    const text = JSON.stringify(BILL_SCHEMA)
    expect(text).not.toMatch(/"minimum"|"maximum"|"minItems"|"pattern"/)
  })
})

describe('the cost, the switch, the path', () => {
  it('costs a fill at the model’s own rates', () => {
    expect(billCostCents(BILL_MODEL, { input_tokens: 3000, output_tokens: 600 })).toBe(1.2)
    expect(billCostCents(BILL_TRIAL_MODEL, { input_tokens: 3000, output_tokens: 600 })).toBe(0.06)
    expect(billCostCents('claude-opus-5-5', { input_tokens: 1_000_000 })).toBe(200)
    expect(billCostCents(BILL_MODEL, null)).toBe(0)
  })
  it('reads the switch as on only on the word true', () => {
    expect(billReadIsOn('true')).toBe(true)
    expect(billReadIsOn('false')).toBe(false)
    expect(billReadIsOn(null)).toBe(false)
  })
  it('keeps a dropped-in file under the house with a safe name', () => {
    expect(safeFileName('  Invoice S1183420 (final).pdf ')).toBe('Invoice-S1183420-final.pdf')
    expect(safeFileName('../../etc/passwd')).toBe('etcpasswd')
    expect(safeFileName('')).toBe('bill')
    expect(billStoragePath(HOUSE, ATTACHMENT, 'S1183420.pdf')).toBe(`bills/${HOUSE}/${ATTACHMENT}/S1183420.pdf`)
  })
})

describe('the row’s read', () => {
  const read = readBillAnswer(answerOf('ridgeway-S1183420')) as BillRead
  const fields = (): BillFields => ({
    kind: field('invoice', 'read'),
    number: field('S1183420', 'read'),
    date: field('2026-10-22', 'read'),
    amount: field('952.28', 'read'),
    purchaseOrder: field('41207', 'read'),
    job: field('job-1042', 'guessed', 'The paper names no job. J1042 is a guess from PO 41207 and the ship-to address.'),
    onJobAccount: field('true', 'guessed', 'A guess, since the account is open.'),
    dueDate: field('2026-11-21', 'read'),
    creditsInvoice: EMPTY_FIELD,
    link: field('/files/messages/abc', 'read'),
  })
  it('keeps the file, the fields with their sources, the lines and the checks', () => {
    const row = billRowRead({
      read,
      model: BILL_MODEL,
      readAt: '2026-10-29T15:00:00.000Z',
      readId: 'r1',
      file: { path: 'inbox/x.pdf', name: 'S1183420.pdf', mime: 'application/pdf', attachmentId: ATTACHMENT },
      fields: fields(),
      checks: { sum: { kind: 'right', lineCount: 5, sumCents: 95228, totalCents: 95228, withTax: true }, duplicate: null, statement: null, house: 'same' },
    })
    expect(row.v).toBe(1)
    expect(row.lines).toHaveLength(5)
    expect(row.totals).toEqual({ subtotalCents: 87970, taxCents: 7258, totalCents: 95228 })
    expect(row.fields.job.source).toBe('guessed')
    expect(JSON.parse(JSON.stringify(row))).toEqual(row)
  })
  it('a typed field keeps the person’s value and is counted', () => {
    const f = typedOver(fields(), 'purchaseOrder', '41207-A')
    expect(f.purchaseOrder).toEqual({ value: '41207-A', source: 'typed', why: null })
    expect(typedCount(f)).toBe(1)
    expect(guessCount(f)).toBe(2)
    expect(BILL_FIELD_KEYS).toHaveLength(10)
  })
})

describe('the function’s words', () => {
  it('follow the plain-words rules, since the form shows them', () => {
    for (const [key, words] of Object.entries(BILL_READ_WORDS)) expect(plainWordsFailures(words), key).toEqual([])
  })
})
