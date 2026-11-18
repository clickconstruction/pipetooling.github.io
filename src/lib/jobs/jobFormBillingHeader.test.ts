import { describe, expect, it } from 'vitest'
import { buildEditJobBillingBar } from './editJobBillingBar'
import { billingHeaderStatusLine, newJobMoneyBar } from './jobFormBillingHeader'

describe('billingHeaderStatusLine', () => {
  it('says Saving… while an open job’s billing save is in flight', () => {
    expect(billingHeaderStatusLine('job-1', 'saving')).toEqual({ words: 'Saving…', failed: false })
  })

  it('says the save failed, and how to try again', () => {
    expect(billingHeaderStatusLine('job-1', 'error')).toEqual({ words: 'Autosave failed — edit again to retry', failed: true })
  })

  it('says nothing while the save is idle or done: a steady Saved is noise', () => {
    expect(billingHeaderStatusLine('job-1', 'idle')).toBeNull()
    expect(billingHeaderStatusLine('job-1', 'saved')).toBeNull()
  })

  it('says nothing on a new job, whatever the slice reports', () => {
    for (const status of ['saving', 'error', 'idle', 'saved']) {
      expect(billingHeaderStatusLine(null, status), status).toBeNull()
      expect(billingHeaderStatusLine(undefined, status), status).toBeNull()
      expect(billingHeaderStatusLine('', status), status).toBeNull()
    }
  })
})

describe('newJobMoneyBar', () => {
  const bar = (total: number, payments: Array<{ amount: number; invoice_id?: string | null }> = [], invoices: Array<{ id: string; status: string; amount: number }> = []) =>
    newJobMoneyBar(buildEditJobBillingBar({ total, payments, invoices }))

  it('a new job with no price yet: plain labels, no percents, nothing remaining', () => {
    const b = bar(0)
    expect(b.rows).toEqual([
      { key: 'paid', label: 'Paid', value: 0 },
      { key: 'billed', label: 'Billed', value: 0 },
    ])
    expect(b.segments).toEqual([
      { key: 'paid', frac: 0 },
      { key: 'billed', frac: 0 },
      { key: 'draft', frac: 0 },
    ])
    expect(b.bottomRow).toEqual({ label: 'Remaining to bill', value: 0, title: 'Job Total minus payments and every draft or sent bill' })
    expect(b.barTitle).toBe('Job total $0.00 — paid $0.00, billed unpaid $0.00, draft $0.00')
  })

  it('a priced job with nothing paid: each label leads with its share, the whole price remains', () => {
    const b = bar(2_000)
    expect(b.rows.map((r) => r.label)).toEqual(['0% Paid', '0% Billed'])
    expect(b.bottomRow.value).toBe(2_000)
    expect(b.barTitle).toBe('Job total $2,000.00 — paid $0.00, billed unpaid $0.00, draft $0.00')
  })

  it('a payment typed on the new job shows as its share of the price', () => {
    const b = bar(2_000, [{ amount: 500 }])
    expect(b.rows[0]).toEqual({ key: 'paid', label: '25% Paid', value: 500 })
    expect(b.segments[0]).toEqual({ key: 'paid', frac: 0.25 })
    expect(b.bottomRow.value).toBe(1_500)
  })

  it('shares round to the whole percent', () => {
    expect(bar(3_000, [{ amount: 1_000 }]).rows[0]?.label).toBe('33% Paid')
    expect(bar(3_000, [{ amount: 2_000 }]).rows[0]?.label).toBe('67% Paid')
  })

  it('the Draft row is there only while a draft holds money, and carries its own share', () => {
    expect(bar(2_000).rows.map((r) => r.key)).toEqual(['paid', 'billed'])
    const withDraft = bar(2_000, [], [{ id: 'inv-1', status: 'ready_to_bill', amount: 800 }])
    expect(withDraft.rows.map((r) => r.key)).toEqual(['paid', 'billed', 'draft'])
    expect(withDraft.rows[2]).toEqual({ key: 'draft', label: '40% Draft (not sent)', value: 800 })
    expect(withDraft.barTitle).toBe('Job total $2,000.00 — paid $0.00, billed unpaid $0.00, draft $800.00')
  })

  it('a draft with no price behind it keeps its plain words', () => {
    const b = bar(0, [], [{ id: 'inv-1', status: 'ready_to_bill', amount: 800 }])
    expect(b.rows[2]).toEqual({ key: 'draft', label: 'Draft (not sent)', value: 800 })
  })

  it('a sent bill reads as Billed for what is still unpaid on it', () => {
    const b = bar(2_000, [{ amount: 300, invoice_id: 'inv-1' }], [{ id: 'inv-1', status: 'billed', amount: 1_000 }])
    expect(b.rows[0]).toEqual({ key: 'paid', label: '15% Paid', value: 300 })
    expect(b.rows[1]).toEqual({ key: 'billed', label: '35% Billed', value: 700 })
  })

  it('the three slices always ride the bar in the same order, drawn or not', () => {
    expect(bar(2_000, [{ amount: 500 }]).segments.map((s) => s.key)).toEqual(['paid', 'billed', 'draft'])
  })
})
