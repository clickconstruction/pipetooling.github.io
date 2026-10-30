import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import type { PoLedgerEntriesByCode } from '../supplyHouseInvoiceForm'
import { amountDigits, applyPlan, billTint, emptyFields, fillCounts, planBillFill, settle, type BillFillContext } from './billFill'
import { readBillAnswer, type BillRead } from './billRead'

const FIXTURES = resolve(__dirname, '../../../test/fixtures/bills')
const readOf = (slug: string): BillRead => readBillAnswer(JSON.parse(readFileSync(resolve(FIXTURES, `${slug}.answer.json`), 'utf8')))!

const LEDGER: PoLedgerEntriesByCode = new Map([[41207, { code: 41207, jobLabel: 'J1042 · Oakmont Dental build-out', jobLedgerId: 'job-1042', personName: 'Todd', createdAt: '2026-10-21T15:00:00Z', createdBy: 'Marisol', statedNeed: null }]])
const ctx = (over: Partial<BillFillContext> = {}): BillFillContext => ({
  houseName: 'Ridgeway Supply',
  paymentDay: 10,
  ledger: LEDGER,
  accounts: [{ jobId: 'job-1042', accountRef: 'CLICK PLUMBING', status: 'open' }],
  jobs: [{ id: 'job-1042', label: 'J1042', name: 'Oakmont Dental build-out', address: '418 Cedar Bend Dr' }],
  rows: [{ id: 'inv-1', invoice_number: 'S1183420', amount: 952.28, document_kind: 'invoice', invoice_date: '2026-10-22' }],
  todayYmd: '2026-10-29',
  linkUrl: 'https://clicktooling.com/files/messages/att-1',
  ...over,
})

describe('planBillFill', () => {
  it("the card's bill: the paper's fields green, the job and the tick amber, the due date from Net 30", () => {
    const plan = planBillFill(readOf('ridgeway-S1183420'), ctx({ rows: [] }))
    expect(plan).toMatchObject({ kind: 'invoice', number: 'S1183420', dateYmd: '2026-10-22', amountTyped: '952.28', purchaseOrder: '41207', dueYmd: '2026-11-21', onJobAccount: true, creditsInvoiceId: '' })
    expect(plan.job).toEqual({ jobId: 'job-1042', evidence: ['code', 'account', 'shipTo', 'jobText'], code: 41207 })
    expect(plan.fields.number).toEqual({ value: 'S1183420', source: 'read', why: null })
    expect(plan.fields.job.source).toBe('guessed')
    expect(plan.fields.onJobAccount).toEqual({ value: 'true', source: 'guessed', why: 'the account is open' })
    expect(plan.fields.dueDate.source).toBe('read')
    expect(plan.fields.link).toEqual({ value: 'https://clicktooling.com/files/messages/att-1', source: 'read', why: null })
    expect(plan.checks.sum.kind).toBe('right')
    expect(fillCounts(plan.fields, plan.checks)).toEqual({ checks: 2, yours: 1, typed: 0 })
  })
  it('the credit memo: a credit, paired to the invoice it names, with no due date', () => {
    const plan = planBillFill(readOf('ridgeway-CM-20991'), ctx())
    expect(plan).toMatchObject({ kind: 'credit', number: 'CM-20991', amountTyped: '138.99', dueYmd: '', creditsInvoiceId: 'inv-1' })
    expect(plan.pair?.label).toBe('S1183420 · $952.28 · Oct 22, 2026')
    expect(plan.fields.creditsInvoice.source).toBe('guessed')
    expect(plan.fields.dueDate.source).toBe('none')
  })
  it('a duplicate number and a wrong total count as things to check; a job nobody can place is yours to set', () => {
    const twice = planBillFill(readOf('ridgeway-S1183420'), ctx())
    expect(twice.checks.duplicate?.invoiceId).toBe('inv-1')
    expect(fillCounts(twice.fields, twice.checks).checks).toBe(3)
    const off = planBillFill(readOf('ridgeway-S1183455-wrong-total'), ctx({ ledger: null, accounts: [], jobs: [], rows: [] }))
    expect(off.checks.sum.kind).toBe('off')
    expect(off.job).toBeNull()
    expect(off.fields.job.source).toBe('none')
    expect(off.fields.onJobAccount).toEqual({ value: 'false', source: 'none', why: null })
    expect(fillCounts(off.fields, off.checks)).toEqual({ checks: 1, yours: 2, typed: 0 })
  })
  it('a statement starts as an invoice the paper did not call one', () => {
    const plan = planBillFill(readOf('ridgeway-statement-oct-2026'), ctx({ rows: [] }))
    expect(plan.fields.kind).toEqual({ value: 'invoice', source: 'none', why: null })
    expect(plan.checks.statement?.numbers).toHaveLength(4)
  })
  it('a paper with no terms takes the house day as a plain default, yours to set', () => {
    const plan = planBillFill({ ...readOf('ridgeway-S1183420'), terms: '' }, ctx({ rows: [] }))
    expect(plan.due).toEqual({ ymd: '2026-11-10', from: 'house', days: null })
    expect(plan.fields.dueDate).toEqual({ value: '2026-11-10', source: 'none', why: null })
  })
  it('a bill from another house marks the house check', () => {
    expect(planBillFill(readOf('cedar-bend-CB-77102'), ctx({ rows: [] })).checks.house).toBe('other')
  })
})

describe('applyPlan, settle, the looks', () => {
  it('a re-pick keeps every field the person typed', () => {
    const first = planBillFill(readOf('ridgeway-S1183420'), ctx({ rows: [] }))
    const typedOver = settle(first.fields, 'purchaseOrder', '41207-A')
    const second = planBillFill(readOf('ridgeway-CM-20991'), ctx())
    const merged = applyPlan(typedOver, second, new Set(['purchaseOrder']))
    expect(merged.purchaseOrder).toEqual({ value: '41207-A', source: 'typed', why: null })
    expect(merged.number.value).toBe('CM-20991')
    expect(fillCounts(merged, second.checks).typed).toBe(1)
  })
  it('a confirmed guess is theirs from then on, so the count falls', () => {
    const plan = planBillFill(readOf('ridgeway-S1183420'), ctx({ rows: [] }))
    const yes = settle(plan.fields, 'job', 'job-1042')
    expect(fillCounts(yes, plan.checks).checks).toBe(1)
  })
  it('the three looks, and nothing at all with no PDF', () => {
    expect(billTint('read')).toEqual({ background: 'var(--bg-green-tint)', borderLeft: '3px solid var(--border-green)' })
    expect(billTint('guessed').borderLeft).toContain('amber')
    expect(billTint('typed')).toEqual({})
    expect(billTint('none')).toEqual({})
    expect(billTint(undefined)).toEqual({})
    expect(Object.values(emptyFields()).every((f) => f.source === 'none')).toBe(true)
    expect(amountDigits(95228)).toBe('952.28')
    expect(amountDigits(500)).toBe('5.00')
    expect(amountDigits(null)).toBe('')
  })
})
