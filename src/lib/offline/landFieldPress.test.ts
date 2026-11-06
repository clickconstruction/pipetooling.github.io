import { describe, expect, it } from 'vitest'
import { DatabaseError, OperationTimeoutError } from '../../utils/errorHandling'
import { newPress } from './outbox'
import { RPC_KIND, landJobPhotos, outcomeOfFailure, rpcPayload } from './landFieldPress'

const T = 1_780_000_000_000

describe('landFieldPress · the press as the RPC reads it', () => {
  it('names the kinds in the database’s words', () => {
    expect(RPC_KIND).toEqual({ 'clock-in': 'clock_in', 'clock-out': 'clock_out', 'job-note': 'job_note', 'field-report': 'field_report', 'job-photos': 'job_photos', 'checklist-sign': 'checklist_sign' })
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

// Punch list #244, PR 5: a job photos press lands through the table, not the RPC.
describe('landJobPhotos', () => {
  const photo = (id: string, sent: boolean) => ({ id, sent, fixtureId: 'f1', stageName: 'Rough In', caption: 'Meter location', description: 'Meter location, behind the east fence gate', questionId: null, questionWords: null, takenAt: '2026-11-02T20:41:00Z', bytes: 1, originalBytes: 1, width: 1, height: 1, byName: 'Carla Nguyen' })
  const press = newPress({ id: 'jp', seq: 1, kind: 'job-photos', userId: 'u', pressedAt: T, payload: { jobLedgerId: 'j1', photos: [photo('a', true), photo('b', false)] } })

  it('names the kind and the ids for the record, and lands only the sent photos with their words', async () => {
    expect(rpcPayload(press)).toEqual({ job_ledger_id: 'j1', photo_ids: ['a', 'b'] })
    const landed: unknown[] = []
    const out = await landJobPhotos(press, {
      land: async (writes) => {
        landed.push(...writes)
        return { added: writes.length }
      },
    })
    expect(out).toEqual({ kind: 'landed', result: { added: 1 } })
    expect(landed).toEqual([{ id: 'a', description: 'Meter location, behind the east fence gate', fixtureId: 'f1', stageName: 'Rough In', caption: 'Meter location' }])
  })

  it('a lost signal fails and waits; a refusal keeps the server’s reason', async () => {
    const failed = await landJobPhotos(press, { land: async () => Promise.reject(new TypeError('Failed to fetch')) })
    expect(failed.kind).toBe('failed')
    const refused = await landJobPhotos(press, { land: async () => Promise.reject(new DatabaseError('Failed to add photos: The job is not one you can see.', '42501', undefined, { kind: 'server', status: 403, operationName: 'add photos', serverMessage: 'The job is not one you can see.' })) })
    expect(refused.kind).toBe('refused')
  })
})
