/**
 * Refused writes (v2.3058): the one place a silent RLS no-op becomes loud.
 *
 * PostgREST answers an UPDATE that row-level security filtered out with
 * success and zero rows — the twin write fence, a row deleted mid-edit, a
 * role outside the table's policy. Without checking the returned rows the
 * screen closes as if the save landed and the edit is gone (v2.2454 found it
 * on Edit Bid; the bids surfaces have guarded since). This module holds the
 * check, the user-facing message, and the `rls_refused` beacon the journey
 * map asked for (v2.2920 "not built"): one `ui_nav_clicks` row per refusal,
 * control `rls_refused`, target `/<table>?op=<op>`, so refusals are
 * queryable by table and role without a migration — the same best-effort
 * posture as the nav-click and bill-truth beacons.
 */
import { recordNavClick } from './navClickTelemetry'

export const RLS_REFUSED_CONTROL = 'rls_refused'

export type RefusedWriteOp = 'update' | 'delete' | 'insert'

let identity: { userId: string | null; role: string | null } = { userId: null, role: null }

/** Called by the auth provider whenever the signed-in user or role changes; null clears it. */
export function setRefusedWriteIdentity(userId: string | null | undefined, role: string | null | undefined): void {
  identity = { userId: userId ?? null, role: role ?? null }
}

/** Test hook. */
export function getRefusedWriteIdentityForTests(): { userId: string | null; role: string | null } {
  return { ...identity }
}

/** True when an `update(...).select('id')` result actually touched rows. */
export function updateApplied(rows: ReadonlyArray<unknown> | null | undefined): boolean {
  return Array.isArray(rows) && rows.length > 0
}

/** "Save didn’t apply — you don’t have permission to edit this bid, or it no longer exists. Your changes were not saved." */
export function refusedUpdateMessage(what: string): string {
  return `Save didn’t apply — you don’t have permission to edit this ${what}, or it no longer exists. Your changes were not saved.`
}

/** Root-relative so it groups with nav targets in `ui_nav_clicks`. */
export function refusedWriteTarget(table: string, op: RefusedWriteOp): string {
  return `/${table}?op=${op}`
}

function isDevBuild(): boolean {
  try {
    return typeof import.meta !== 'undefined' && !!import.meta.env?.DEV && import.meta.env?.MODE !== 'test'
  } catch {
    return false
  }
}

/** Fire the beacon. Never throws; a signed-out or unknown identity only logs in dev. */
export function reportRefusedWrite(table: string, op: RefusedWriteOp = 'update'): void {
  try {
    if (isDevBuild()) console.warn(`[${RLS_REFUSED_CONTROL}]`, table, op, { role: identity.role })
    if (identity.userId) recordNavClick(identity.userId, identity.role, RLS_REFUSED_CONTROL, refusedWriteTarget(table, op))
  } catch {
    /* measurement is best-effort by design */
  }
}

/**
 * The guard call sites use: true when the update touched nothing, with the
 * beacon already fired. Use it only where zero rows means "refused" — a
 * conditional write (`.is('x', null)`) whose zero rows is the expected
 * already-set case should read `updateApplied` instead.
 */
export function updateRefused(rows: ReadonlyArray<unknown> | null | undefined, table: string, op: RefusedWriteOp = 'update'): boolean {
  const refused = !updateApplied(rows)
  if (refused) reportRefusedWrite(table, op)
  return refused
}
