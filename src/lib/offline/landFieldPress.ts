import { supabase } from '../supabase'
import { databaseErrorFromResult, errorKindOf, formatErrorMessage, OperationTimeoutError, withOperationTimeout, type SupabaseResultError } from '../../utils/errorHandling'
import { failureQueues, type ClockInPayload, type ClockOutPayload, type FieldReportPayload, type JobNotePayload, type OutboxKind, type OutboxPress, type OutboxRefusal } from './outbox'

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
  return { kind: 'refused', refusal: { message: formatErrorMessage(error, 'The office could not take that press.'), code: typeof code === 'string' ? code : null } }
}

export async function landFieldPress(press: OutboxPress): Promise<LandOutcome> {
  try {
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
