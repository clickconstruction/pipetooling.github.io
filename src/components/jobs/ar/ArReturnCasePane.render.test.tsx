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

const TODAY = '2026-10-05'

const row: ArReturnCaseRow = {
  mercury_transaction_id: 'tx-sp',
  counterparty_name: 'Southern Post',
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
        replacement={{ mercury_transaction_id: 'tx-new', counterparty_name: 'Southern Post', amount: 13680, posted_at: '2026-10-03T00:30:00+00:00', remaining_available: 13680 }}
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
    expect(screen.getByTestId('ar-return-case-replacement').textContent).toContain('This looks like the new check. Southern Post · $13,680 · Oct 2.')
  })
})

describe('ArReturnCasePane — a card dispute on a Stripe bill (v2.4950)', () => {
  const disputeRow = (lostAt: string | null): ArReturnCaseRow => ({
    ...row,
    mercury_transaction_id: 'case-dp1',
    counterparty_name: 'Heron Construction',
    amount: 500,
    kind: 'card',
    posted_at: null,
    failed_at: '2026-09-28T15:00:00Z',
    bank_reason: 'fraudulent',
    source: 'stripe_dispute',
    recorded_payment: { payment_id: 'pay-1', job_id: 'job-878', job_number: '878', job_name: 'Take 5- Seguin', amount: 500, paid_on: '2026-09-24' },
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
      job_name: 'Take 5- Seguin',
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
    expect(screen.getByTestId('ar-return-case-next-sentence').textContent).toBe('The money is gone. Put the bill back, then bill Heron Construction again.')
    fireEvent.click(screen.getByTestId('ar-return-case-putback'))
    const readback = screen.getByTestId('ar-return-case-putback-readback')
    expect(readback.textContent).toContain('$500 comes off bill 1 on #878.')
    expect(readback.textContent).toContain('#878 owes the $500 again.')
    expect(onPutBack).not.toHaveBeenCalled()
    fireEvent.click(screen.getByTestId('ar-return-case-putback-confirm'))
    expect(onPutBack).toHaveBeenCalledTimes(1)
  })
})
