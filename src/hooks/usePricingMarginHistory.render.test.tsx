// @vitest-environment jsdom
/**
 * The Workbench's win/loss history read as a hook (region P2 of the Pricing map). Pins the
 * seam: no service type reads nothing; the rows come back as they are; a failed or odd read
 * is an empty list; changing the trade reads again and an old answer never lands late.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, render, screen } from '@testing-library/react'
import { usePricingMarginHistory } from './usePricingMarginHistory'

type Answer = { data: unknown; error: unknown }
const calls: Array<{ fn: string; args: Record<string, unknown> }> = []
const answers: Record<string, Answer | Promise<Answer>> = {}
vi.mock('../lib/supabase', () => ({
  supabase: {
    rpc: (fn: string, args: Record<string, unknown>) => {
      calls.push({ fn, args })
      return Promise.resolve(answers[String(args.p_service_type_id)] ?? { data: [], error: null })
    },
  },
}))

function Probe({ serviceTypeId }: { serviceTypeId: string | null }) {
  const h = usePricingMarginHistory(serviceTypeId)
  return <div data-testid="history">{h == null ? 'null' : `${h.length} rows${h.length ? `: ${h.map((r) => r.bid_id).join(',')}` : ''}`}</div>
}

beforeEach(() => {
  calls.length = 0
  for (const k of Object.keys(answers)) delete answers[k]
})
afterEach(() => cleanup())

describe('usePricingMarginHistory', () => {
  it('with no service type, reads nothing and stays null', async () => {
    render(<Probe serviceTypeId={null} />)
    await act(async () => {})
    expect(screen.getByTestId('history').textContent).toBe('null')
    expect(calls).toEqual([])
  })

  it('reads the trade’s history and hands the rows back as they are', async () => {
    answers.plumbing = { data: [{ bid_id: 'h1' }, { bid_id: 'h2' }], error: null }
    render(<Probe serviceTypeId="plumbing" />)
    await screen.findByText('2 rows: h1,h2')
    expect(calls).toEqual([{ fn: 'bid_pricing_history', args: { p_service_type_id: 'plumbing' } }])
  })

  it('a failed read, or an answer that is not a list, is an empty list', async () => {
    answers.plumbing = { data: null, error: { message: 'nope' } }
    const { unmount } = render(<Probe serviceTypeId="plumbing" />)
    await screen.findByText('0 rows')
    unmount()
    answers.plumbing = { data: { rows: [] }, error: null }
    render(<Probe serviceTypeId="plumbing" />)
    await screen.findByText('0 rows')
  })

  it('a new trade reads again, and the first trade’s late answer never lands', async () => {
    let releaseFirst: (a: Answer) => void = () => {}
    answers.plumbing = new Promise<Answer>((resolve) => { releaseFirst = resolve })
    answers.hvac = { data: [{ bid_id: 'v1' }], error: null }
    const { rerender } = render(<Probe serviceTypeId="plumbing" />)
    rerender(<Probe serviceTypeId="hvac" />)
    await screen.findByText('1 rows: v1')
    await act(async () => {
      releaseFirst({ data: [{ bid_id: 'p1' }, { bid_id: 'p2' }], error: null })
    })
    expect(screen.getByTestId('history').textContent).toBe('1 rows: v1')
    expect(calls.map((c) => c.args.p_service_type_id)).toEqual(['plumbing', 'hvac'])
  })

  it('clearing the trade goes back to null', async () => {
    answers.plumbing = { data: [{ bid_id: 'h1' }], error: null }
    const { rerender } = render(<Probe serviceTypeId="plumbing" />)
    await screen.findByText('1 rows: h1')
    rerender(<Probe serviceTypeId={null} />)
    await screen.findByText('null')
  })
})
