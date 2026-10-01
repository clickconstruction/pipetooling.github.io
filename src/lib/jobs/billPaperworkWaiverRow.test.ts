import { describe, expect, it } from 'vitest'
import { billPaperworkWaiverRow, waiverMoneyWords, type BillPaperworkWaiverInput } from './billPaperworkWaiverRow'
import { lienWaiverCellForBill } from './lienWaiverCell'
import type { JobLienReleaseRow } from './lienReleaseTracking'
import type { LienWaiverBillPick } from '../jobsDocuments/lienWaiverRelease'

function rel(over: Partial<JobLienReleaseRow> & { id: string; form_type: string }): JobLienReleaseRow {
  return {
    amount: 4720,
    created_at: '2026-10-01T15:00:00Z',
    fields: { signerName: 'Malachi Whites' },
    invoice_ids: ['inv'],
    job_id: 'j',
    minted_at: null,
    sent_to_customer_at: null,
    signature_requested_at: null,
    signed_at: null,
    status: 'draft',
    voided_at: null,
    ...over,
  } as JobLienReleaseRow
}

const PICK: LienWaiverBillPick = { formType: 'conditional_progress', settled: false, final: false, facts: ['Not settled yet', 'Bill 3 of 3 · not the last'] }

function input(releases: JobLienReleaseRow[], over: Partial<BillPaperworkWaiverInput> = {}, settled = false): BillPaperworkWaiverInput {
  return {
    cell: lienWaiverCellForBill(releases, 'inv', settled),
    pick: PICK,
    amount: 4720,
    isGc: true,
    recipientName: 'Michael Palmer',
    recipientEmail: 'ap@palmer.test',
    billEmail: 'palmercustomhomes@gmail.com',
    daysPastDue: null,
    paidYmd: null,
    ...over,
  }
}

const SENTENCE_RULES = /[—–;()]/

describe('billPaperworkWaiverRow (v2.4299)', () => {
  it('job 251 today: nothing started, past due, a GC with no email — the row says the stake and offers the bill’s email', () => {
    const row = billPaperworkWaiverRow(input([], { recipientEmail: null, daysPastDue: 35 }))
    expect(row).toMatchObject({
      tone: 'amber',
      headline: 'Conditional for $4,720 not sent',
      sub: 'This bill is 35 days past due. A GC often waits for this waiver before it pays.',
      subTone: 'amber',
      action: { kind: 'add', label: 'Add waiver', primary: true },
      emailFix: { email: 'palmercustomhomes@gmail.com' },
    })
    expect(row.steps).toEqual([
      { text: 'Conditional, with this bill', state: 'due' },
      { text: 'Unconditional, when paid', state: 'open' },
    ])
  })

  it('a final bill says final; a homeowner job leaves out the GC line and never offers an email fix', () => {
    const final = billPaperworkWaiverRow(input([], { pick: { ...PICK, formType: 'conditional_final', final: true } }))
    expect(final.headline).toBe('Conditional final for $4,720 not sent')
    const direct = billPaperworkWaiverRow(input([], { isGc: false, recipientEmail: null, daysPastDue: 3 }))
    expect(direct.sub).toBe('This bill is 3 days past due.')
    expect(direct.emailFix).toBeNull()
    expect(billPaperworkWaiverRow(input([], { isGc: false })).sub).toBeNull()
  })

  it('awaiting: names the leader from the snapshot and the day asked; signed: who to send to and where', () => {
    const awaiting = billPaperworkWaiverRow(input([rel({ id: 'a', form_type: 'conditional_progress', status: 'awaiting_signature', signature_requested_at: '2026-10-01T16:00:00Z' })]))
    expect(awaiting).toMatchObject({ headline: 'Waiting for Malachi to sign', sub: 'Asked Oct 1. It waits on the Dashboard under Waivers to sign.', action: { kind: 'sign', label: 'Sign it' } })
    expect(awaiting.steps[0]).toEqual({ text: 'Conditional, signing', state: 'due' })
    const signed = billPaperworkWaiverRow(input([rel({ id: 's', form_type: 'conditional_progress', status: 'signed', signed_at: '2026-10-01T17:00:00Z' })]))
    expect(signed).toMatchObject({ headline: 'Signed by Malachi. Not sent yet.', sub: 'It goes to ap@palmer.test.', action: { kind: 'send', label: 'Send to Michael Palmer', primary: true } })
  })

  it('the signer is who drew it, not an older snapshot of the signed-in user (job 650)', () => {
    const row = billPaperworkWaiverRow(input([rel({ id: 's', form_type: 'conditional_final', status: 'signed', signed_at: '2026-10-01T02:19:10Z', signer_printed_name: 'Malachi Whites', fields: { signerName: 'Robert' } })]))
    expect(row.headline).toBe('Signed by Malachi. Not sent yet.')
  })

  it('sent and open: plain, nothing to do; paid: the unconditional is owed; both sent: green and the email fix goes away', () => {
    const sentRow = rel({ id: 'c', form_type: 'conditional_progress', status: 'signed', signed_at: '2026-10-01T17:00:00Z', sent_to_customer_at: '2026-10-01T17:05:00Z' })
    const open = billPaperworkWaiverRow(input([sentRow]))
    expect(open).toMatchObject({ tone: 'plain', headline: 'Conditional for $4,720 sent Oct 1', sub: 'Nothing to do until the bill is paid.', action: { kind: 'view', primary: false } })
    const paid = billPaperworkWaiverRow(input([sentRow], { paidYmd: '2026-10-03' }, true))
    expect(paid).toMatchObject({ tone: 'amber', headline: 'Paid Oct 3. Unconditional owed.', action: { kind: 'add_unconditional', label: 'Add the unconditional' } })
    expect(paid.steps).toEqual([
      { text: 'Conditional sent', state: 'done' },
      { text: 'Unconditional, now', state: 'due' },
    ])
    const uncond = rel({ id: 'u', form_type: 'unconditional_progress', status: 'signed', signed_at: '2026-10-04T17:00:00Z', sent_to_customer_at: '2026-10-04T17:05:00Z' })
    const done = billPaperworkWaiverRow(input([sentRow, uncond], { recipientEmail: null }, true))
    expect(done).toMatchObject({ tone: 'green', headline: 'Both waivers sent', sub: 'Conditional Oct 1. Unconditional Oct 4.', emailFix: null })
  })

  it('a draft left open is owed work, not done', () => {
    const row = billPaperworkWaiverRow(input([rel({ id: 'd', form_type: 'conditional_progress', status: 'draft' })]))
    expect(row).toMatchObject({ tone: 'amber', headline: 'Conditional draft started', action: { kind: 'open_draft', primary: true } })
  })

  it('past due is not said once the bill is settled; every sentence keeps the plain-words marks out', () => {
    const settled = billPaperworkWaiverRow(input([], { daysPastDue: 10 }, true))
    expect(settled.sub).not.toContain('past due')
    const all = [
      billPaperworkWaiverRow(input([], { recipientEmail: null, daysPastDue: 35 })),
      billPaperworkWaiverRow(input([rel({ id: 'a', form_type: 'conditional_progress', status: 'awaiting_signature', signature_requested_at: '2026-10-01T16:00:00Z' })])),
      settled,
    ]
    for (const r of all) {
      expect(r.headline).not.toMatch(SENTENCE_RULES)
      expect(r.sub ?? '').not.toMatch(SENTENCE_RULES)
    }
  })

  it('money words drop the cents only when there are none', () => {
    expect(waiverMoneyWords(4720)).toBe('$4,720')
    expect(waiverMoneyWords(18200.5)).toBe('$18,200.50')
  })
})
