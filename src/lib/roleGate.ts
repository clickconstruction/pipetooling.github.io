import type { UserRole } from '../hooks/useAuth'
import { isSubcontractorLikeRole } from './subcontractorLikeRole'
import { DatabaseError, errorKindOf } from '../utils/errorHandling'

/**
 * Role gates that say something (journey-map Tier-2 #29, cluster C25).
 *
 * Until this kernel every in-page role gate was one of three silent shapes:
 * a `setSearchParams(…, { replace: true })` rewrite to another tab (the person
 * followed a link and simply arrived somewhere else), a render branch gated on
 * an access flag that returned nothing (a tab strip, then a blank page), or a
 * report shell that opened and then printed the RPC's refusal string
 * verbatim ("Failed to load weekly money movement: not allowed").
 *
 * One convention replaces all three: the gate decides a **landing** and a
 * **sentence** — "<thing> is for <audience> — you're on <landing>." — and the
 * caller lands there honestly with the sentence as a toast. The sentence is
 * spoken once per refused link; the landing is always a page the role can
 * actually use.
 *
 * Deliberately quiet: sub-like roles (subcontractor, helpers). Their day one is
 * "Clock In on top, only my work and my pay, silent route bounces" (J24-F8, a
 * protected strength) — a helper who taps a link that isn't theirs lands on
 * their Dashboard with no lecture. `quiet` is true for them; the hook shows no
 * toast but still lands and still records the redirect.
 *
 * Pure: no React, no supabase. The hook in `hooks/useRoleGate.ts` adds the
 * toast + the `role_gate_redirect` telemetry row.
 */

export type RoleGateSurface =
  /** Jobs → Crew P&L (`?tab=teams-summary`) — owner only. */
  | 'crew-pnl'
  /** Jobs → Team Labor (`?tab=combined-labor`) — not assistants / superintendents. */
  | 'team-labor'
  /** Any other Jobs tab a primary / superintendent deep-links to that isn't on their strip. */
  | 'jobs-tab'
  /** People → Payroll / Employment / Offsets (`canAccessPay`). */
  | 'payroll'
  /** People → Hours (`canAccessHours || canAccessPay`). */
  | 'hours'
  /** Pipeline `?stagesMoney=1` — the Weekly money movement modal (dev / controller). */
  | 'pipeline-money'
  /** Bids office tabs a superintendent deep-links to (Pricing, Cover letter, …). */
  | 'bids-office-tab'

export type RoleGateDecision = {
  /** Where to land — always a path the role can open. */
  to: string
  /** The `tab` query value at the landing, when the landing is a tab of the same page. */
  toTab: string | null
  /** Plain-English name of the landing, as spoken in the toast. */
  landingLabel: string
  /** The sentence to show. `null` when `quiet`. */
  toast: string | null
  /** True for sub-like roles — land, don't lecture (J24-F8). */
  quiet: boolean
}

/** The `control` value written to `ui_nav_clicks` for every gate redirect; `target` is the refused link. */
export const ROLE_GATE_TELEMETRY_CONTROL = 'role_gate_redirect'

type SurfaceCopy = {
  /** What the person was reaching for — the subject of the sentence. */
  subject: string
  /** Who it is for, in the trade's words. */
  audience: string
}

const SURFACE_COPY: Record<RoleGateSurface, SurfaceCopy> = {
  'crew-pnl': { subject: 'Crew P&L', audience: 'the owner' },
  'team-labor': { subject: 'Team Labor', audience: 'the owner' },
  'jobs-tab': { subject: 'This page', audience: 'the office' },
  payroll: { subject: 'Payroll', audience: 'the controller' },
  hours: { subject: 'Hours', audience: 'the office' },
  'pipeline-money': { subject: 'Weekly money movement', audience: 'the controller' },
  'bids-office-tab': { subject: 'This page', audience: 'the office' },
}

type Landing = { to: string; toTab: string | null; landingLabel: string }

const JOBS_REPORTS: Landing = { to: '/jobs?tab=reports', toTab: 'reports', landingLabel: 'Reports' }
const JOBS_STAGES: Landing = { to: '/jobs?tab=stages', toTab: 'stages', landingLabel: 'the Pipeline board' }
const PEOPLE_USERS: Landing = { to: '/people?tab=users', toTab: 'users', landingLabel: 'Users' }
const BIDS_BOARD: Landing = { to: '/bids?tab=bid-board', toTab: 'bid-board', landingLabel: 'the Bid board' }

/** Where a refused link lands, per surface (and per role where the strips differ). */
export function roleGateLanding(surface: RoleGateSurface, role: UserRole | string | null | undefined): Landing {
  switch (surface) {
    case 'crew-pnl':
      return JOBS_REPORTS
    case 'team-labor':
      // Superintendents have no Pipeline board (Reports + Sub Ledger only).
      return role === 'superintendent' ? JOBS_REPORTS : JOBS_STAGES
    case 'jobs-tab':
      return JOBS_REPORTS
    case 'payroll':
    case 'hours':
      return PEOPLE_USERS
    case 'pipeline-money':
      return JOBS_STAGES
    case 'bids-office-tab':
      return BIDS_BOARD
  }
}

/** Sub-like roles keep their silent bounces (J24-F8 keep). */
export function isQuietRoleGateRole(role: UserRole | string | null | undefined): boolean {
  return isSubcontractorLikeRole((role ?? null) as UserRole | null)
}

/** "Crew P&L is for the owner — you're on Reports." */
export function roleGateToastCopy(surface: RoleGateSurface, landingLabel: string): string {
  const { subject, audience } = SURFACE_COPY[surface]
  return `${subject} is for ${audience} — you're on ${landingLabel}.`
}

export function roleGateRedirect(input: {
  /** The refused link, e.g. `/jobs?tab=teams-summary` — recorded as the telemetry target. */
  from: string
  role: UserRole | string | null | undefined
  surface: RoleGateSurface
}): RoleGateDecision {
  const landing = roleGateLanding(input.surface, input.role)
  const quiet = isQuietRoleGateRole(input.role)
  return {
    ...landing,
    quiet,
    toast: quiet ? null : roleGateToastCopy(input.surface, landing.landingLabel),
  }
}

/**
 * The page a role starts on — the same target Layout's route guard bounces to.
 * Used as the impersonation landing so "Imitate" arrives where the button says.
 */
export function roleHomePath(role: UserRole | string | null | undefined): string {
  return role === 'estimator' ? '/bids' : '/dashboard'
}

// ---------------------------------------------------------------------------
// RPC refusals on gated report surfaces
// ---------------------------------------------------------------------------

/** `42501` insufficient_privilege — RLS refusals. */
const PERMISSION_CODES: ReadonlySet<string> = new Set(['42501'])
/** `P0001` raise_exception — the app's SECURITY DEFINER RPCs refuse with `RAISE EXCEPTION '…not allowed'`. */
const RAISE_EXCEPTION_CODE = 'P0001'
const RPC_REFUSAL_RE = /\bnot allowed\b|permission denied|insufficient_privilege/i

function readCode(error: unknown): string | undefined {
  if (error instanceof DatabaseError) return error.code
  if (error && typeof error === 'object' && 'code' in error) {
    const c = (error as { code?: unknown }).code
    return typeof c === 'string' ? c : undefined
  }
  return undefined
}

function readMessage(error: unknown): string {
  if (error instanceof DatabaseError) return error.serverMessage ?? error.message
  if (error instanceof Error) return error.message
  if (error && typeof error === 'object' && 'message' in error) {
    const m = (error as { message?: unknown }).message
    return typeof m === 'string' ? m : ''
  }
  return typeof error === 'string' ? error : ''
}

/**
 * True when a server answer is the role refusing the read — RLS `42501`, or
 * the RPCs' own `RAISE EXCEPTION 'not allowed'` (`P0001`). Decided from the
 * classified `kind` first (v2.2836); the message is consulted only for the
 * `P0001` convention, never for a network failure.
 */
export function isRoleRefusalError(error: unknown): boolean {
  if (errorKindOf(error) !== 'server') return false
  const code = (readCode(error) ?? '').trim()
  if (PERMISSION_CODES.has(code)) return true
  if (code === RAISE_EXCEPTION_CODE) return RPC_REFUSAL_RE.test(readMessage(error))
  return false
}

/**
 * The sentence for a gated report the server refused — "You don't have access
 * to this report." — or `null` when the failure is something else (caller falls
 * back to `formatErrorMessage`). Never the raw PostgREST string.
 */
export function roleGateRefusalMessage(error: unknown, subject = 'this report'): string | null {
  return isRoleRefusalError(error) ? `You don't have access to ${subject}.` : null
}
