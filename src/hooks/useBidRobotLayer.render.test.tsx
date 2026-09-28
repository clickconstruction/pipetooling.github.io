// @vitest-environment jsdom
/**
 * The Bids page's robot layer through its hook: what the robot icon's row reads once the
 * loads land, who the questions load for, the sheets reading the live row, and the two writes
 * that can be refused (the robot request rolls back; an answer taken elsewhere says so).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, renderHook, waitFor } from '@testing-library/react'
import { useState } from 'react'
import type { BidWithBuilder } from '../types/bidWithBuilder'
import { useBidRobotLayer } from './useBidRobotLayer'
import { settle } from '../test/renderSmokeMocks'

type Answer = { data: unknown; error: { message: string } | null; count?: number }

const db = vi.hoisted(() => ({
  answers: {} as Record<string, { data: unknown; error: { message: string } | null; count?: number }>,
  calls: [] as string[],
}))

vi.mock('../lib/supabase', () => {
  function answerFor(key: string, single: boolean): Answer {
    db.calls.push(key)
    return db.answers[key] ?? { data: single ? null : [], error: null, count: 0 }
  }
  function builder(table: string) {
    let op = 'select'
    let single = false
    const b: Record<string, unknown> = {}
    for (const m of ['select', 'eq', 'not', 'order', 'limit', 'like']) b[m] = () => b
    b.update = () => { op = 'update'; return b }
    b.insert = () => { op = 'insert'; return b }
    b.maybeSingle = () => { single = true; return b }
    b.then = (ok?: (v: unknown) => unknown, no?: (e: unknown) => unknown) => Promise.resolve(answerFor(`${table}.${op}`, single)).then(ok, no)
    return b
  }
  return {
    supabase: {
      from: (table: string) => builder(table),
      rpc: (name: string) => Promise.resolve(answerFor(`rpc.${name}`, false)),
    },
  }
})

afterEach(() => cleanup())
beforeEach(() => {
  db.answers = {}
  db.calls = []
})

const bid = (over: Partial<BidWithBuilder>): BidWithBuilder =>
  ({ id: 'bid-482', bid_number: '482', service_type_id: 'trade-p', robot_requested_at: null, robot_requested_by: null, twin_source_bid_id: null, ...over }) as BidWithBuilder

const HUMAN = bid({})
const TWIN = bid({ id: 'twin-482', bid_number: 'ZZ-482', twin_source_bid_id: 'bid-482' })
const SERVICE_TYPES = [{ id: 'trade-p', name: 'Plumbing' }]

/** Mounts the hook and lets its three mount-time loads land. */
async function setup(opts: { role?: string; bids?: BidWithBuilder[] } = {}) {
  const showToast = vi.fn()
  const hook = renderHook(
    (p: { bids: BidWithBuilder[] }) => {
      const [bids, setBids] = useState(p.bids)
      const robot = useBidRobotLayer({ authUserId: 'user-1', myRole: opts.role ?? 'estimator', bids, setBids, robotBids: [TWIN], serviceTypes: SERVICE_TYPES, showToast })
      return { robot, bids, setBids }
    },
    { initialProps: { bids: opts.bids ?? [HUMAN] } },
  )
  await settle()
  return { ...hook, showToast }
}

describe('useBidRobotLayer', () => {
  it('builds the robot icon’s row from the loads: trade, twin, latest run, questions, presence', async () => {
    db.answers['rpc.list_shadow_runs'] = {
      data: [
        { id: 'older', status: 'locked', reference_bid_number: '482', created_at: '2026-09-01T12:00:00Z' },
        { id: 'newer', status: 'scored', reference_bid_number: '482', created_at: '2026-09-20T12:00:00Z' },
      ],
      error: null,
    }
    db.answers['rpc.list_reference_presence'] = { data: [{ bid_id: 'bid-482', has_counts: true, has_pricing: false }], error: null }
    db.answers['twin_questions.select'] = {
      data: [
        { id: 'q-plans', question: 'Need the plans', kind: 'plans', about_bid_id: 'twin-482', created_at: '2026-09-02T00:00:00Z', audience: 'estimator' },
        { id: 'q-dec', question: 'Which schedule?', kind: 'decision', about_bid_id: 'bid-482', created_at: '2026-09-03T00:00:00Z', audience: null },
        { id: 'q-op', question: 'Operator lane', kind: 'decision', about_bid_id: 'bid-482', created_at: '2026-09-04T00:00:00Z', audience: 'operator' },
      ],
      error: null,
    }
    const { result } = await setup()
    await waitFor(() => expect(result.current.robot.robotRowInputFor(HUMAN).openQuestions).toBe(2))
    await waitFor(() => expect(result.current.robot.robotRowInputFor(HUMAN).run?.status).toBe('scored'))
    await waitFor(() => expect(result.current.robot.robotRowInputFor(HUMAN).presence).toEqual({ hasCounts: true, hasPricing: false }))
    const row = result.current.robot.robotRowInputFor(HUMAN)
    expect(row.bid).toBe(HUMAN)
    expect(row.serviceTypeName).toBe('Plumbing')
    expect(row.twinBidNumber).toBe('ZZ-482')
    expect(row.plansAsks).toBe(1)
    expect(result.current.robot.robotQuestionsWaiting).toBe(1)
    expect(result.current.robot.twinBidBySourceId.get('bid-482')).toBe(TWIN)
    expect(result.current.robot.openQuestionsByBidId.get('bid-482')?.map((q) => q.id)).toEqual(['q-plans', 'q-dec'])
  })

  it('a bid nothing is known about reads as empty, not broken', async () => {
    const { result } = await setup()
    await waitFor(() => expect(db.calls).toContain('rpc.list_shadow_runs'))
    const lone = bid({ id: 'bid-9', bid_number: '9', service_type_id: 'trade-x' })
    expect(result.current.robot.robotRowInputFor(lone)).toEqual({ bid: lone, serviceTypeName: null, twinBidNumber: null, run: null, openQuestions: 0, plansAsks: 0, presence: null })
  })

  it('loads the robots’ questions for the audit roles only', async () => {
    await setup({ role: 'superintendent' })
    await waitFor(() => expect(db.calls).toContain('rpc.list_shadow_runs'))
    expect(db.calls).not.toContain('twin_questions.select')
    cleanup()
    db.calls = []
    await setup({ role: 'estimator' })
    await waitFor(() => expect(db.calls).toContain('twin_questions.select'))
  })

  it('the sheets read the live row, not the one they were opened with', async () => {
    const { result } = await setup()
    act(() => result.current.robot.setRobotStatusBid(HUMAN))
    act(() => result.current.robot.setRobotNeedsBid(HUMAN))
    expect(result.current.robot.robotStatusBid).toBe(HUMAN)
    act(() => result.current.setBids([{ ...HUMAN, robot_requested_at: '2026-09-27T00:00:00Z' } as BidWithBuilder]))
    expect(result.current.robot.robotStatusBid?.robot_requested_at).toBe('2026-09-27T00:00:00Z')
    expect(result.current.robot.robotNeedsBid?.robot_requested_at).toBe('2026-09-27T00:00:00Z')
    act(() => result.current.robot.setRobotStatusBid(null))
    expect(result.current.robot.robotStatusBid).toBeNull()
  })

  it('the needs sheet can be opened by id before the row is in hand', async () => {
    const { result } = await setup({ bids: [] })
    act(() => result.current.robot.setRobotNeedsBidId('bid-482'))
    expect(result.current.robot.robotNeedsBid).toBeNull()
    act(() => result.current.setBids([HUMAN]))
    expect(result.current.robot.robotNeedsBid).toBe(HUMAN)
  })

  it('asking for a robot bid stamps the row and says so', async () => {
    db.answers['bids.update'] = { data: [{ id: 'bid-482' }], error: null }
    const { result, showToast } = await setup()
    await act(async () => { await result.current.robot.toggleRobotRequest(HUMAN) })
    expect(result.current.bids[0]!.robot_requested_at).toMatch(/^\d{4}-/)
    expect(result.current.bids[0]!.robot_requested_by).toBe('user-1')
    expect(showToast).toHaveBeenCalledWith('Moved to the front of the next robot batch.', 'success')
  })

  it('a refused robot request rolls the row back and says so', async () => {
    db.answers['bids.update'] = { data: [], error: null }
    const { result, showToast } = await setup()
    await act(async () => { await result.current.robot.toggleRobotRequest(HUMAN) })
    expect(result.current.bids[0]!.robot_requested_at).toBeNull()
    expect(result.current.bids[0]!.robot_requested_by).toBeNull()
    expect(showToast).toHaveBeenCalledTimes(1)
    expect(showToast.mock.calls[0]![1]).toBe('error')
  })

  it('withdrawing a request clears the stamp', async () => {
    db.answers['bids.update'] = { data: [{ id: 'bid-482' }], error: null }
    const asked = bid({ robot_requested_at: '2026-09-20T00:00:00Z', robot_requested_by: 'user-2' })
    const { result, showToast } = await setup({ bids: [asked] })
    await act(async () => { await result.current.robot.toggleRobotRequest(asked) })
    expect(result.current.bids[0]!.robot_requested_at).toBeNull()
    expect(showToast).toHaveBeenCalledWith('Back in line with the other bids.', 'success')
  })

  it('an answer saves and says the robot reads it next run', async () => {
    db.answers['twin_questions.update'] = { data: [{ id: 'q-1' }], error: null }
    const { result, showToast } = await setup()
    let ok = false
    await act(async () => { ok = await result.current.robot.answerRobotQuestion('q-1', 'Use schedule B') })
    expect(ok).toBe(true)
    expect(showToast).toHaveBeenCalledWith('Answer saved — the robot reads it on its next run.', 'success')
  })

  it('an answer with a rerun puts the bid at the front of the line', async () => {
    db.answers['twin_questions.update'] = { data: [{ id: 'q-1' }], error: null }
    db.answers['bids.update'] = { data: [{ id: 'bid-482' }], error: null }
    const { result, showToast } = await setup()
    await act(async () => { await result.current.robot.answerRobotQuestion('q-1', 'Attached — rerun', { rerunBidId: 'bid-482' }) })
    expect(result.current.bids[0]!.robot_requested_at).toMatch(/^\d{4}-/)
    expect(showToast).toHaveBeenCalledWith('Answer saved — the robot goes again, front of the line next batch.', 'success')
  })

  it('an answer taken elsewhere is not saved twice', async () => {
    db.answers['twin_questions.update'] = { data: [], error: null }
    const { result, showToast } = await setup()
    let ok = true
    await act(async () => { ok = await result.current.robot.answerRobotQuestion('q-1', 'Use schedule B') })
    expect(ok).toBe(false)
    expect(showToast).toHaveBeenCalledWith('Already answered elsewhere — refreshing.', 'error')
  })

  it('a failed answer says why', async () => {
    db.answers['twin_questions.update'] = { data: null, error: { message: 'permission denied' } }
    const { result, showToast } = await setup()
    let ok = true
    await act(async () => { ok = await result.current.robot.answerRobotQuestion('q-1', 'Use schedule B') })
    expect(ok).toBe(false)
    expect(showToast).toHaveBeenCalledWith("Couldn't save the answer: permission denied", 'error')
  })
})
