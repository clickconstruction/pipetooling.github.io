// @vitest-environment jsdom
/**
 * The case pane's new-check line (v2.4325): the deposit that looks like the new check is dated
 * the day it posted on the company's calendar (v2.4463), not the UTC date of posted_at.
 * A card dispute (v2.4950): the link to it in Stripe, and a lost one's Put the bill back, read back first.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { ArReturnCasePane } from './ArReturnCasePane'
import { arReturnCaseView, type ArReturnCaseRow } from '../../../lib/jobs/arReturnCase'
import { arCaseFeeOffer, AR_RETURNED_CHECK_FEE_STATUTE, type ArCaseFeeRow } from '../../../lib/jobs/arReturnCaseFee'
import { payoffReturnedView, type PayoffReturnedInput } from '../../../lib/jobs/payoffReturned'
import type { ReturnedCaseLiens } from '../../../hooks/useReturnedCaseLiens'

const TODAY = '2026-10-05'

const row: ArReturnCaseRow = {
  mercury_transaction_id: 'tx-sp',
  counterparty_name: 'Southern Pine',
  amount: '13680',
  kind: 'checkDeposit',
  posted_at: '2026-09-18T22:00:58Z',
  failed_at: '2026-09-23T15:00:00Z',
  bank_reason: 'Insufficient funds',
  source: 'bank',
  opened_at: '2026-09-23T15:00:00Z',
  closed_at: null,
  closed_reason: null,
  closed_note: null,
  closed_by: null,
  replaced_by_mercury_transaction_id: null,
  notified_at: null,
  live_payments: [],
  last_job: null,
  recorded_payment: null,
  promise: null,
}

const noop = () => {}

afterEach(cleanup)

describe('ArReturnCasePane — the new check', () => {
  it('a deposit posted in a Central evening reads that day', () => {
    render(
      <ArReturnCasePane
        view={arReturnCaseView({ row, trail: [], todayYmd: TODAY })}
        todayYmd={TODAY}
        canApply
        // Posted 7:30 pm CDT on Oct 2, as PostgREST returns it.
        replacement={{ mercury_transaction_id: 'tx-new', counterparty_name: 'Southern Pine', amount: 13680, posted_at: '2026-10-03T00:30:00+00:00', remaining_available: 13680 }}
        busy={null}
        error={null}
        onTakeOff={noop}
        onTheySaid={noop}
        onUseReplacement={noop}
        onClose={noop}
        onTakeRecordedOff={noop}
        onNotBounced={noop}
      />,
    )
    expect(screen.getByTestId('ar-return-case-replacement').textContent).toContain('This looks like the new check. Southern Pine · $13,680 · Oct 2.')
  })
})

describe('ArReturnCasePane — a card dispute on a Stripe bill (v2.4950)', () => {
  const disputeRow = (lostAt: string | null): ArReturnCaseRow => ({
    ...row,
    mercury_transaction_id: 'case-dp1',
    counterparty_name: 'Hadlow Construction',
    amount: 500,
    kind: 'card',
    posted_at: null,
    failed_at: '2026-09-28T15:00:00Z',
    bank_reason: 'fraudulent',
    source: 'stripe_dispute',
    recorded_payment: { payment_id: 'pay-1', job_id: 'job-878', job_number: '878', job_name: 'Tune 5- Seguin', amount: 500, paid_on: '2026-09-24' },
    stripe_case: {
      kind: 'dispute',
      object_id: 'dp_1',
      mode: 'test',
      status: lostAt ? 'lost' : 'needs_response',
      due_by: '2026-10-09T05:00:00Z',
      lost_at: lostAt,
      lost_notified_at: null,
      amount: 500,
      invoice_id: 'inv-1',
      invoice_sequence_order: 0,
      invoice_status: 'paid',
      job_id: 'job-878',
      job_number: '878',
      job_name: 'Tune 5- Seguin',
      payment_live: true,
    },
  })
  const pane = (r: ArReturnCaseRow, onPutBack = noop) =>
    render(
      <ArReturnCasePane
        view={arReturnCaseView({ row: r, trail: [], todayYmd: TODAY })}
        todayYmd={TODAY}
        canApply
        replacement={null}
        busy={null}
        error={null}
        onTakeOff={noop}
        onTheySaid={noop}
        onUseReplacement={noop}
        onClose={noop}
        onTakeRecordedOff={noop}
        onNotBounced={noop}
        onPutBack={onPutBack}
      />,
    )

  it('open: answer it in Stripe, the link opens the dispute, They said… is there, nothing comes off', () => {
    pane(disputeRow(null))
    expect(screen.getByTestId('ar-return-case-next-sentence').textContent).toBe('Answer the dispute in Stripe by Oct 9.')
    const link = screen.getByTestId('ar-return-case-stripe') as HTMLAnchorElement
    expect(link.href).toBe('https://dashboard.stripe.com/test/disputes/dp_1')
    expect(link.target).toBe('_blank')
    expect(screen.getByTestId('ar-return-case-they-said')).toBeTruthy()
    expect(screen.queryByTestId('ar-return-case-takeoff')).toBeNull()
    expect(screen.queryByTestId('ar-return-case-putback')).toBeNull()
    expect(screen.getByText('The case closes when Stripe decides for us, when the bill is put back, or under More.')).toBeTruthy()
  })

  it('lost: Put the bill back reads back what changes, then presses once', () => {
    const onPutBack = vi.fn()
    pane(disputeRow('2026-10-02T15:00:00Z'), onPutBack)
    expect(screen.getByTestId('ar-return-case-next-sentence').textContent).toBe('The money is gone. Put the bill back, then bill Hadlow Construction again.')
    fireEvent.click(screen.getByTestId('ar-return-case-putback'))
    const readback = screen.getByTestId('ar-return-case-putback-readback')
    expect(readback.textContent).toContain('$500 comes off bill 1 on #878.')
    expect(readback.textContent).toContain('#878 owes the $500 again.')
    expect(onPutBack).not.toHaveBeenCalled()
    fireEvent.click(screen.getByTestId('ar-return-case-putback-confirm'))
    expect(onPutBack).toHaveBeenCalledTimes(1)
  })
})

describe('ArReturnCasePane — the returned-check fee (v2.5033)', () => {
  const view = arReturnCaseView({ row, trail: [], todayYmd: TODAY })
  const feeRow = (over: Partial<ArCaseFeeRow> = {}): ArCaseFeeRow => ({
    case_id: 'tx-sp', fee_amount: null, fee_invoice_id: null, fee_added_at: null, fee_added_by: null,
    bills: [{ invoice_id: 'b1', job_id: 'j878', sequence_order: 0, status: 'billed', stripe: false, job_number: '878', job_name: 'Tune 5- Seguin' }],
    ...over,
  })
  const pane = (over: Partial<Parameters<typeof ArReturnCasePane>[0]> = {}) =>
    render(<ArReturnCasePane view={view} todayYmd={TODAY} canApply replacement={null} busy={null} error={null} onTakeOff={noop} onTheySaid={noop} onUseReplacement={noop} onClose={noop} onTakeRecordedOff={noop} onNotBounced={noop} {...over} />)

  it('one press adds the fee to the bill the check paid; the line names the $30 and the statute is on the hover', () => {
    const onAddFee = vi.fn()
    pane({ fee: arCaseFeeOffer(view, feeRow()), onAddFee })
    const line = screen.getByTestId('ar-return-case-fee-line')
    expect(line.textContent).toBe('$30 — the most Texas allows, Bus. & Com. Code § 3.506')
    expect(line.getAttribute('title')).toBe(AR_RETURNED_CHECK_FEE_STATUTE)
    fireEvent.click(screen.getByRole('button', { name: 'Add the $30 fee to bill 1' }))
    expect(onAddFee).toHaveBeenCalledTimes(1)
  })

  it('while it goes it says so and takes no second press', () => {
    pane({ fee: arCaseFeeOffer(view, feeRow()), onAddFee: vi.fn(), busy: 'fee' })
    const press = screen.getByTestId('ar-return-case-fee-add') as HTMLButtonElement
    expect(press.textContent).toBe('Adding the fee…')
    expect(press.disabled).toBe(true)
  })

  it('once the fee is on, the case says where and who, with no button', () => {
    pane({ fee: arCaseFeeOffer(view, feeRow({ fee_amount: 30, fee_invoice_id: 'b1', fee_added_at: '2026-10-09T15:00:00Z', fee_added_by: 'Taunya' })), onAddFee: vi.fn() })
    expect(screen.getByTestId('ar-return-case-fee-words').textContent).toBe('The $30 fee is on bill 1, added Oct 9 by Taunya.')
    expect(screen.queryByTestId('ar-return-case-fee-add')).toBeNull()
  })

  it('a check that paid only a Stripe bill says why there is no press', () => {
    pane({ fee: arCaseFeeOffer(view, feeRow({ bills: [{ invoice_id: 'b2', job_id: 'j878', sequence_order: 1, status: 'billed', stripe: true, job_number: '878', job_name: null }] })), onAddFee: vi.fn() })
    expect(screen.getByTestId('ar-return-case-fee-words').textContent).toBe('Bill 2 is a Stripe invoice, and a sent Stripe invoice cannot take a line.')
    expect(screen.queryByTestId('ar-return-case-fee-add')).toBeNull()
  })

  it('a fee that came off with its bill says so above the press, which adds it again (v2.5144)', () => {
    const onAddFee = vi.fn()
    pane({ fee: arCaseFeeOffer(view, feeRow({ fee_came_off_at: '2026-10-10T15:00:00Z' })), onAddFee })
    expect(screen.getByTestId('ar-return-case-fee-note').textContent).toBe('The $30 fee came off with its bill on Oct 10. Add it again.')
    fireEvent.click(screen.getByRole('button', { name: 'Add the $30 fee to bill 1' }))
    expect(onAddFee).toHaveBeenCalledTimes(1)
    cleanup()
    pane({ fee: arCaseFeeOffer(view, feeRow()), onAddFee })
    expect(screen.queryByTestId('ar-return-case-fee-note')).toBeNull()
  })

  it('someone who cannot apply reads the line and gets no press; with no fee read there is no box', () => {
    pane({ fee: arCaseFeeOffer(view, feeRow()), onAddFee: vi.fn(), canApply: false })
    expect(screen.getByTestId('ar-return-case-fee-line')).toBeTruthy()
    expect(screen.queryByTestId('ar-return-case-fee-add')).toBeNull()
    cleanup()
    pane({ fee: null })
    expect(screen.queryByTestId('ar-return-case-fee')).toBeNull()
  })
})

describe('ArReturnCasePane — the new check inside a bigger payment (v2.5891)', () => {
  const TODAY26 = '2026-10-26'
  const waitingRow: ArReturnCaseRow = {
    ...row,
    last_job: { job_id: 'job-878', job_number: '878', job_name: 'Tune 5- Seguin', removed_at: '2026-09-24T13:43:00Z', removed_by: 'Taunya', job_revenue: 38625, job_payments_made: 34200 },
  }
  const combined = {
    deposit: { mercury_transaction_id: 'tx-big', counterparty_name: 'SOUTHERN PINE CO', amount: 34825, posted_at: '2026-10-26T14:51:00Z', remaining_available: 625 },
    appliedToCaseJobs: 34200,
    jobLabels: ['#878 Tune 5- Seguin'],
    appliedBy: 'Taunya',
    appliedYmd: '2026-10-26',
  }
  const feeRow: ArCaseFeeRow = {
    case_id: 'tx-sp', fee_amount: null, fee_invoice_id: null, fee_added_at: null, fee_added_by: null,
    bills: [{ invoice_id: 'b1', job_id: 'job-878', sequence_order: 0, status: 'billed', stripe: false, job_number: '878', job_name: 'Tune 5- Seguin' }],
  }
  const view = () => arReturnCaseView({ row: waitingRow, trail: [], todayYmd: TODAY26 })
  const pane = (over: Partial<Parameters<typeof ArReturnCasePane>[0]> = {}) =>
    render(
      <ArReturnCasePane view={view()} todayYmd={TODAY26} canApply replacement={null} combined={combined} onMadeGood={noop} busy={null} error={null} onTakeOff={noop} onTheySaid={noop} onUseReplacement={noop} onClose={noop} onTakeRecordedOff={noop} onNotBounced={noop} {...over} />,
    )

  it('the banner names the payment, the evidence and who put it there; the stale waiting words step aside', () => {
    pane()
    const banner = screen.getByTestId('ar-return-case-combined')
    expect(banner.textContent).toContain('The new check looks like it came inside this payment.')
    expect(banner.textContent).toContain('SOUTHERN PINE CO · $34,825 · Oct 26.')
    expect(banner.textContent).toContain('$34,200 of it went on #878 Tune 5- Seguin today, by Taunya. That covers the $13,680 that bounced.')
    expect(screen.getByTestId('ar-return-case-next-sentence').textContent).toBe('The money looks in. Read it back and close the case.')
    expect(screen.queryByText(/money lands, it shows here/)).toBeNull()
    expect(screen.queryByTestId('ar-return-case-they-said')).toBeNull()
  })

  it('the press reads back what changes, says the fee is undecided, and closes only on the second press', () => {
    const onMadeGood = vi.fn()
    pane({ onMadeGood, fee: arCaseFeeOffer(view(), feeRow) })
    fireEvent.click(screen.getByTestId('ar-return-case-madegood'))
    const readback = screen.getByTestId('ar-return-case-madegood-readback')
    expect(readback.textContent).toContain('The case closes as replaced, naming the $34,825 payment of Oct 26.')
    expect(readback.textContent).toContain('Nothing moves on #878 Tune 5- Seguin. The $34,200 stays where Taunya put it.')
    expect(screen.getByTestId('ar-return-case-madegood-fee').textContent).toBe('The $30 returned check fee is not on a bill. Add it below first, or close without it.')
    expect(onMadeGood).not.toHaveBeenCalled()
    fireEvent.click(screen.getByTestId('ar-return-case-madegood-confirm'))
    expect(onMadeGood).toHaveBeenCalledTimes(1)
  })

  it('a fee already on its bill reads so in the read-back', () => {
    pane({ fee: arCaseFeeOffer(view(), { ...feeRow, fee_amount: 30, fee_invoice_id: 'b1', fee_added_at: '2026-10-26T15:00:00Z', fee_added_by: 'Taunya' }) })
    fireEvent.click(screen.getByTestId('ar-return-case-madegood'))
    expect(screen.getByTestId('ar-return-case-madegood-fee').textContent).toBe('The $30 fee is on its bill already.')
  })

  it('the exact match wins, and someone who cannot apply gets no banner', () => {
    pane({ replacement: { mercury_transaction_id: 'tx-new', counterparty_name: 'Southern Pine', amount: 13680, posted_at: '2026-10-26T15:00:00Z', remaining_available: 13680 } })
    expect(screen.queryByTestId('ar-return-case-combined')).toBeNull()
    expect(screen.getByTestId('ar-return-case-replacement')).toBeTruthy()
    cleanup()
    pane({ canApply: false })
    expect(screen.queryByTestId('ar-return-case-combined')).toBeNull()
  })
})

describe('ArReturnCasePane — the liens on a returned check (punch list #435, piece 6)', () => {
  // Every job, instrument and name here is made up.
  const lien = (over: Partial<PayoffReturnedInput> = {}) =>
    payoffReturnedView({
      jobs: [{ jobId: 'j1', stand: 'counted' }],
      labelByJob: { j1: '#2041 Okafor main house' },
      targets: [{ affidavit: { id: 'a1', job_id: 'j1', county: 'Travis', recording_number: '2026-0412207', filed_at: '2026-09-09' }, release: null }],
      prints: [],
      checkNumber: '1184',
      ...over,
    })
  const saved = { id: 'r1', created_at: '2026-09-20T16:00:00Z', filed_at: null, fields: { releasesFilingId: 'a1' } }
  const pane = (liens: ReturnedCaseLiens | null, onOpenJob = noop as (jobId: string) => void) =>
    render(
      <ArReturnCasePane view={arReturnCaseView({ row, trail: [], todayYmd: TODAY })} todayYmd={TODAY} canApply replacement={null} busy={null} error={null} onTakeOff={noop} onTheySaid={noop} onUseReplacement={noop} onClose={noop} onTakeRecordedOff={noop} onNotBounced={noop} liens={liens} onOpenJob={onOpenJob} />,
    )

  it('draws nothing while the liens are read, and nothing when no job is liened', () => {
    pane({ status: 'reading', view: null, why: null })
    expect(screen.queryByTestId('ar-return-case-liens')).toBeNull()
    cleanup()
    pane({ status: 'ready', view: null, why: null })
    expect(screen.queryByTestId('ar-return-case-liens')).toBeNull()
    cleanup()
    pane(null)
    expect(screen.queryByTestId('ar-return-case-liens')).toBeNull()
  })

  it('none printed: the lien stays on record, in amber', () => {
    pane({ status: 'ready', view: lien(), why: null })
    const block = screen.getByTestId('ar-return-case-liens')
    expect(block.getAttribute('data-state')).toBe('amber')
    expect(screen.getByTestId('ar-return-case-liens-line').textContent).toBe('No release has left the office. 1 filed lien stays on record.')
    const one = screen.getByTestId('ar-return-case-lien')
    expect(one.getAttribute('data-case')).toBe('none')
    expect(one.textContent).toContain('#2041 Okafor main house')
    expect(one.textContent).toContain('instrument 2026-0412207')
    expect(screen.getByTestId('ar-return-case-lien-chip').textContent).toBe('On record')
  })

  it('printed: Do not record, with who printed it and when, and a door to the job', () => {
    const onOpenJob = vi.fn()
    pane({ status: 'ready', view: lien({ targets: [{ affidavit: { id: 'a1', job_id: 'j1', county: 'Travis', recording_number: '2026-0412207', filed_at: '2026-09-09' }, release: saved }], prints: [{ jobId: 'j1', printedAt: '2026-09-20T17:00:00Z', by: 'Alex Rivera' }] }), why: null }, onOpenJob)
    expect(screen.getByTestId('ar-return-case-liens').getAttribute('data-state')).toBe('red')
    expect(screen.getByTestId('ar-return-case-lien').getAttribute('data-case')).toBe('printed')
    expect(screen.getByTestId('ar-return-case-lien-chip').textContent).toBe('Do not record')
    expect(screen.getByTestId('ar-return-case-lien').textContent).toContain('A release was printed Sep 20 by Alex Rivera. Do not record it.')
    fireEvent.click(screen.getByTestId('ar-return-case-lien-open'))
    expect(onOpenJob).toHaveBeenCalledWith('j1')
  })

  it('recorded: Released, money came back, and it is counsel’s', () => {
    pane({ status: 'ready', view: lien({ jobs: [{ jobId: 'j1', stand: 'typed' }], targets: [{ affidavit: { id: 'a1', job_id: 'j1', county: 'Travis', recording_number: '2026-0412207', filed_at: '2026-09-09' }, release: { ...saved, filed_at: '2026-09-22', fields: { releasesFilingId: 'a1', releaseInstrument: '2026-0431955' } } }] }), why: null })
    expect(screen.getByTestId('ar-return-case-liens').getAttribute('data-state')).toBe('counsel')
    expect(screen.getByTestId('ar-return-case-liens-line').textContent).toBe('1 release is recorded on check 1184. Ask counsel.')
    expect(screen.getByTestId('ar-return-case-lien-chip').textContent).toBe('Released, money came back')
    expect(screen.getByTestId('ar-return-case-lien').textContent).toContain('The county recorded the release Sep 22 as 2026-0431955. The app cannot undo that.')
    // The check was typed on this job by hand: the case's own take off does not reach it.
    expect(screen.getByTestId('ar-return-case-lien-typed').textContent).toBe('Check 1184 still counts as paid on this job. Take it off on the job’s Bill tab.')
  })

  it('says so when the liens could not be read, with the reason', () => {
    pane({ status: 'failed', view: null, why: 'permission denied for table job_lien_filings' })
    const block = screen.getByTestId('ar-return-case-liens')
    expect(block.getAttribute('data-state')).toBe('failed')
    expect(block.textContent).toContain('The liens on these jobs could not be read.')
    expect(block.textContent).toContain('permission denied for table job_lien_filings')
  })
})
