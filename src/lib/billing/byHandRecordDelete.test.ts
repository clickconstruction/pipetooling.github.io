import { describe, expect, it } from 'vitest'
import { BY_HAND_RECORD_DELETED, BY_HAND_RECORD_KIND, byHandRecordDeleteConfirm, byHandRecordDeleteDrawn, byHandRecordDeleteProblem, byHandRowDeleteProblem, type ByHandRecordRow } from './byHandRecordDelete'
import { BILLS_SENT_BY_HAND_KIND } from './billsSent'

const row = (over: Partial<ByHandRecordRow> = {}): ByHandRecordRow => ({
  kind: 'bill_by_hand',
  copyPath: null,
  sourceTable: 'jobs_ledger_invoices',
  bill: { id: 'b1', stripeMode: null },
  job: { job_name: 'ZZ Test walk job', customer_name: 'ZZ Test Customer' },
  ...over,
})

describe('byHandRecordDeleteDrawn', () => {
  it('draws the press for a dev on a by-hand record, and for nobody else', () => {
    expect(byHandRecordDeleteDrawn('dev', { route: 'by_hand' })).toBe(true)
    for (const role of ['master_technician', 'assistant', 'controller', 'estimator', 'primary', 'superintendent', 'subcontractor', 'helpers', '', null, undefined]) expect(byHandRecordDeleteDrawn(role, { route: 'by_hand' })).toBe(false)
  })
  it('draws it on no other send, for a dev either', () => {
    for (const route of ['email', 'text', 'printed', 'statement', 'housecall_pro', 'other']) expect(byHandRecordDeleteDrawn('dev', { route })).toBe(false)
  })
})

describe('byHandRecordDeleteProblem, from what the page holds', () => {
  it('lets a by-hand record of a test bill go on', () => {
    expect(byHandRecordDeleteProblem({ route: 'by_hand', test: true, billId: 'b1' })).toBe('')
  })
  it('refuses a record of a real bill', () => {
    expect(byHandRecordDeleteProblem({ route: 'by_hand', test: false, billId: 'b1' })).toBe('Only a record of a test bill can be deleted. This bill is a real one.')
  })
  it('refuses every send that is not a by-hand record, and a record that names no bill', () => {
    expect(byHandRecordDeleteProblem({ route: 'email', test: true, billId: 'b1' })).toBe('Only a record made by hand can be deleted.')
    expect(byHandRecordDeleteProblem({ route: 'by_hand', test: true, billId: null })).toBe('This record names no bill. It stays.')
  })
})

describe('byHandRowDeleteProblem, from what the database holds', () => {
  it('lets a by-hand record go when its job is a ZZ test job, or its bill was made in Stripe’s test mode', () => {
    expect(byHandRowDeleteProblem(row())).toBe('')
    expect(byHandRowDeleteProblem(row({ job: { job_name: 'Kitchen repipe', customer_name: 'ZZ Test Customer' } }))).toBe('')
    expect(byHandRowDeleteProblem(row({ bill: { id: 'b1', stripeMode: 'test' }, job: { job_name: 'Kitchen repipe', customer_name: 'Larkfield Homes' } }))).toBe('')
    expect(byHandRowDeleteProblem(row({ bill: { id: 'b1', stripeMode: 'test' }, job: null }))).toBe('')
  })
  it('refuses a record of a real bill, whatever the page said', () => {
    const real = { job_name: 'Kitchen repipe', customer_name: 'Larkfield Homes' }
    expect(byHandRowDeleteProblem(row({ job: real }))).toBe('Only a record of a test bill can be deleted. This bill is a real one.')
    expect(byHandRowDeleteProblem(row({ bill: { id: 'b1', stripeMode: 'live' }, job: real }))).toMatch(/real one/)
    // A job that did not read proves nothing: the bill is taken as real.
    expect(byHandRowDeleteProblem(row({ job: null }))).toMatch(/real one/)
  })
  it('refuses any kind but a by-hand record', () => {
    for (const kind of ['bill', 'bill_resent', 'bill_copy', 'gc_statement']) expect(byHandRowDeleteProblem(row({ kind }))).toBe('Only a record made by hand can be deleted.')
  })
  it('refuses a record that kept a copy', () => {
    expect(byHandRowDeleteProblem(row({ copyPath: 'aaaaaaaa-1111-4111-8111-111111111111/copy.html' }))).toBe('This record kept a copy. It stays.')
  })
  it('refuses when the bill did not read, or the record names another table', () => {
    expect(byHandRowDeleteProblem(row({ bill: null }))).toBe('The bill of this record could not be read. Nothing was deleted.')
    expect(byHandRowDeleteProblem(row({ sourceTable: 'gc_statements' }))).toBe('The bill of this record could not be read. Nothing was deleted.')
  })
  it('says a record that is gone is gone', () => {
    expect(byHandRowDeleteProblem(null)).toBe('The record is not there any more. Read the page again.')
  })
})

describe('the words', () => {
  it('names the act on the confirm button, never OK, and reads the record back', () => {
    const c = byHandRecordDeleteConfirm('Handed over by Priya', 'Mon, Nov 23')
    expect(c.confirmLabel).toBe('Delete the record')
    expect(c.title).toBe('Delete this record made by hand?')
    expect(c.message).toBe('Handed over by Priya, Mon, Nov 23. It is a record of a test bill. The record leaves the bill, and it cannot be brought back.')
    expect(byHandRecordDeleteConfirm('', '').message).toBe('It is a record of a test bill. The record leaves the bill, and it cannot be brought back.')
  })
  it('says what went', () => {
    expect(BY_HAND_RECORD_DELETED).toBe('The record was deleted.')
  })
  it('keeps its kind the page’s own', () => {
    expect(BY_HAND_RECORD_KIND).toBe(BILLS_SENT_BY_HAND_KIND)
  })
})
