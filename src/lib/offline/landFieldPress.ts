import { DatabaseError, databaseErrorFromResult, errorKindOf, formatErrorMessage, OperationTimeoutError, withOperationTimeout, type SupabaseResultError } from '../../utils/errorHandling'
import { failureQueues, type BidPhotosPayload, type CounterTicketPayload, type ChecklistSignPayload, type ClockInPayload, type ClockOutPayload, type FieldReportPayload, type JobNotePayload, type JobPhotosPayload, type OutboxKind, type OutboxPress, type OutboxRefusal, type TaskPhotoPayload } from './outbox'

/**
 * The send (punch list #163 PR 2): one press to the `land_field_press` RPC, which takes the
 * phone-minted id, the kind, the pressed time and the payload, does the write under the caller's
 * own policies and answers the first landing's result again on a repeat. The outcome is classed,
 * never read from message text: landed, refused (the server answered no, with its reason), or
 * failed (the fetch layer, or a timeout whose request may still land: the next try carries the
 * same id, so it counts once either way).
 */

export type LandOutcome = { kind: 'landed'; result: unknown } | { kind: 'refused'; refusal: OutboxRefusal } | { kind: 'failed'; error: unknown }

/** A punch's deadline, the clock's own (`CLOCK_PUNCH_TIMEOUT_MS` in `ClockInOutButton`). */
export const LAND_TIMEOUT_MS = 15_000

/** The RPC's kind names (snake case, the database's). */
export const RPC_KIND: Record<OutboxKind, string> = {
  'clock-in': 'clock_in',
  'clock-out': 'clock_out',
  'job-note': 'job_note',
  'field-report': 'field_report',
  /** Never sent to the RPC: a job photos press lands through the table's own policies (`landJobPhotos`). */
  'job-photos': 'job_photos',
  /** Never sent to the RPC either: a signed checklist answer lands through the table's own policies and lock (`landChecklistSign`). */
  'checklist-sign': 'checklist_sign',
  /** Never sent to the RPC: the replay sent the row itself, and landing ties a finishing shot to its line (`landTaskPhoto`). */
  'task-photo': 'task_photo',
  /** Never sent to the RPC: a counter ticket lands through its table's own policies and guard (`landCounterTicket`). */
  'counter-ticket': 'counter_ticket',
  /** Never sent to the RPC: a bid photos press lands through the table's own policies (`landBidPhotos`). */
  'bid-photos': 'bid_photos',
}

/** The press's payload as the RPC reads it. */
export function rpcPayload(press: OutboxPress): Record<string, unknown> {
  switch (press.kind) {
    case 'clock-in': {
      const p = press.payload as ClockInPayload
      return { job_ledger_id: p.jobLedgerId, bid_id: p.bidId, notes: p.notes, travel: p.travel }
    }
    case 'clock-out': {
      const p = press.payload as ClockOutPayload
      return { session_id: p.sessionId, session_press_id: p.sessionPressId, job_ledger_id: p.jobLedgerId, bid_id: p.bidId, notes: p.notes }
    }
    case 'job-note': {
      const p = press.payload as JobNotePayload
      return { job_id: p.jobId, body: p.body }
    }
    case 'field-report': {
      const p = press.payload as FieldReportPayload
      return { template_id: p.templateId, field_values: p.fieldValues, job_ledger_id: p.jobLedgerId, project_id: p.projectId, bid_id: p.bidId, lat: p.lat, lng: p.lng }
    }
    case 'job-photos': {
      const p = press.payload as JobPhotosPayload
      return { job_ledger_id: p.jobLedgerId, photo_ids: p.photos.map((ph) => ph.id) }
    }
    case 'checklist-sign': {
      const p = press.payload as ChecklistSignPayload
      return { job_id: p.jobId, fixture_id: p.fixtureId, question_id: p.questionId, pick: p.pick }
    }
    case 'task-photo': {
      const p = press.payload as TaskPhotoPayload
      return { instance_id: p.instanceId, photo_ids: p.photos.map((ph) => ph.id) }
    }
    case 'counter-ticket': {
      const p = press.payload as CounterTicketPayload
      return { ticket_id: p.ticketId, job_id: p.jobId, page_ids: p.photos.map((ph) => ph.id) }
    }
    case 'bid-photos': {
      const p = press.payload as BidPhotosPayload
      return { bid_id: p.bidId, photo_ids: p.photos.map((ph) => ph.id) }
    }
  }
}

export type LandTaskPhotoIo = {
  attach?: (instanceId: string, criterionId: string, photoId: string) => Promise<unknown>
}

/**
 * A task photo press lands without the RPC (punch list #273, v2.6628): its row already exists under the phone-minted
 * id (the replay sent the shot's bytes and row first, `sendKeptPhotos`, the same upsert every try), so what is left is
 * what the sheet does live after the send: a finishing shot that proves a Done when… line is written onto that line's
 * tick (`attachPhotoToTick`, the same update twice is the same row). A progress shot or a finish with no line needs
 * nothing more. The outcome is classed as any press's: a lost signal or a timeout fails and waits, a refusal keeps the
 * server's reason.
 */
export async function landTaskPhoto(press: OutboxPress, io: LandTaskPhotoIo = {}): Promise<LandOutcome> {
  try {
    const p = press.payload as TaskPhotoPayload
    const proving = p.photos.filter((ph) => ph.sent && ph.criterionId)
    if (proving.length > 0) {
      const attach = io.attach ?? (await import('../photos/taskPhotosIo')).attachPhotoToTick
      await withOperationTimeout(Promise.all(proving.map((ph) => attach(p.instanceId, ph.criterionId!, ph.id))), LAND_TIMEOUT_MS, 'Add the photo')
    }
    return { kind: 'landed', result: { instance_id: p.instanceId, photo_ids: p.photos.filter((ph) => ph.sent).map((ph) => ph.id) } }
  } catch (e) {
    return outcomeOfFailure(e)
  }
}

export type LandCounterTicketIo = {
  row?: (press: OutboxPress) => Promise<unknown>
  land?: (ticketId: string) => Promise<unknown>
}

/**
 * A counter ticket lands without the RPC (punch list #295, PR 2): the replay sent its row and its pages first
 * (`sendKeptPhotos`), so what is left is the Save press itself, `added_at` on a row that has none, under the table's
 * own policies. The row is written again first, the same write on every try, so a ticket whose every page was lost
 * with the phone's data still lands as a ticket with no page rather than vanishing. A repeat changes nothing and
 * counts once. The outcome is classed as any press's.
 */
export async function landCounterTicket(press: OutboxPress, io: LandCounterTicketIo = {}): Promise<LandOutcome> {
  try {
    const p = press.payload as CounterTicketPayload
    const run = async () => {
      if (io.row) await io.row(press)
      else {
        const [{ sendTicketRow }, { ticketDraftOf }] = await Promise.all([import('../tickets/ticketsIo'), import('./keptPhotos')])
        await sendTicketRow(ticketDraftOf(press))
      }
      const land = io.land ?? (await import('../tickets/ticketsIo')).landTicket
      return land(p.ticketId)
    }
    const result = await withOperationTimeout(run(), LAND_TIMEOUT_MS, 'Save the ticket')
    return { kind: 'landed', result: { ticket_id: p.ticketId, ...(result && typeof result === 'object' ? result : {}) } }
  } catch (e) {
    return outcomeOfFailure(e)
  }
}

export type LandChecklistSignIo = {
  sign?: (input: ChecklistSignPayload & { signedAt: string }, who: { userId: string; name: string }) => Promise<unknown>
}

/**
 * A signed checklist answer lands without the RPC (punch list #237, PR 2): the same write the sheet makes online,
 * `signAnswer`, under the table's own policies and the lock trigger, with the press's time as the signed time. A row
 * the first try already signed with this hash by this signer is answered as it stands, so a repeat counts once. The
 * outcome is classed as any press's: a lost signal or a timeout fails and waits, a refusal keeps the server's reason.
 */
export async function landChecklistSign(press: OutboxPress, io: LandChecklistSignIo = {}): Promise<LandOutcome> {
  try {
    const sign = io.sign ?? (await import('../jobs/stageChecklistSheetIo')).signAnswer
    const p = press.payload as ChecklistSignPayload
    const result = await withOperationTimeout(sign({ ...p, signedAt: new Date(press.pressedAt).toISOString() }, { userId: press.userId, name: p.byName }), LAND_TIMEOUT_MS, 'Sign the answer')
    return { kind: 'landed', result: result ?? {} }
  } catch (e) {
    return outcomeOfFailure(e)
  }
}

export type LandJobPhotosIo = {
  land?: (writes: ReadonlyArray<{ id: string; description: string; fixtureId: string | null; stageName: string | null; caption: string }>) => Promise<unknown>
}

/**
 * A job photos press lands without the RPC (punch list #244, PR 5): its rows already exist under the phone-minted
 * ids (the replay sent each kept shot's bytes and row first, `sendKeptPhotos`), so landing is the same update the
 * window makes online, the words, the stage, the caption and `added_at` on each sent row, under the table's own
 * policies; a row added by an earlier try is left as it is, so a repeat counts once. The outcome is classed as any
 * press's: a lost signal or a timeout fails and waits, a refusal keeps the server's reason.
 */
export async function landJobPhotos(press: OutboxPress, io: LandJobPhotosIo = {}): Promise<LandOutcome> {
  try {
    const land = io.land ?? (await import('../photos/jobPhotoNotesIo')).landJobPhotoNotes
    const p = press.payload as JobPhotosPayload
    const writes = p.photos.filter((ph) => ph.sent).map((ph) => ({ id: ph.id, description: ph.description, fixtureId: ph.fixtureId, stageName: ph.stageName, caption: ph.caption }))
    const result = await withOperationTimeout(land(writes), LAND_TIMEOUT_MS, 'Add photos')
    return { kind: 'landed', result: result ?? {} }
  } catch (e) {
    return outcomeOfFailure(e)
  }
}

export type LandBidPhotosIo = {
  land?: (writes: ReadonlyArray<{ id: string; name: string }>) => Promise<unknown>
}

/**
 * A bid photos press lands without the RPC (punch list #306, PR 8): its rows already exist under the phone-minted ids
 * (the replay sent each kept shot's bytes and row first, `sendKeptPhotos`), so landing is the same update the window
 * makes online, the name and `added_at` on each sent row, under the table's own policies; a row an earlier try added
 * is left as it is, so a repeat counts once and the sweep never files a photo twice. A shot whose bytes were lost
 * with the phone's data is off the press by now, and the rest still land. The outcome is classed as any press's: a
 * lost signal or a timeout fails and waits, a refusal keeps the server's reason.
 */
export async function landBidPhotos(press: OutboxPress, io: LandBidPhotosIo = {}): Promise<LandOutcome> {
  try {
    const land = io.land ?? (await import('../bids/bidPhotosIo')).landBidPhotoRows
    const p = press.payload as BidPhotosPayload
    const writes = p.photos.filter((ph) => ph.sent).map((ph) => ({ id: ph.id, name: ph.name }))
    const result = await withOperationTimeout(land(writes), LAND_TIMEOUT_MS, 'Add photos')
    return { kind: 'landed', result: { bid_id: p.bidId, ...(result && typeof result === 'object' ? result : {}) } }
  } catch (e) {
    return outcomeOfFailure(e)
  }
}

function online(): boolean {
  return typeof navigator === 'undefined' || typeof navigator.onLine !== 'boolean' ? true : navigator.onLine
}

/** Class a thrown value or a result error into the press's outcome. */
export function outcomeOfFailure(error: unknown): LandOutcome {
  const timedOut = error instanceof OperationTimeoutError
  if (failureQueues({ kind: errorKindOf(error), timedOut, online: online() })) return { kind: 'failed', error }
  const code = error && typeof error === 'object' ? (error as { code?: unknown }).code : null
  // The server's own sentence (a RAISE EXCEPTION's text) leads; the formatter's "Failed to send press:" prefix is for logs.
  const server = error instanceof DatabaseError ? error.serverMessage?.trim() : null
  return { kind: 'refused', refusal: { message: server || formatErrorMessage(error, 'The office could not take that press.'), code: typeof code === 'string' ? code : null } }
}

export async function landFieldPress(press: OutboxPress): Promise<LandOutcome> {
  if (press.kind === 'job-photos') return landJobPhotos(press)
  if (press.kind === 'checklist-sign') return landChecklistSign(press)
  if (press.kind === 'task-photo') return landTaskPhoto(press)
  if (press.kind === 'counter-ticket') return landCounterTicket(press)
  if (press.kind === 'bid-photos') return landBidPhotos(press)
  try {
    // The client is read here, not at import, so the kernels that take this send as a default load without it (a test, a worker).
    const { supabase } = await import('../supabase')
    const { data, error, status } = await withOperationTimeout(
      supabase.rpc('land_field_press' as never, {
        p_id: press.id,
        p_kind: RPC_KIND[press.kind],
        p_pressed_at: new Date(press.pressedAt).toISOString(),
        p_payload: rpcPayload(press),
      } as never) as unknown as Promise<{ data: unknown; error: SupabaseResultError | null; status?: number }>,
      LAND_TIMEOUT_MS,
      'Send press',
    )
    // A result error becomes the app's `DatabaseError`, so its class (network / server) is decided by code and status, never by text.
    if (error) return outcomeOfFailure(databaseErrorFromResult(error, 'send press', status))
    return { kind: 'landed', result: data ?? {} }
  } catch (e) {
    return outcomeOfFailure(e)
  }
}
