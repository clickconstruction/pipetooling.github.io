/**
 * Job Mode's **On my way** and **I'm here** (v2.5573, punch list #112): what the two sheets read and write
 * (`lib/jobMode/onMyWay.ts` is the kernel). One interface, so the smokes hand it a fake; one implementation on the
 * app's client. The reads are the message sheet's (`jobModeMessageCustomerIo.ts`: the customer, the phone's lines, the
 * tech's blocks, the send) plus the texts switch, which line each press holds (read apart, fail-soft, until the
 * migration is pushed), the job's point from `address_geocodes` (open to every signed-in user since v2.3131), the
 * phone's own point, the open session's two stamps
 * and the arrival's stamp. The clock-in itself goes through the Dashboard's bridge (`applyUpdateFocusDirect`), which
 * the card hands the sheet.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import { supabase } from './supabase'
import type { Database } from '../types/database'
import { checkSupabaseError } from '../utils/errorHandling'
import { isNotThereYetError } from './gcWordAskIo'
import { phonePressOf } from './quickReplies/press'
import type { PhoneLine } from './quickReplies/phone'
import type { LatLng } from './jobTravelEstimate'
import { supabaseJobModeMessageIo, type JobModeMessageIo } from './jobModeMessageCustomerIo'
import { normalizeAddressForGeocodeKey } from './map/normalizeAddressForGeocode'
import { resolveClockPunchCoordinates } from './resolveClockPunchCoordinates'
import { scheduleArrivedLocationPatch } from './patchClockPunchSessionLocations'
import { supabaseTextsSwitchIo } from './quo/textsSwitchIo'
import type { TravelFacts } from './jobMode/onMyWay'

export interface OnMyWayIo extends JobModeMessageIo {
  /** Settings → Phone and texts → Send texts. A read that fails reads off, so nothing is promised. */
  loadTextsOn(): Promise<boolean>
  /** The phone's lines with the big button each holds. A client ahead of the push reads the lines with no press. */
  loadPressLines(): Promise<PhoneLine[]>
  /** The point the map geocoded for the job's address, or null when it was never placed. */
  loadJobPoint(address: string | null): Promise<LatLng | null>
  /** The phone's own point, GPS only: an IP point is too coarse to guess a drive from. */
  loadMyPoint(): Promise<LatLng | null>
  /** The open session's two stamps; null when the row has none yet, or the push is not in. */
  loadTravelFacts(sessionId: string): Promise<TravelFacts | null>
  /** Stamps the arrival on the tech's own open session and patches the phone's point after. False when no row took it. */
  arrive(sessionId: string): Promise<boolean>
}

export function supabaseOnMyWayIo(client: unknown = supabase): OnMyWayIo {
  const db = client as SupabaseClient
  const base = supabaseJobModeMessageIo(client)
  return {
    ...base,
    async loadTextsOn() {
      try {
        return await supabaseTextsSwitchIo(client as SupabaseClient<Database>).load()
      } catch {
        return false
      }
    },
    async loadPressLines() {
      const [lines, presses] = await Promise.all([base.loadLines(), db.from('quick_replies').select('id, phone_press')])
      if (presses.error) {
        if (!isNotThereYetError(presses.error)) checkSupabaseError(presses, 'read the phone’s big buttons')
        return lines
      }
      const pressOf = new Map(((presses.data ?? []) as Array<{ id: string; phone_press: string | null }>).map((r) => [r.id, phonePressOf(r.phone_press)]))
      return lines.map((l) => ({ ...l, phonePress: pressOf.get(l.id) ?? null }))
    },
    async loadJobPoint(address) {
      const key = normalizeAddressForGeocodeKey(address ?? '')
      if (key.length < 3) return null
      const result = await db.from('address_geocodes').select('lat, lng').eq('address_normalized', key).is('geocode_error', null).limit(1).maybeSingle()
      if (result.error) return null
      const row = result.data as { lat: number; lng: number } | null
      return row && Number.isFinite(row.lat) && Number.isFinite(row.lng) ? { lat: row.lat, lng: row.lng } : null
    },
    async loadMyPoint() {
      const punch = await resolveClockPunchCoordinates(db)
      return punch && punch.source === 'gps' ? { lat: punch.lat, lng: punch.lng } : null
    },
    async loadTravelFacts(sessionId) {
      const result = await db.from('clock_sessions').select('travel_started_at, arrived_at').eq('id', sessionId).maybeSingle()
      if (result.error) return null
      const row = result.data as { travel_started_at: string | null; arrived_at: string | null } | null
      return row ? { travelStartedAt: row.travel_started_at ?? null, arrivedAt: row.arrived_at ?? null } : null
    },
    async arrive(sessionId) {
      const result = await db
        .from('clock_sessions')
        .update({ arrived_at: new Date().toISOString() } as never)
        .eq('id', sessionId)
        .is('arrived_at', null)
        .select('id')
      checkSupabaseError(result, 'mark you on site')
      const took = ((result.data ?? []) as Array<{ id: string }>).length > 0
      if (took) scheduleArrivedLocationPatch(db, sessionId)
      return took
    },
  }
}
