// @vitest-environment jsdom
/**
 * The case pane's new-check line (v2.4325): the deposit that looks like the new check is dated
 * the day it posted on the company's calendar (v2.4463), not the UTC date of posted_at.
 */
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
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
