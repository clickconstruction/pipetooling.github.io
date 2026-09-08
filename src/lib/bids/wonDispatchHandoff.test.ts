import { describe, expect, it } from 'vitest'
import {
  bidHandoffLabel,
  bidIdsForOpenJobSweep,
  decideWonHandoff,
  dispatchAskedLabel,
  OPEN_JOB_FROM_BID_ACTION,
  pickOpenJobRequestsToClose,
  shouldAutoAskDispatchOnWon,
  wonHandoffClosedNote,
  wonHandoffReference,
  wonHandoffTitle,
} from './wonDispatchHandoff'
import { wonHandoffMode } from './wonMomentActions'

describe('labels', () => {
  it('spells the bid the way every bid surface does', () => {
    expect(bidHandoffLabel({ bidNumber: '398', projectName: ' ZZ Test ' })).toBe('B398 · ZZ Test')
    expect(bidHandoffLabel({ bidNumber: null, projectName: 'ZZ Test' })).toBe('ZZ Test')
    expect(bidHandoffLabel({ bidNumber: '', projectName: '' })).toBe('this bid')
  })
  it('the title is the to-do, with the winning GC when known', () => {
    expect(wonHandoffTitle({ bidNumber: '398', projectName: 'ZZ Test', gcName: 'Southern Post Construction' })).toBe(
      'Open the job for B398 · ZZ Test — won with Southern Post Construction',
    )
    expect(wonHandoffTitle({ bidNumber: '398', projectName: 'ZZ Test', gcName: null })).toBe('Open the job for B398 · ZZ Test — marked Won')
  })
  it('the reference carries the address when there is one', () => {
    expect(wonHandoffReference({ bidNumber: '398', projectName: 'ZZ Test', address: '12925 FM 20' })).toBe('B398 · ZZ Test — 12925 FM 20')
    expect(wonHandoffReference({ bidNumber: '398', projectName: 'ZZ Test', address: '  ' })).toBe('B398 · ZZ Test')
  })
  it('the close note names the J number, and says elsewhere when the inbox only found it', () => {
    expect(wonHandoffClosedNote({ hcpNumber: '1007', bidLabel: 'B398 · ZZ Test', elsewhere: false })).toBe('J1007 opened from B398 · ZZ Test')
    expect(wonHandoffClosedNote({ hcpNumber: 'J1007', bidLabel: 'B398', elsewhere: true })).toBe('J1007 was opened from B398 elsewhere — nothing left to do')
    expect(wonHandoffClosedNote({ hcpNumber: '', bidLabel: 'B398', elsewhere: false })).toBe('A job opened from B398')
  })
  it('the asked chip reads who and how long ago', () => {
    const now = Date.parse('2026-09-07T20:00:00Z')
    expect(dispatchAskedLabel({ senderName: 'Wendi', createdAtIso: '2026-09-07T19:58:00Z', nowMs: now })).toBe('Dispatch asked · by Wendi · 2 min ago')
    expect(dispatchAskedLabel({ senderName: null, createdAtIso: '2026-09-07T19:59:50Z', nowMs: now })).toBe('Dispatch asked · just now')
    expect(dispatchAskedLabel({ senderName: 'Marcus', createdAtIso: '2026-09-07T14:00:00Z', nowMs: now })).toBe('Dispatch asked · by Marcus · 6 h ago')
    expect(dispatchAskedLabel({ senderName: 'Marcus', createdAtIso: '2026-09-06T20:00:00Z', nowMs: now })).toBe('Dispatch asked · by Marcus · yesterday')
    expect(dispatchAskedLabel({ senderName: 'Marcus', createdAtIso: null })).toBe('Dispatch asked · by Marcus')
  })
})

describe('decideWonHandoff', () => {
  it('a job already on the bid beats an open request; an open request means already asked', () => {
    expect(decideWonHandoff({ existingJobHcp: '1007', existingOpenRequestId: 'r1', bidLabel: 'B398' })).toEqual({
      action: 'has-job',
      message: 'J1007 was already opened from B398 — nothing to ask Dispatch for.',
    })
    expect(decideWonHandoff({ existingJobHcp: null, existingOpenRequestId: 'r1', bidLabel: 'B398' }).action).toBe('already-asked')
    expect(decideWonHandoff({ existingJobHcp: '', existingOpenRequestId: null, bidLabel: 'B398' })).toEqual({ action: 'send' })
  })
})

describe('who sends, and when it sends itself', () => {
  it('roles with the New Job door get the button; primary gets the automatic send; the rest nothing', () => {
    for (const role of ['dev', 'master_technician', 'assistant', 'controller', 'estimator']) expect(wonHandoffMode(role)).toBe('button')
    expect(wonHandoffMode('primary')).toBe('auto')
    for (const role of ['superintendent', 'subcontractor', 'helpers', null, undefined]) expect(wonHandoffMode(role)).toBe('none')
  })
  it('auto-sends only on the transition INTO won, only for the auto role', () => {
    expect(shouldAutoAskDispatchOnWon({ role: 'primary', previousOutcome: null, nextOutcome: 'won' })).toBe(true)
    expect(shouldAutoAskDispatchOnWon({ role: 'primary', previousOutcome: 'lost', nextOutcome: 'won' })).toBe(true)
    expect(shouldAutoAskDispatchOnWon({ role: 'primary', previousOutcome: 'won', nextOutcome: 'won' })).toBe(false)
    expect(shouldAutoAskDispatchOnWon({ role: 'primary', previousOutcome: null, nextOutcome: 'lost' })).toBe(false)
    expect(shouldAutoAskDispatchOnWon({ role: 'estimator', previousOutcome: null, nextOutcome: 'won' })).toBe(false)
  })
})

describe('the inbox sweep', () => {
  const rows = [
    { id: 'r1', status: 'open' as const, pending_action: OPEN_JOB_FROM_BID_ACTION, bid_id: 'b1' },
    { id: 'r2', status: 'open' as const, pending_action: OPEN_JOB_FROM_BID_ACTION, bid_id: 'b2' },
    { id: 'r3', status: 'closed' as const, pending_action: OPEN_JOB_FROM_BID_ACTION, bid_id: 'b3' },
    { id: 'r4', status: 'open' as const, pending_action: 'link_job_pictures', bid_id: null },
    { id: 'r5', status: 'open' as const, pending_action: OPEN_JOB_FROM_BID_ACTION, bid_id: 'b1' },
  ]
  it('looks up only the bids behind open open-job rows, once each', () => {
    expect(bidIdsForOpenJobSweep(rows)).toEqual(['b1', 'b2'])
  })
  it('closes per bid where a job now carries the bid', () => {
    const jobs = new Map([['b1', { hcpNumber: '1007' }]])
    expect(pickOpenJobRequestsToClose(rows, jobs)).toEqual([{ bidId: 'b1', hcpNumber: '1007' }])
    expect(pickOpenJobRequestsToClose(rows, new Map())).toEqual([])
  })
})
