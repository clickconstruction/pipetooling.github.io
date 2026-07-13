/**
 * Office side of the Turnaway feature: resolving the per-reason default trip
 * charge amount from app_settings and the memo/closed-note text mirrored by
 * the create_turnaway_trip_charge RPC (migration 20260709130000).
 */

import { formatCurrency } from './format'
import { turnawayReasonLabel, type TurnawayReason } from './turnaway'
import {
  APP_SETTINGS_KEY_TRIP_CHARGE_CLIENT_NOT_HOME,
  APP_SETTINGS_KEY_TRIP_CHARGE_SITE_NOT_READY,
} from './appSettingsKeys'

/** Reasons that carry a billable trip charge ('other' has no fee category). */
export const BILLABLE_TURNAWAY_REASONS = ['client_not_home', 'site_not_ready'] as const
export type BillableTurnawayReason = (typeof BILLABLE_TURNAWAY_REASONS)[number]

export function isBillableTurnawayReason(
  reason: TurnawayReason | null | undefined,
): reason is BillableTurnawayReason {
  return reason === 'client_not_home' || reason === 'site_not_ready'
}

export function tripChargeSettingsKey(reason: BillableTurnawayReason): string {
  return reason === 'client_not_home'
    ? APP_SETTINGS_KEY_TRIP_CHARGE_CLIENT_NOT_HOME
    : APP_SETTINGS_KEY_TRIP_CHARGE_SITE_NOT_READY
}

/**
 * Default amount for the Create Trip Charge modal from app_settings rows.
 * Null (missing row, NULL, zero, or negative value) = not configured → empty
 * amount input; the office must type a positive amount.
 */
export function resolveTripChargeDefaultAmount(
  reason: BillableTurnawayReason,
  rows: readonly { key: string; value_num: number | null }[],
): number | null {
  const row = rows.find((r) => r.key === tripChargeSettingsKey(reason))
  const n = Number(row?.value_num)
  return Number.isFinite(n) && n > 0 ? n : null
}

/** Invoice memo; must match the SQL literal in migration 20260709130000. */
export function buildTripChargeMemo(reason: BillableTurnawayReason): string {
  return `Trip charge — ${turnawayReasonLabel(reason).toLowerCase()}`
}

/** Mirrors the RPC's dispatch_requests.closed_note (for toasts/tests). */
export function buildTripChargeClosedNote(amount: number, reason: BillableTurnawayReason): string {
  return `Trip charge created — $${formatCurrency(amount)} (${turnawayReasonLabel(reason).toLowerCase()})`
}
