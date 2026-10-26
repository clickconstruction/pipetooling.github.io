/**
 * The one "a dev opens on the Bridge" rule (v2.5879), cut to the shape of `assistantDispatchLanding.ts`: pure, with
 * a path guard so a deep link is never pulled away. It fires only for a `dev` at the bare root `/`. A dev who presses
 * Dashboard in the header stays on `/dashboard`, and a typed or pushed link (`/jobs?tab=stages`) opens where it
 * points. Every other role lands where it did, on the Dashboard.
 *
 * `indexLandingPath` is what the index route (`IndexLanding`) and the sign-in route render; `resolveDevLanding` is
 * the same rule in the assistant rule's shape, for a caller that holds a pathname.
 */

export const BRIDGE_PATH = '/bridge'
export const DASHBOARD_PATH = '/dashboard'

export interface DevLandingInput {
  role: string | null | undefined
  /** The path the person is on; only the bare root counts as "nowhere yet". */
  pathname: string
}

/** The bare root alone: `/dashboard` is a page someone chose. */
export function isRootPath(pathname: string): boolean {
  return pathname === '/'
}

export function shouldLandOnBridge(input: DevLandingInput): boolean {
  return input.role === 'dev' && isRootPath(input.pathname)
}

/** The path to navigate to, or null when the rule does not fire. */
export function resolveDevLanding(input: DevLandingInput): string | null {
  return shouldLandOnBridge(input) ? BRIDGE_PATH : null
}

/** Where `/` sends a role, and where a sign-in lands: the Bridge for a dev, the Dashboard for everyone else, a role not yet read included. */
export function indexLandingPath(role: string | null | undefined): string {
  return role === 'dev' ? BRIDGE_PATH : DASHBOARD_PATH
}
