import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { billChecks, checksToLook, duplicateCheck, statementCheck, sumCheck } from './billChecks'
import { readBillAnswer, type BillRead } from './billRead'

const FIXTURES = resolve(__dirname, '../../../test/fixtures/bills')
const readOf = (slug: string): BillRead => readBillAnswer(JSON.parse(readFileSync(resolve(FIXTURES, `${slug}.answer.json`), 'utf8'))!)!

const ROWS = [
  { id: 'inv-1', invoice_number: 'S1183420', amount: 952.28, document_kind: 'invoice', invoice_date: '2026-10-22' },
  { id: 'cr-1', invoice_number: 'CM-20880', amount: -40, document_kind: 'credit', invoice_date: '2026-10-20' },
]

describe('sumCheck', () => {
  it('the lines add to the total with the tax, to the cent', () => {
    expect(sumCheck(readOf('ridgeway-S1183420'))).toEqual({ kind: 'right', lineCount: 5, sumCents: 95228, totalCents: 95228, withTax: true })
    expect(sumCheck(readOf('ridgeway-CM-20991'))).toEqual({ kind: 'right', lineCount: 1, sumCents: 13899, totalCents: 13899, withTax: true })
  })
  it('or they do not: the transposed total is off by $36.00', () => {
    expect(sumCheck(readOf('ridgeway-S1183455-wrong-total'))).toEqual({ kind: 'off', lineCount: 7, sumCents: 124810, totalCents: 128410, withTax: true })
  })
  it('lines that already hold the tax, or a paper with no tax, are right on the lines alone', () => {
    expect(sumCheck({ lines: [{ description: 'a', quantity: 1, unitPriceCents: 100, extendedCents: 100 }, { description: 'b', quantity: 1, unitPriceCents: 250, extendedCents: 250 }], taxCents: 29, totalCents: 350 })).toMatchObject({ kind: 'right', withTax: false })
    expect(sumCheck({ lines: [{ description: 'a', quantity: 1, unitPriceCents: 100, extendedCents: 100 }], taxCents: null, totalCents: 100 })).toMatchObject({ kind: 'right', withTax: false })
  })
  it('has nothing to add up without lines or a total', () => {
    expect(sumCheck(readOf('ridgeway-statement-oct-2026'))).toEqual({ kind: 'none' })
    expect(sumCheck({ lines: [{ description: 'a', quantity: null, unitPriceCents: null, extendedCents: null }], taxCents: null, totalCents: 500 })).toEqual({ kind: 'none' })
    expect(sumCheck({ lines: [{ description: 'a', quantity: 1, unitPriceCents: 100, extendedCents: 100 }], taxCents: null, totalCents: null })).toEqual({ kind: 'none' })
  })
})

describe('duplicateCheck', () => {
  it('finds the same number on this house’s list, ignoring case, spaces and dashes', () => {
    expect(duplicateCheck('S1183420', ROWS)).toEqual({ invoiceId: 'inv-1', number: 'S1183420', dateYmd: '2026-10-22', amountCents: 95228 })
    expect(duplicateCheck('s-1183420', ROWS)?.invoiceId).toBe('inv-1')
    expect(duplicateCheck('cm 20880', ROWS)?.amountCents).toBe(4000)
  })
  it('is nothing for a new number, an empty one, or the row being edited', () => {
    expect(duplicateCheck('S1183421', ROWS)).toBeNull()
    expect(duplicateCheck('', ROWS)).toBeNull()
    expect(duplicateCheck('S1183420', ROWS, 'inv-1')).toBeNull()
  })
})

describe('statementCheck', () => {
  it('a statement lists its numbers; a bill does not', () => {
    expect(statementCheck(readOf('ridgeway-statement-oct-2026'))).toEqual({ numbers: ['S1183420', 'CM-20991', 'S1183455', 'S1184020'] })
    expect(statementCheck(readOf('ridgeway-S1183420'))).toBeNull()
    expect(statementCheck({ kind: 'invoice', statementNumbers: ['A', 'B'] })).toEqual({ numbers: ['A', 'B'] })
  })
})

describe('billChecks', () => {
  it('runs every check at once and counts the ones that ask for a look', () => {
    const clean = billChecks(readOf('ridgeway-S1183420'), { houseName: 'Ridgeway Supply', rows: [] })
    expect(clean).toEqual({ sum: { kind: 'right', lineCount: 5, sumCents: 95228, totalCents: 95228, withTax: true }, duplicate: null, statement: null, house: 'same' })
    expect(checksToLook(clean)).toBe(0)
    const twice = billChecks(readOf('ridgeway-S1183420'), { houseName: 'Ridgeway Supply', rows: ROWS })
    expect(twice.duplicate?.invoiceId).toBe('inv-1')
    expect(checksToLook(twice)).toBe(1)
    const other = billChecks(readOf('cedar-bend-CB-77102'), { houseName: 'Ridgeway Supply', rows: [] })
    expect(other.house).toBe('other')
    const off = billChecks(readOf('ridgeway-S1183455-wrong-total'), { houseName: 'Ridgeway Supply', rows: [] })
    expect(off.sum.kind).toBe('off')
    const statement = billChecks(readOf('ridgeway-statement-oct-2026'), { houseName: 'Ridgeway Supply', rows: [] })
    expect(checksToLook(statement)).toBe(1)
  })
})
