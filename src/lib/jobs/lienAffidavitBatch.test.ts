import { describe, expect, it } from 'vitest'
import { lienAffidavitPrintPlan, lienAffidavitPrintRun, lienAffidavitPrintWords, lienAffidavitSendOutcome, lienAffidavitSendPlan, lienAffidavitSendWords, lienAffidavitSubmitOutcome, type LienAffidavitSendContext } from './lienAffidavitBatch'
import type { LienAffidavitEntry } from './lienDeskAffidavits'
import type { LienDeskItemRow } from './lienDesk'
import type { LienAffidavitFields } from '../jobsDocuments/lienFilingDocuments'

const item = (status: string, short = true): LienDeskItemRow => ({ id: `item-${status}-${short}`, kind: 'affidavit', status, fields: short ? { affidavitForm: 'short' } : {}, voided_at: null }) as unknown as LienDeskItemRow
const entry = (jobId: string, pile: LienAffidavitEntry['pile'], it: LienDeskItemRow | null, gcCustomerId: string | null = 'gc-send') => ({ jobId, pile, item: it, deadline: '2026-11-16', gcCustomerId })

// gc-send has a standing "send" rule and a notice on record; gc-ask has none; gc-hold parks its papers.
const ctx: LienAffidavitSendContext = {
  policyFor: (gc) => (gc === 'gc-send' ? 'send' : gc === 'gc-hold' ? 'hold' : 'ask'),
  promiseYmdFor: (jobId) => (jobId === 'promised' ? '2026-11-14' : null),
  gcHasPriorNotice: (gc) => gc === 'gc-send' || gc === 'gc-ask',
  gcHeldBefore: () => false,
  todayYmd: '2026-11-10',
}

describe('send every drafted affidavit for approval (punch list #305, v2.6918)', () => {
  it('each paper goes where the pane’s own press would send it', () => {
    expect(lienAffidavitSubmitOutcome(entry('a', 'to_draft', item('drafted')), ctx)).toEqual({ status: 'approved', approval_mode: 'rule' })
    expect(lienAffidavitSubmitOutcome(entry('b', 'to_draft', item('drafted'), 'gc-ask'), ctx)).toEqual({ status: 'awaiting_approval', reason: 'no_rule' })
    // Contracted with the owner: no GC, so no rule and no notice before it.
    expect(lienAffidavitSubmitOutcome(entry('c', 'to_draft', item('drafted'), null), ctx)).toEqual({ status: 'awaiting_approval', reason: 'first_notice' })
    // A live promise asks the leader even under a send rule.
    expect(lienAffidavitSubmitOutcome(entry('promised', 'to_draft', item('drafted')), ctx)).toEqual({ status: 'awaiting_approval', reason: 'promise_live' })
    expect(lienAffidavitSubmitOutcome(entry('d', 'to_draft', item('drafted'), 'gc-hold'), ctx).status).toBe('held')
  })

  it('acts on a draft a person made in To draft, and leaves a paper nobody drafted', () => {
    const entries = [
      entry('redrawn-1', 'to_draft', item('drafted')),
      entry('redrawn-2', 'to_draft', item('drafted'), 'gc-ask'),
      entry('never-drafted', 'to_draft', null, null),
      entry('needs-property', 'needs_property', item('drafted')),
      entry('waiting', 'awaiting', item('awaiting_approval')),
      entry('ready', 'ready', item('approved')),
    ]
    const plan = lienAffidavitSendPlan(entries, ctx)
    expect(plan.ready.map((r) => [r.entry.jobId, r.outcome.status])).toEqual([['redrawn-1', 'approved'], ['redrawn-2', 'awaiting_approval']])
    expect(plan.held.map((e) => e.jobId)).toEqual(['never-drafted'])
  })

  it('the button says its count, and the window says where each paper goes', () => {
    const plan = lienAffidavitSendPlan(
      [...Array.from({ length: 10 }, (_, i) => entry(`s${i}`, 'to_draft', item('drafted'))), entry('ask-1', 'to_draft', item('drafted'), 'gc-ask'), entry('own', 'to_draft', item('drafted'), null), entry('hold', 'to_draft', item('drafted'), 'gc-hold'), entry('new', 'to_draft', null, null)],
      ctx,
    )
    expect(lienAffidavitSendWords(plan)).toEqual({
      lead: '13 drafted affidavits are ready to send.',
      button: 'Send 13 for approval…',
      title: 'Send 13 affidavits for approval?',
      message: '10 are approved at once by a GC’s standing rule and move to Ready to file. 2 go to the leader for approval. 1 is held by its GC’s standing rule.',
      confirmLabel: 'Send 13 for approval',
      foot: '1 in To draft has no draft yet. Draft it from its own paper.',
      dead: false,
    })
  })

  it('one paper reads in the singular, and nothing ready is a dead press', () => {
    const one = lienAffidavitSendWords(lienAffidavitSendPlan([entry('a', 'to_draft', item('drafted'))], ctx))
    expect(one.lead).toBe('1 drafted affidavit is ready to send.')
    expect(one.button).toBe('Send 1 for approval…')
    expect(one.title).toBe('Send 1 affidavit for approval?')
    expect(one.message).toBe('1 is approved at once by its GC’s standing rule and moves to Ready to file.')
    expect(one.foot).toBeNull()
    expect(lienAffidavitSendWords({ ready: [], held: [] }).dead).toBe(true)
  })

  it('a paper that did not take is counted and stays with its reason', () => {
    expect(lienAffidavitSendOutcome(12, 0)).toEqual({ line: 'Sent 12 affidavits.', head: null, tone: 'success' })
    expect(lienAffidavitSendOutcome(11, 1).line).toBe('Sent 11 affidavits. 1 did not send.')
    expect(lienAffidavitSendOutcome(11, 1).head).toBe('1 affidavit did not send. It stays here with the reason.')
  })
})

describe('print every ready affidavit for the notary (punch list #305, v2.6918)', () => {
  it('prints the short-form papers in Ready to file and leaves the earlier form out', () => {
    const plan = lienAffidavitPrintPlan([entry('short-1', 'ready', item('approved')), entry('short-2', 'ready', item('approved')), entry('earlier', 'ready', item('approved', false)), entry('draft', 'to_draft', item('drafted')), entry('filed', 'filed', item('sent'))])
    expect(plan.ready.map((e) => e.jobId)).toEqual(['short-1', 'short-2'])
    expect(plan.held.map((e) => e.jobId)).toEqual(['earlier'])
    expect(lienAffidavitPrintWords(plan)).toEqual({
      lead: '2 affidavits on the short form are ready to file.',
      button: 'Print 2 for notarization',
      foot: '1 ready affidavit is on the earlier form and is left out. Redraw it, or print it from its own Lien window.',
      dead: false,
    })
    expect(lienAffidavitPrintWords({ ready: [], held: plan.held }).dead).toBe(true)
  })

  const fields = (propertyAddress: string): LienAffidavitFields => ({ county: 'Bexar', claimantPersonName: 'Rey Master, Master Plumber', claimantCompany: 'Sample Plumbing LLC', claimantAddress: '1 Shop Rd, San Antonio, TX 78201', legalDescription: 'CB 1 BLK B LOT 7', propertyAddress, contractedWithName: 'Harborline Builders', workDescription: 'Plumbing labor and materials', workStart: '', workEnd: '', ownerName: 'Pat Owner', ownerAddress: '4 Owner Ct, San Antonio, TX 78209', originalContractorName: 'Harborline Builders', originalContractorAddress: '9 Yard St, Devine TX 78016', contractAmount: '5000.00', paidAmount: '0.00', unpaidAmount: '2000.00', includeNoticesSworn: true, form: 'short', isSub: true, workMonthsWords: 'July and August 2026', noticesSentWords: 'certified mail on September 14, 2026' })

  it('one document with each paper on its own sheet, and each job’s own copy to file', () => {
    const run = lienAffidavitPrintRun([
      { jobId: 'job-1', jobNumber: 'J700', fields: fields('12 Sample Rd, San Antonio, TX 78209') },
      { jobId: 'job-2', jobNumber: 'J701', fields: fields('14 Other Ln, San Antonio, TX 78209') },
    ])
    expect(run.html).toContain('<title>Lien affidavits · 2</title>')
    // Two papers, the second starting a sheet, each on the short form's tight sheet with its own keep-together closing.
    expect(run.html.match(/<div class="filing-paper[^"]*"/g)).toEqual(['<div class="filing-paper filing-tight"', '<div class="filing-paper filing-next-paper filing-tight"'])
    expect(run.html).toContain('.filing-next-paper { break-before: page; page-break-before: always;')
    expect(run.html).toContain('.filing-tight { line-height: 1.45; }')
    expect(run.html.match(/<div class="filing-keep">/g)).toHaveLength(2)
    expect(run.html.indexOf('12 Sample Rd')).toBeLessThan(run.html.indexOf('14 Other Ln'))
    // Each job files its own paper alone, under the kind and title the Lien window's print files.
    expect(run.copies.map((c) => c.filing)).toEqual([
      { kind: 'lien_affidavit', title: 'Lien Affidavit — Job J700', jobIds: ['job-1'] },
      { kind: 'lien_affidavit', title: 'Lien Affidavit — Job J701', jobIds: ['job-2'] },
    ])
    expect(run.copies[0]!.html).toContain('12 Sample Rd')
    expect(run.copies[0]!.html).not.toContain('14 Other Ln')
    expect(run.copies[0]!.html).toContain('line-height: 1.45;')
  })

  it('one paper is titled in the singular and starts no extra sheet', () => {
    const run = lienAffidavitPrintRun([{ jobId: 'job-1', jobNumber: 'J700', fields: fields('12 Sample Rd') }])
    expect(run.html).toContain('<title>Lien affidavit</title>')
    expect(run.html).not.toContain('class="filing-paper filing-next-paper')
  })
})
