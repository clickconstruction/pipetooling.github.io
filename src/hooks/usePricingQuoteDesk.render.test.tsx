// @vitest-environment jsdom
/**
 * The Pricing header's quote desk as a hook (region P6 of the Pricing map). Pins the seam:
 * no bid or no permission reads nothing; with both, the bid's requests and their delivery
 * events make the chip; an open robot request wins the chip; the two one-shot URL doors open
 * their window once and drop their flag; opening a ready matrix marks it reviewed.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { usePricingQuoteDesk } from './usePricingQuoteDesk'

const tables: Record<string, { data: unknown[]; count?: number; error?: unknown }> = {}
const reads: string[] = []
const updates: Array<{ table: string; values: Record<string, unknown> }> = []

vi.mock('../lib/supabase', () => {
  function builder(table: string) {
    const b: Record<string, unknown> = {}
    for (const m of ['select', 'eq', 'neq', 'in', 'order', 'limit']) b[m] = () => b
    b.update = (values: Record<string, unknown>) => {
      updates.push({ table, values })
      return b
    }
    b.then = (ok: (v: unknown) => unknown, bad?: (e: unknown) => unknown) => {
      const t = tables[table] ?? { data: [] }
      return Promise.resolve({ data: t.data, count: t.count ?? 0, error: t.error ?? null }).then(ok, bad)
    }
    return b
  }
  return {
    supabase: {
      from: (table: string) => {
        reads.push(table)
        return builder(table)
      },
    },
  }
})

const rfq = (over: Record<string, unknown> = {}) => ({
  id: 'r1',
  status: 'sent',
  supply_house_id: 'h1',
  sent_to: 'Moore Supply',
  sent_email: 'danny@moore.com',
  resend_email_id: 're_1',
  created_at: '2026-09-01T12:00:00Z',
  viewed_at: null,
  last_reminded_at: null,
  reminder_count: 0,
  needed_by: null,
  ...over,
})

const matrixRequest = (status: string) => ({
  id: 'm1',
  bid_id: 'b1',
  status,
  requested_at: '2026-09-02T12:00:00Z',
  requested_by: null,
  scope: [],
  sources: [],
  claimed_by: null,
  claimed_at: null,
  heartbeat_at: null,
  finished_at: null,
  reviewed_at: null,
  summary: null,
  result: null,
  bids: null,
})

function Probe({ bid, allowed }: { bid: { id: string } | null; allowed: boolean }) {
  const d = usePricingQuoteDesk({ selectedBid: bid, canPackageAndSendBidPricing: allowed })
  const loc = useLocation()
  const open = [
    d.d22AuditOpen && 'audit',
    d.prepareCopyOpen && 'copy',
    d.plugInQuoteOpen && 'plugIn',
    d.plugInScheduleOpen && 'schedule',
    d.priceWithRobotOpen && 'robot',
    d.quotesCompareOpen && 'compare',
    d.rfqDeskOpen && 'desk',
  ].filter(Boolean)
  return (
    <div>
      <div data-testid="chip">{d.rfqChip.kind === 'none' ? 'none' : `${d.rfqChip.kind}:${d.rfqChip.tone}:${d.rfqChip.label}`}</div>
      <div data-testid="open">{open.join(',') || 'nothing'}</div>
      <div data-testid="houses">{[...d.openRfqHouseIds].join(',') || 'none'}</div>
      <div data-testid="search">{loc.search || '(empty)'}</div>
      <div data-testid="active">{d.activePriceMatrixRequest?.id ?? 'none'}</div>
      <button type="button" onClick={() => d.rfqChip.kind === 'robot' && void d.openRobotChip(d.rfqChip)}>open robot chip</button>
      <button type="button" onClick={() => d.bumpQuoteNonce()}>bump</button>
    </div>
  )
}

function mount(ui: React.ReactElement, route = '/bids') {
  return render(
    <MemoryRouter initialEntries={[route]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      {ui}
    </MemoryRouter>,
  )
}

beforeEach(() => {
  for (const k of Object.keys(tables)) delete tables[k]
  reads.length = 0
  updates.length = 0
  window.history.replaceState(null, '', '/bids')
})
afterEach(() => cleanup())

describe('usePricingQuoteDesk', () => {
  it('with no bid, reads nothing and the chip is none', async () => {
    mount(<Probe bid={null} allowed />)
    await act(async () => {})
    expect(screen.getByTestId('chip').textContent).toBe('none')
    expect(screen.getByTestId('open').textContent).toBe('nothing')
    expect(reads).toEqual([])
  })

  it('without the permission, reads nothing even with a bid', async () => {
    tables.bid_rfqs = { data: [rfq()] }
    mount(<Probe bid={{ id: 'b1' }} allowed={false} />)
    await act(async () => {})
    expect(screen.getByTestId('chip').textContent).toBe('none')
    expect(reads).toEqual([])
  })

  it('quotes with no request make the blue Quotes chip; no delivery log is read', async () => {
    tables.bid_quotes = { data: [], count: 3 }
    mount(<Probe bid={{ id: 'b1' }} allowed />)
    await screen.findByText('quotes:blue:Quotes (3)')
    expect(reads).not.toContain('email_send_log')
    expect(screen.getByTestId('houses').textContent).toBe('none')
  })

  it('a request still out makes the desk chip and names its house; a bounce turns it red', async () => {
    tables.bid_rfqs = { data: [rfq(), rfq({ id: 'r2', supply_house_id: 'h2', status: 'quoted', resend_email_id: null })] }
    tables.email_send_log = { data: [{ resend_email_id: 're_1', last_event: 'bounced' }] }
    mount(<Probe bid={{ id: 'b1' }} allowed />)
    await screen.findByText('desk:red:RFQs · 1 bounced')
    expect(screen.getByTestId('houses').textContent).toBe('h1')
    expect(reads).toContain('email_send_log')
  })

  it('a failed requests read leaves the chip on the quote count', async () => {
    tables.bid_quotes = { data: [], count: 2 }
    tables.bid_rfqs = { data: [], error: { message: 'nope' } }
    mount(<Probe bid={{ id: 'b1' }} allowed />)
    await screen.findByText('quotes:blue:Quotes (2)')
  })

  it('an open robot request wins the chip; a queued one opens the robot window', async () => {
    tables.bid_rfqs = { data: [rfq()] }
    tables.bid_price_matrix_requests = { data: [matrixRequest('queued')] }
    mount(<Probe bid={{ id: 'b1' }} allowed />)
    await screen.findByText('robot:blue:Robot pricing · queued')
    expect(screen.getByTestId('active').textContent).toBe('m1')
    fireEvent.click(screen.getByText('open robot chip'))
    await screen.findByText('robot')
    expect(updates).toEqual([])
  })

  it('opening a ready matrix marks it reviewed and opens the compare', async () => {
    tables.bid_price_matrix_requests = { data: [matrixRequest('ready')] }
    mount(<Probe bid={{ id: 'b1' }} allowed />)
    await screen.findByText('robot:green:Matrix ready')
    fireEvent.click(screen.getByText('open robot chip'))
    await screen.findByText('compare')
    expect(updates).toHaveLength(1)
    expect(updates[0]?.table).toBe('bid_price_matrix_requests')
    expect(typeof updates[0]?.values.reviewed_at).toBe('string')
  })

  it('a bump runs the reads again', async () => {
    tables.bid_quotes = { data: [], count: 1 }
    mount(<Probe bid={{ id: 'b1' }} allowed />)
    await screen.findByText('quotes:blue:Quotes (1)')
    tables.bid_quotes = { data: [], count: 4 }
    fireEvent.click(screen.getByText('bump'))
    await screen.findByText('quotes:blue:Quotes (4)')
  })

  it('?robot=price opens the robot window for the bid in hand and drops the flag, keeping the rest', async () => {
    mount(<Probe bid={{ id: 'b1' }} allowed />, '/bids?tab=pricing&bidId=b1&robot=price')
    await screen.findByText('robot')
    expect(screen.getByTestId('search').textContent).toBe('?tab=pricing&bidId=b1')
  })

  it('?robot=price waits while the bid in hand is another one', async () => {
    mount(<Probe bid={{ id: 'b2' }} allowed />, '/bids?tab=pricing&bidId=b1&robot=price')
    await act(async () => {})
    expect(screen.getByTestId('open').textContent).toBe('nothing')
    expect(screen.getByTestId('search').textContent).toBe('?tab=pricing&bidId=b1&robot=price')
  })

  it('?robot=price without the permission drops the flag and opens nothing', async () => {
    mount(<Probe bid={{ id: 'b1' }} allowed={false} />, '/bids?tab=pricing&bidId=b1&robot=price')
    await screen.findByText('?tab=pricing&bidId=b1')
    expect(screen.getByTestId('open').textContent).toBe('nothing')
  })

  it('?d22audit=1 opens the audit once and strips the flag from the address', async () => {
    window.history.replaceState(null, '', '/bids?tab=pricing&d22audit=1')
    mount(<Probe bid={null} allowed />)
    await screen.findByText('audit')
    expect(window.location.search).toBe('?tab=pricing')
  })

  it('?d22audit=1 without the permission strips the flag and opens nothing', async () => {
    window.history.replaceState(null, '', '/bids?d22audit=1')
    mount(<Probe bid={null} allowed={false} />)
    await act(async () => {})
    expect(screen.getByTestId('open').textContent).toBe('nothing')
    expect(window.location.search).toBe('')
  })
})
