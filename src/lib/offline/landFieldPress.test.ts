import { describe, expect, it } from 'vitest'
import { DatabaseError, OperationTimeoutError } from '../../utils/errorHandling'
import { newPress } from './outbox'
import { RPC_KIND, outcomeOfFailure, rpcPayload } from './landFieldPress'

const T = 1_780_000_000_000

describe('landFieldPress · the press as the RPC reads it', () => {
  it('names the four kinds in the database’s words', () => {
    expect(RPC_KIND).toEqual({ 'clock-in': 'clock_in', 'clock-out': 'clock_out', 'job-note': 'job_note', 'field-report': 'field_report' })
  })

  it('maps each payload to snake case, every column the RPC reads', () => {
    expect(rpcPayload(newPress({ id: 'a', seq: 1, kind: 'clock-in', userId: 'u', pressedAt: T, payload: { jobLedgerId: 'j', bidId: null, notes: 'Rough in', travel: 'on-site' } }))).toEqual({
      job_ledger_id: 'j',
      bid_id: null,
      notes: 'Rough in',
      travel: 'on-site',
    })
    expect(rpcPayload(newPress({ id: 'b', seq: 2, kind: 'clock-out', userId: 'u', pressedAt: T, payload: { sessionId: null, sessionPressId: 'a', jobLedgerId: 'j', bidId: null, notes: '' } }))).toEqual({
      session_id: null,
      session_press_id: 'a',
      job_ledger_id: 'j',
      bid_id: null,
      notes: '',
    })
    expect(rpcPayload(newPress({ id: 'c', seq: 3, kind: 'job-note', userId: 'u', pressedAt: T, payload: { jobId: 'j', body: 'Slab is poured.' } }))).toEqual({ job_id: 'j', body: 'Slab is poured.' })
    expect(
      rpcPayload(
        newPress({
          id: 'd',
          seq: 4,
          kind: 'field-report',
          userId: 'u',
          pressedAt: T,
          payload: { templateId: 't', fieldValues: { 'Percent complete': '40' }, jobLedgerId: 'j', projectId: null, bidId: null, lat: 30.1, lng: -97.2, movedLines: [{ fixtureId: 'f1', to: 40 }] },
        }),
      ),
    ).toEqual({ template_id: 't', field_values: { 'Percent complete': '40' }, job_ledger_id: 'j', project_id: null, bid_id: null, lat: 30.1, lng: -97.2 })
  })
})

describe('landFieldPress · the outcome of a failure, by class', () => {
  it('a fetch-layer failure and a timeout are failed, kept for the next try', () => {
    expect(outcomeOfFailure(new TypeError('Load failed')).kind).toBe('failed')
    expect(outcomeOfFailure(new OperationTimeoutError('Send press', 15_000)).kind).toBe('failed')
  })

  it('a refusal keeps the server’s own sentence and its code, never the log prefix', () => {
    const error = new DatabaseError('Failed to send press: The office closed that session at 8:05 AM.', 'P0001', undefined, {
      kind: 'server',
      status: 400,
      operationName: 'send press',
      serverMessage: 'The office closed that session at 8:05 AM.',
    })
    expect(outcomeOfFailure(error)).toEqual({ kind: 'refused', refusal: { message: 'The office closed that session at 8:05 AM.', code: 'P0001' } })
  })
})
