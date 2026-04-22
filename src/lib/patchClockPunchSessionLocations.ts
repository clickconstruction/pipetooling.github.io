import type { SupabaseClient } from '@supabase/supabase-js'
import { withSupabaseRetry } from '../utils/errorHandling'
import { resolveClockPunchCoordinates } from './resolveClockPunchCoordinates'

export function scheduleClockInLocationPatch(supabase: SupabaseClient, sessionId: string): void {
  void patchClockInLocation(supabase, sessionId)
}

async function patchClockInLocation(supabase: SupabaseClient, sessionId: string): Promise<void> {
  const punch = await resolveClockPunchCoordinates(supabase)
  if (!punch) return
  try {
    await withSupabaseRetry(
      async () =>
        supabase
          .from('clock_sessions')
          .update({
            clock_in_lat: punch.lat,
            clock_in_lng: punch.lng,
            clock_in_location_source: punch.source,
          })
          .eq('id', sessionId),
      'patch clock in location',
    )
  } catch {
    /* non-fatal: row already saved without coordinates */
  }
}

export function scheduleClockOutLocationPatch(supabase: SupabaseClient, sessionId: string): void {
  void patchClockOutLocation(supabase, sessionId)
}

async function patchClockOutLocation(supabase: SupabaseClient, sessionId: string): Promise<void> {
  const punch = await resolveClockPunchCoordinates(supabase)
  if (!punch) return
  try {
    await withSupabaseRetry(
      async () =>
        supabase
          .from('clock_sessions')
          .update({
            clock_out_lat: punch.lat,
            clock_out_lng: punch.lng,
            clock_out_location_source: punch.source,
          })
          .eq('id', sessionId),
      'patch clock out location',
    )
  } catch {
    /* non-fatal */
  }
}

export function scheduleUpdateFocusLocationPatches(
  supabase: SupabaseClient,
  closedSessionId: string,
  newSessionId: string,
): void {
  void patchUpdateFocusLocations(supabase, closedSessionId, newSessionId)
}

async function patchUpdateFocusLocations(
  supabase: SupabaseClient,
  closedSessionId: string,
  newSessionId: string,
): Promise<void> {
  const punch = await resolveClockPunchCoordinates(supabase)
  if (!punch) return
  try {
    await Promise.all([
      withSupabaseRetry(
        async () =>
          supabase
            .from('clock_sessions')
            .update({
              clock_out_lat: punch.lat,
              clock_out_lng: punch.lng,
              clock_out_location_source: punch.source,
            })
            .eq('id', closedSessionId),
        'patch update focus clock out location',
      ),
      withSupabaseRetry(
        async () =>
          supabase
            .from('clock_sessions')
            .update({
              clock_in_lat: punch.lat,
              clock_in_lng: punch.lng,
              clock_in_location_source: punch.source,
            })
            .eq('id', newSessionId),
        'patch update focus clock in location',
      ),
    ])
  } catch {
    /* non-fatal */
  }
}
