import { supabase } from './supabase'
import { formatErrorMessage, withSupabaseRetry } from '../utils/errorHandling'

export type PayStaffBulkTimeOffRowError = { user_id: string; message: string }

export type PayStaffBulkTimeOffResult = {
  error?: string
  inserted: string[]
  failed: PayStaffBulkTimeOffRowError[]
  sync_failed: PayStaffBulkTimeOffRowError[]
}

function isRowError(x: unknown): x is PayStaffBulkTimeOffRowError {
  if (typeof x !== 'object' || x === null) return false
  const o = x as Record<string, unknown>
  return typeof o.user_id === 'string' && typeof o.message === 'string'
}

/** Normalizes RPC jsonb payload; safe on partial/malformed responses. */
export function parsePayStaffBulkTimeOffResult(data: unknown): PayStaffBulkTimeOffResult {
  const empty: PayStaffBulkTimeOffResult = { inserted: [], failed: [], sync_failed: [] }
  if (data === null || typeof data !== 'object') return empty
  const o = data as Record<string, unknown>
  const error = typeof o.error === 'string' ? o.error : undefined

  const inserted: string[] = []
  if (Array.isArray(o.inserted)) {
    for (const item of o.inserted) {
      if (typeof item === 'string') inserted.push(item)
    }
  }

  const failed: PayStaffBulkTimeOffRowError[] = []
  if (Array.isArray(o.failed)) {
    for (const item of o.failed) {
      if (isRowError(item)) failed.push(item)
    }
  }

  const sync_failed: PayStaffBulkTimeOffRowError[] = []
  if (Array.isArray(o.sync_failed)) {
    for (const item of o.sync_failed) {
      if (isRowError(item)) sync_failed.push(item)
    }
  }

  return { error, inserted, failed, sync_failed }
}

export async function payStaffBulkInsertUserTimeOff(params: {
  userIds: string[]
  startDate: string
  endDate: string
  note: string | null
}): Promise<PayStaffBulkTimeOffResult> {
  try {
    const data = await withSupabaseRetry(
      async () =>
        supabase.rpc('pay_staff_bulk_insert_user_time_off', {
          p_user_ids: params.userIds,
          p_start_date: params.startDate,
          p_end_date: params.endDate,
          p_note: params.note ?? undefined,
        }),
      'pay_staff_bulk_insert_user_time_off',
    )
    if (data === null) {
      return {
        error: 'Empty response from server',
        inserted: [],
        failed: [],
        sync_failed: [],
      }
    }
    return parsePayStaffBulkTimeOffResult(data)
  } catch (e) {
    return {
      error: formatErrorMessage(e, 'Bulk time off failed'),
      inserted: [],
      failed: [],
      sync_failed: [],
    }
  }
}
