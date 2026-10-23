// @vitest-environment jsdom
/**
 * Render smokes for AccountingApprovalCard (v2.5804): the day the card was swiped sits to the
 * right of the Card line, read from Mercury's created time, so a pending charge has a day before it posts.
 */
import { describe, expect, it, vi } from 'vitest'
import { render } from '@testing-library/react'
import type { Database } from '../../types/database'
import { AccountingApprovalCard, type AccountingApprovalCardData } from './AccountingApprovalCard'

type MercuryTxRow = Database['public']['Tables']['mercury_transactions']['Row']
type DragLabelRow = Database['public']['Tables']['mercury_drag_sort_labels']['Row']

const TODAY = '2026-10-23' // a Friday
const CARD_ID = '0b4f3c2e-1d2a-4c3b-8e9f-0a1b2c3d4e5f'
const LABELS = [{ id: 'label-fuel', name: 'Fuel / Gas' }] as unknown as DragLabelRow[]

function makeTx(p: Partial<MercuryTxRow>): MercuryTxRow {
  return {
    id: 'tx-1',
    amount: -50,
    counterparty_name: 'ExxonMobil',
    counterparty_id: null,
    created_at: '2026-10-20T19:14:00Z',
    created_by: null,
    currency: 'USD',
    dashboard_link: null,
    duplicate_of_transaction_id: null,
    external_memo: null,
    kind: 'externalTransfer',
    manual_upload_id: null,
    mercury_account_id: 'acct-1',
    mercury_category: null,
    mercury_id: 'm-1',
    note: null,
    posted_at: null,
    raw: { createdAt: '2026-10-20T19:14:00Z', bankDescription: 'FILLSPOT', details: { debitCardInfo: { id: CARD_ID } } },
    source: 'mercury',
    status: 'pending',
    synced_at: '2026-10-23T12:00:00Z',
    ...p,
  }
}

function renderCard(tx: MercuryTxRow) {
  const approval: AccountingApprovalCardData = {
    suggestionId: 's-1',
    txId: tx.id,
    tx,
    ruleId: 'rule-1',
    ruleName: 'ExxonMobil - Fuel / Gas',
    suggestedLabelId: 'label-fuel',
    suggestedLabelName: 'Fuel / Gas',
  }
  return render(
    <AccountingApprovalCard
      approval={approval}
      labels={LABELS}
      nicknameByDebitCard={{ [CARD_ID]: 'Abraham 2112' }}
      approveAllBusy={false}
      rulesLoading={false}
      onApprove={vi.fn()}
      onReject={vi.fn()}
      onLabelChange={vi.fn()}
      onOpenEditRule={vi.fn()}
      todayYmd={TODAY}
    />,
  )
}

function dayText(container: HTMLElement): string | null {
  return container.querySelector('[data-testid="accounting-approval-charge-day"]')?.textContent ?? null
}

describe('AccountingApprovalCard · the day the card was swiped', () => {
  it('a pending charge (no posted_at) reads its swipe day to the right of the Card line, and Posted stays a dash', () => {
    const { container } = renderCard(makeTx({}))
    expect(dayText(container)).toBe('Tuesday · 3 days ago (10/20/26)')
    expect(container.textContent).toContain('Card: Abraham 2112 · Tuesday · 3 days ago (10/20/26)')
    expect(container.textContent).toContain('Posted — · Bank: FILLSPOT')
  })

  it('a posted charge keeps its swipe day on the Card line and the posted day on the Posted line', () => {
    const { container } = renderCard(makeTx({ posted_at: '2026-10-23T06:30:00Z', status: 'sent' }))
    expect(dayText(container)).toBe('Tuesday · 3 days ago (10/20/26)')
    expect(container.textContent).toContain('Posted Oct 23, 2026')
  })

  it("today's charge reads Today with the short date", () => {
    const at = '2026-10-23T16:10:00Z'
    const { container } = renderCard(makeTx({ created_at: at, raw: { createdAt: at, bankDescription: 'FILLSPOT', details: { debitCardInfo: { id: CARD_ID } } } }))
    expect(dayText(container)).toBe('Today (10/23/26)')
  })

  it('an 8-day-old charge counts the days and names the weekday', () => {
    const at = '2026-10-15T14:00:00Z'
    const { container } = renderCard(makeTx({ created_at: at, raw: { createdAt: at, bankDescription: 'FILLSPOT', details: { debitCardInfo: { id: CARD_ID } } } }))
    expect(dayText(container)).toBe('Thursday · 8 days ago (10/15/26)')
  })

  it('a row read without raw still has its day from created_at, and a row with no card shows the day alone', () => {
    const { container } = renderCard(makeTx({ raw: null }))
    expect(dayText(container)).toBe('Tuesday · 3 days ago (10/20/26)')
    expect(container.textContent).not.toContain('Card:')
  })
})
