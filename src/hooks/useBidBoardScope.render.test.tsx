// @vitest-environment jsdom
/**
 * The Bid Board's scope through its hook: the People | Robots split, the scope the counts
 * live in, the J#### index loading for the roles that can open a job, and linking a job to a
 * bid — confirm, the RPC, the toast, the event.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, renderHook, waitFor } from '@testing-library/react'
import type { BidWithBuilder } from '../types/bidWithBuilder'
import { JOB_CREATED_FROM_BID_EVENT } from '../lib/bids/wonMomentActions'
import { settle } from '../test/renderSmokeMocks'
import { useBidBoardScope } from './useBidBoardScope'

const db = vi.hoisted(() => ({
  jobs: [] as Array<{ id: string; hcp_number: string | null; bid_id: string | null; created_at: string | null }>,
  jobReads: [] as string[][],
  rpcError: null as { message: string } | null,
  rpcCalls: [] as Array<{ name: string; args: unknown }>,
  confirmAnswer: true,
  confirmCalls: [] as Array<{ message: string; confirmLabel?: string }>,
  budgetChipArgs: [] as Array<{ ids: string[]; enabled: boolean }>,
  stripArgs: [] as Array<{ ids: string[]; enabled: boolean }>,
}))

vi.mock('../lib/supabase', () => ({
  supabase: {
    from: () => ({
      select: () => ({
        in: (_col: string, ids: string[]) => {
          db.jobReads.push(ids)
          return Promise.resolve({ data: db.jobs.filter((j) => j.bid_id != null && ids.includes(j.bid_id)), error: null })
        },
      }),
    }),
    rpc: (name: string, args: unknown) => {
      db.rpcCalls.push({ name, args })
      return Promise.resolve({ data: null, error: db.rpcError })
    },
  },
}))
vi.mock('../contexts/ConfirmDialogContext', () => ({
  useConfirmDialog: () => (opts: { message: string; confirmLabel?: string }) => {
    db.confirmCalls.push(opts)
    return Promise.resolve(db.confirmAnswer)
  },
}))
vi.mock('./useBidBoardBudgetChips', () => ({
  useBidBoardBudgetChips: (bids: Array<{ id: string }>, enabled: boolean) => {
    db.budgetChipArgs.push({ ids: bids.map((b) => b.id), enabled })
    return new Map()
  },
}))
vi.mock('./useBidBoardJobAccountStrips', () => ({
  useBidBoardJobAccountStrips: (ids: string[], enabled: boolean) => {
    db.stripArgs.push({ ids: [...ids], enabled })
    return { byBid: new Map([['won-1', []]]), loaded: true, reload: () => {} }
  },
}))

const last = <T,>(list: T[]): T | undefined => list[list.length - 1]

afterEach(() => cleanup())
beforeEach(() => {
  db.jobs = []
  db.jobReads = []
  db.rpcError = null
  db.rpcCalls = []
  db.confirmAnswer = true
  db.confirmCalls = []
  db.budgetChipArgs = []
  db.stripArgs = []
})

const bid = (over: Partial<BidWithBuilder>): BidWithBuilder =>
  ({ id: 'bid-1', estimator_id: 'human-1', created_by: 'human-1', outcome: null, bid_date_sent: null, service_type_id: 'trade-p', ...over }) as BidWithBuilder

const BIDS = [
  bid({ id: 'open-1' }),
  bid({ id: 'robot-1', estimator_id: 'twin-1' }),
  bid({ id: 'won-1', outcome: 'won' }),
  bid({ id: 'started-1', outcome: 'started_or_complete' }),
  bid({ id: 'robot-made', created_by: 'twin-1', outcome: 'won' }),
]
const TWINS: ReadonlySet<string> = new Set(['twin-1'])
const SERVICE_TYPES = [{ id: 'trade-p', name: 'Plumbing' }]

async function setup(over: { role?: string | null; selectedServiceTypeId?: string; twinUserIds?: ReadonlySet<string> } = {}) {
  const showToast = vi.fn()
  const hook = renderHook(() =>
    useBidBoardScope({
      bids: BIDS,
      twinUserIds: over.twinUserIds ?? TWINS,
      selectedServiceTypeId: over.selectedServiceTypeId ?? 'trade-p',
      serviceTypes: SERVICE_TYPES,
      gcPacketsByBid: {},
      myRole: over.role === undefined ? 'assistant' : over.role,
      showToast,
    }),
  )
  await settle()
  return { ...hook, showToast }
}

const LINK = { jobId: 'job-9', bidId: 'won-1', jobLabel: 'J1234', bidLabel: 'B482' }

describe('useBidBoardScope', () => {
  it('splits the bids: a twin’s bids and the bids a twin made are the Robots side', async () => {
    const { result } = await setup()
    expect(result.current.peopleBids.map((b) => b.id)).toEqual(['open-1', 'won-1', 'started-1'])
    expect(result.current.robotBids.map((b) => b.id)).toEqual(['robot-1', 'robot-made'])
  })

  it('with no twins known, every bid is on the People side', async () => {
    const { result } = await setup({ twinUserIds: new Set() })
    expect(result.current.peopleBids).toHaveLength(5)
    expect(result.current.robotBids).toEqual([])
  })

  it('the scope is the trade pill’s trade, or every trade when it is cleared', async () => {
    const trade = await setup()
    expect(trade.result.current.sentScope).toEqual({ kind: 'trade', tradeId: 'trade-p', tradeName: 'Plumbing' })
    cleanup()
    const unknown = await setup({ selectedServiceTypeId: 'trade-x' })
    expect(unknown.result.current.sentScope).toEqual({ kind: 'trade', tradeId: 'trade-x', tradeName: null })
    cleanup()
    const all = await setup({ selectedServiceTypeId: '' })
    expect(all.result.current.sentScope).toEqual({ kind: 'all' })
  })

  it('the need-a-reason count is the sent counts’ own', async () => {
    const { result } = await setup()
    expect(result.current.lostBidsNeedingReasonCount).toBe(result.current.sentCounts.lostNeedingReason)
  })

  it('asks for job accounts on every won or started bid, both sides of the board', async () => {
    const { result } = await setup()
    expect(last(db.stripArgs)).toEqual({ ids: ['won-1', 'started-1', 'robot-made'], enabled: true })
    expect(result.current.jobAccountStrips.loaded).toBe(true)
    // The strip read came back with no house missing an account on any of them.
    expect(result.current.jobAccountsMissingCount).toBe(0)
  })

  it('loads the J#### index for a role that can open a job', async () => {
    db.jobs = [
      { id: 'job-old', hcp_number: '1200', bid_id: 'won-1', created_at: '2026-09-01T00:00:00Z' },
      { id: 'job-new', hcp_number: '1234', bid_id: 'won-1', created_at: '2026-09-20T00:00:00Z' },
    ]
    const { result } = await setup({ role: 'assistant' })
    await waitFor(() => expect(result.current.jobsByBidId.get('won-1')).toEqual({ jobId: 'job-new', hcpNumber: '1234' }))
    expect(db.jobReads[0]!.slice().sort()).toEqual(['open-1', 'robot-1', 'robot-made', 'started-1', 'won-1'])
    expect(last(db.budgetChipArgs)!.enabled).toBe(true)
  })

  it('an estimator gets no job index and no budget chips', async () => {
    db.jobs = [{ id: 'job-new', hcp_number: '1234', bid_id: 'won-1', created_at: '2026-09-20T00:00:00Z' }]
    const { result } = await setup({ role: 'estimator' })
    expect(db.jobReads).toEqual([])
    expect(result.current.jobsByBidId.size).toBe(0)
    expect(last(db.budgetChipArgs)!.enabled).toBe(false)
  })

  it('a job opened from a bid re-reads the index', async () => {
    const { result } = await setup({ role: 'assistant' })
    await waitFor(() => expect(db.jobReads).toHaveLength(1))
    db.jobs = [{ id: 'job-new', hcp_number: '1234', bid_id: 'open-1', created_at: '2026-09-20T00:00:00Z' }]
    act(() => { window.dispatchEvent(new CustomEvent(JOB_CREATED_FROM_BID_EVENT, { detail: { bidId: 'open-1', jobId: 'job-new' } })) })
    await waitFor(() => expect(result.current.jobsByBidId.get('open-1')?.jobId).toBe('job-new'))
    expect(db.jobReads).toHaveLength(2)
  })

  it('linking a job: confirm, the RPC, the toast, the event', async () => {
    const { result, showToast } = await setup()
    const heard: unknown[] = []
    const listen = (e: Event) => heard.push((e as CustomEvent).detail)
    window.addEventListener(JOB_CREATED_FROM_BID_EVENT, listen)
    let ok = false
    await act(async () => { ok = await result.current.linkJobToBidFromBoard(LINK) })
    window.removeEventListener(JOB_CREATED_FROM_BID_EVENT, listen)
    expect(ok).toBe(true)
    expect(db.confirmCalls).toHaveLength(1)
    expect(db.confirmCalls[0]!.message).toMatch(/^Link J1234 to B482\?/)
    expect(db.confirmCalls[0]!.confirmLabel).toBe('Link')
    expect(db.rpcCalls).toEqual([{ name: 'snapshot_job_budget_from_bid', args: { p_job_id: 'job-9', p_bid_id: 'won-1' } }])
    expect(showToast).toHaveBeenCalledWith("J1234 linked to B482 — its budget is the bid's estimate.", 'success')
    expect(heard).toEqual([{ bidId: 'won-1', jobId: 'job-9' }])
  })

  it('saying no writes nothing', async () => {
    db.confirmAnswer = false
    const { result, showToast } = await setup()
    let ok = true
    await act(async () => { ok = await result.current.linkJobToBidFromBoard(LINK) })
    expect(ok).toBe(false)
    expect(db.rpcCalls).toEqual([])
    expect(showToast).not.toHaveBeenCalled()
  })

  it('a refused link says why and sends no event', async () => {
    db.rpcError = { message: 'job already linked' }
    const { result, showToast } = await setup()
    const heard: unknown[] = []
    const listen = (e: Event) => heard.push((e as CustomEvent).detail)
    window.addEventListener(JOB_CREATED_FROM_BID_EVENT, listen)
    let ok = true
    await act(async () => { ok = await result.current.linkJobToBidFromBoard(LINK) })
    window.removeEventListener(JOB_CREATED_FROM_BID_EVENT, listen)
    expect(ok).toBe(false)
    expect(showToast).toHaveBeenCalledWith('Could not link: job already linked', 'error')
    expect(heard).toEqual([])
  })
})
