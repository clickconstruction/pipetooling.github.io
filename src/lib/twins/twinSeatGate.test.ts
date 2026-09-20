import { describe, expect, it } from 'vitest'
import { holdsPlanReadingTask, PRICER_TASK_FENCED_VERBS, PRICER_VERBS, pricerVerbList, seatGate, SHARED_VERBS, SUBMITTAL_VERBS, twinMayReadPlans } from '../../../supabase/functions/_shared/twinSeatGate'

const TWIN = 'twin-1'
const OTHER = 'twin-2'
const BID = { id: 'bid-1', created_by: 'person-1', estimator_id: 'person-2' }
const task = (over: Partial<{ bid_id: string; kind: string; status: string; claimed_by: string | null }> = {}) => ({ bid_id: 'bid-1', kind: 'read_schedule', status: 'working', claimed_by: TWIN, ...over })

describe('twinSeatGate · seatGate', () => {
  it('answers the four submittal verbs to either seat', () => {
    for (const verb of ['get_submittal_guide', 'next_submittal_task', 'put_submittal_result', 'finish_submittal_task']) {
      expect(SUBMITTAL_VERBS.has(verb)).toBe(true)
      expect(seatGate('pricer', verb)).toEqual({ ok: true })
      expect(seatGate('estimator', verb)).toEqual({ ok: true })
    }
  })

  it('answers the shared verbs to either seat, and the pricing verbs to the pricer only', () => {
    for (const verb of SHARED_VERBS) {
      expect(seatGate('pricer', verb).ok).toBe(true)
      expect(seatGate('estimator', verb).ok).toBe(true)
    }
    for (const verb of PRICER_VERBS) {
      expect(seatGate('pricer', verb)).toEqual({ ok: true })
      expect(seatGate('estimator', verb)).toEqual({ ok: false, reason: 'pricer_verb' })
    }
  })

  it('still refuses a pricer the bid verbs — get_plan_pages is the one door, left to the per-bid fence', () => {
    for (const verb of ['get_brief', 'get_assignments', 'mint_session', 'stage_plan_pdf', 'file_plans', 'paste_counts', 'lock_shadow', 'open_backtest', 'get_plan_brief', 'no_such_verb']) {
      expect(seatGate('pricer', verb)).toEqual({ ok: false, reason: 'bid_verb' })
      expect(seatGate('estimator', verb)).toEqual({ ok: true })
    }
    expect([...PRICER_TASK_FENCED_VERBS]).toEqual(['get_plan_pages'])
    expect(seatGate('pricer', 'get_plan_pages')).toEqual({ ok: true })
  })

  it('lists every verb the pricer may call, once each, and each one passes the gate', () => {
    const list = pricerVerbList()
    expect(new Set(list).size).toBe(list.length)
    expect(list).toContain('next_submittal_task')
    expect(list).toContain('get_plan_pages')
    for (const verb of list) expect(seatGate('pricer', verb).ok).toBe(true)
  })
})

describe('twinSeatGate · twinMayReadPlans', () => {
  it('opens the plans of an own or assigned bid with no task at all', () => {
    expect(twinMayReadPlans(TWIN, { ...BID, created_by: TWIN }, [])).toBe(true)
    expect(twinMayReadPlans(TWIN, { ...BID, estimator_id: TWIN }, [])).toBe(true)
    expect(twinMayReadPlans(TWIN, BID, [])).toBe(false)
  })

  it('opens another bid only to the twin holding its working read_schedule task', () => {
    expect(twinMayReadPlans(TWIN, BID, [task()])).toBe(true)
    expect(holdsPlanReadingTask([task()], TWIN, 'bid-1')).toBe(true)
    // another twin's claim, another bid, a file kind, or a task no longer working: closed
    expect(twinMayReadPlans(TWIN, BID, [task({ claimed_by: OTHER })])).toBe(false)
    expect(twinMayReadPlans(TWIN, BID, [task({ claimed_by: null, status: 'queued' })])).toBe(false)
    expect(twinMayReadPlans(TWIN, BID, [task({ bid_id: 'bid-9' })])).toBe(false)
    expect(twinMayReadPlans(TWIN, BID, [task({ kind: 'file_cut_sheets' })])).toBe(false)
    expect(twinMayReadPlans(TWIN, BID, [task({ kind: 'read_redlines' })])).toBe(false)
    for (const status of ['queued', 'ready', 'blocked', 'confirmed', 'dismissed']) {
      expect(twinMayReadPlans(TWIN, BID, [task({ status })])).toBe(false)
    }
  })

  it('finds the opening task among others', () => {
    expect(twinMayReadPlans(TWIN, BID, [task({ bid_id: 'bid-9' }), task({ kind: 'read_redlines' }), task()])).toBe(true)
  })
})
