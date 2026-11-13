import { describe, expect, it } from 'vitest'
import { DatabaseError, OperationTimeoutError } from '../../utils/errorHandling'
import { newPress } from './outbox'
import { RPC_KIND, landBidPhotos, landCounterTicket, landJobPhotos, landTaskPhoto, outcomeOfFailure, rpcPayload } from './landFieldPress'

const T = 1_780_000_000_000

describe('landFieldPress · the press as the RPC reads it', () => {
  it('names the kinds in the database’s words', () => {
    expect(RPC_KIND).toEqual({ 'clock-in': 'clock_in', 'clock-out': 'clock_out', 'job-note': 'job_note', 'field-report': 'field_report', 'job-photos': 'job_photos', 'checklist-sign': 'checklist_sign', 'task-photo': 'task_photo', 'counter-ticket': 'counter_ticket', 'bid-photos': 'bid_photos' })
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

// Punch list #306, PR 8: a bid photos press lands without the RPC, as the window's own update on each sent row.
describe('landBidPhotos', () => {
  const shot = (id: string, sent: boolean, name = 'Meter bank') => ({ id, sent, name, takenAt: '2026-11-12T20:41:00Z', bytes: 1, originalBytes: 1, width: 1, height: 1, byName: 'Dana Whitfield' })
  const press = newPress({ id: 'bp', seq: 1, kind: 'bid-photos', userId: 'u', pressedAt: T, payload: { bidId: 'b1', photos: [shot('a', true), shot('b', false), shot('c', true, '')] } })

  it('names the kind and the ids for the record, and lands only the sent shots, each with its name', async () => {
    expect(rpcPayload(press)).toEqual({ bid_id: 'b1', photo_ids: ['a', 'b', 'c'] })
    const landed: unknown[] = []
    const out = await landBidPhotos(press, {
      land: async (writes) => {
        landed.push(...writes)
        return { added: writes.length }
      },
    })
    // The result names the bid, so the board and an open window know whose photos landed.
    expect(out).toEqual({ kind: 'landed', result: { bid_id: 'b1', added: 2 } })
    expect(landed).toEqual([
      { id: 'a', name: 'Meter bank' },
      { id: 'c', name: '' },
    ])
  })

  it('a second landing that adds nothing still lands, so a repeat counts once', async () => {
    const out = await landBidPhotos(press, { land: async () => ({ added: 0 }) })
    expect(out).toEqual({ kind: 'landed', result: { bid_id: 'b1', added: 0 } })
  })

  it('a press whose every shot was lost with the phone’s data lands with nothing to write', async () => {
    const empty = newPress({ id: 'bp2', seq: 2, kind: 'bid-photos', userId: 'u', pressedAt: T, payload: { bidId: 'b1', photos: [] } })
    const writes: unknown[] = []
    const out = await landBidPhotos(empty, { land: async (w) => void writes.push(...w) })
    expect(out).toEqual({ kind: 'landed', result: { bid_id: 'b1' } })
    expect(writes).toEqual([])
  })

  it('a lost signal fails and waits; a refusal keeps the server’s reason', async () => {
    const failed = await landBidPhotos(press, { land: async () => Promise.reject(new TypeError('Failed to fetch')) })
    expect(failed.kind).toBe('failed')
    const refused = await landBidPhotos(press, { land: async () => Promise.reject(new DatabaseError('Failed to add photos: That bid is not one you can change.', '42501', undefined, { kind: 'server', status: 403, operationName: 'add photos', serverMessage: 'That bid is not one you can change.' })) })
    expect(refused).toEqual({ kind: 'refused', refusal: { message: 'That bid is not one you can change.', code: '42501' } })
  })
})

// Punch list #273, v2.6628: a task photo press lands without the RPC; a finishing shot is tied to its line.
describe('landTaskPhoto', () => {
  const shot = (id: string, sent: boolean, criterionId: string | null) => ({ id, sent, kind: 'finish' as const, percentAt: null, criterionId, lineBody: criterionId ? 'Fittings are in labeled bins' : null, takenAt: '2026-11-07T20:41:00Z', bytes: 1, originalBytes: 1, width: 1, height: 1, byName: 'Mateo Ruiz' })

  it('names the card and the ids for the record, and writes a sent proving shot onto its line’s tick', async () => {
    const press = newPress({ id: 'tp', seq: 1, kind: 'task-photo', userId: 'u', pressedAt: T, payload: { instanceId: 'inst-1', photos: [shot('a', true, 'c2')] } })
    expect(rpcPayload(press)).toEqual({ instance_id: 'inst-1', photo_ids: ['a'] })
    const attached: string[] = []
    const out = await landTaskPhoto(press, { attach: async (instanceId, criterionId, photoId) => void attached.push(`${instanceId}/${criterionId}/${photoId}`) })
    expect(out).toEqual({ kind: 'landed', result: { instance_id: 'inst-1', photo_ids: ['a'] } })
    expect(attached).toEqual(['inst-1/c2/a'])
  })

  it('a progress shot, or a finish on no line, lands with nothing to attach; an unsent shot is never attached', async () => {
    const press = newPress({ id: 'tp2', seq: 1, kind: 'task-photo', userId: 'u', pressedAt: T, payload: { instanceId: 'inst-1', photos: [{ ...shot('a', true, null), kind: 'progress', percentAt: 50 }, shot('b', false, 'c2')] } })
    const attached: string[] = []
    const out = await landTaskPhoto(press, { attach: async (...args) => void attached.push(args.join('/')) })
    expect(out).toEqual({ kind: 'landed', result: { instance_id: 'inst-1', photo_ids: ['a'] } })
    expect(attached).toEqual([])
  })

  it('a lost signal fails and waits; a refusal keeps the server’s reason', async () => {
    const press = newPress({ id: 'tp3', seq: 1, kind: 'task-photo', userId: 'u', pressedAt: T, payload: { instanceId: 'inst-1', photos: [shot('a', true, 'c2')] } })
    const failed = await landTaskPhoto(press, { attach: async () => Promise.reject(new TypeError('Failed to fetch')) })
    expect(failed.kind).toBe('failed')
    const refused = await landTaskPhoto(press, { attach: async () => Promise.reject(new DatabaseError('Failed to add the photo: Not your card.', '42501', undefined, { kind: 'server', status: 403, operationName: 'add the photo', serverMessage: 'Not your card.' })) })
    expect(refused.kind).toBe('refused')
  })
})

// Punch list #295, PR 2: a counter ticket lands without the RPC; the row is written again, then the Save press.
describe('landCounterTicket', () => {
  const page = (id: string, sent: boolean) => ({ id, sent, pageNo: 1, mime: 'image/jpeg', takenAt: '2026-11-04T16:02:00Z', bytes: 1, originalBytes: 1, width: 1, height: 1, byName: 'Jordan' })
  const payload = (photos: ReturnType<typeof page>[]) => ({ ticketId: 'tk-1', takenAt: '2026-11-04T16:02:00Z', takenAtFrom: 'press' as const, source: 'camera' as const, jobId: 'j1', alsoJobIds: [], noOneJob: false, poEntryId: null, total: null, note: '', byName: 'Jordan', photos })

  it('names the ticket, its job and its pages for the record, writes the row and then lands it', async () => {
    const press = newPress({ id: 'ct', seq: 1, kind: 'counter-ticket', userId: 'u', pressedAt: T, payload: payload([page('a', true)]) })
    expect(rpcPayload(press)).toEqual({ ticket_id: 'tk-1', job_id: 'j1', page_ids: ['a'] })
    const calls: string[] = []
    const out = await landCounterTicket(press, { row: async (p) => void calls.push(`row:${p.id}`), land: async (id) => (calls.push(`land:${id}`), { landed: 1 }) })
    expect(out).toEqual({ kind: 'landed', result: { ticket_id: 'tk-1', landed: 1 } })
    expect(calls).toEqual(['row:ct', 'land:tk-1'])
  })

  it('lands a ticket whose pages were lost with the phone, as a ticket with no page', async () => {
    const press = newPress({ id: 'ct2', seq: 1, kind: 'counter-ticket', userId: 'u', pressedAt: T, payload: payload([]) })
    const out = await landCounterTicket(press, { row: async () => undefined, land: async () => ({ landed: 1 }) })
    expect(out.kind).toBe('landed')
  })

  it('a lost signal fails and waits; a refusal keeps the server’s reason', async () => {
    const press = newPress({ id: 'ct3', seq: 1, kind: 'counter-ticket', userId: 'u', pressedAt: T, payload: payload([page('a', true)]) })
    const lost = await landCounterTicket(press, { row: async () => Promise.reject(new TypeError('Failed to fetch')) })
    expect(lost.kind).toBe('failed')
    const refused = await landCounterTicket(press, { row: async () => undefined, land: async () => Promise.reject(new DatabaseError('Failed to save the ticket: Your account is in training mode.', '42501', undefined, { kind: 'server', status: 403, operationName: 'save the ticket', serverMessage: 'Your account is in training mode.' })) })
    expect(refused).toEqual({ kind: 'refused', refusal: { message: 'Your account is in training mode.', code: '42501' } })
  })
})
