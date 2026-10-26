/**
 * An error shown, as a row (punch list #187, PR 2): the follow-up `errorClassTelemetry.ts` named for
 * itself, *a real `error_shown{class, operation}` event into whatever sink the app adopts*. The sink
 * is `ui_nav_clicks`, as `rls_refused` and `role_gate_redirect` already use it: control
 * `error_shown`, target `/<kind>?code=<code>&op=<operation>&status=<status>`, `from_path` the surface,
 * once per (kind, code, operation) per page load as the console line already is. The reporter stays
 * import-free (it is mirrored into the edge functions' kernel copy); this file is the app's half,
 * installed by `useAuth` beside the refused-write identity and cleared at sign-out.
 */
import { setErrorClassSink, type ErrorClassEvent } from './errorClassTelemetry'
import { recordNavClick } from './navClickTelemetry'

export const ERROR_SHOWN_CONTROL = 'error_shown'

/** Pure: the row's target for one event; `-` where a part is unknown, so the readout groups cleanly. */
export function errorShownTarget(ev: ErrorClassEvent): string {
  const code = ev.code || '-'
  const op = ev.operation || '-'
  const status = ev.status != null && ev.status > 0 ? `&status=${ev.status}` : ''
  return `/${ev.kind}?code=${encodeURIComponent(code)}&op=${encodeURIComponent(op)}${status}`
}

/** Pure, the readout's inverse: a target back to its parts, or null for another shape. */
export function parseErrorShownTarget(target: string): { kind: string; code: string; operation: string; status: number | null } | null {
  const m = /^\/(network|server|unknown)\?code=([^&]*)&op=([^&]*)(?:&status=(\d+))?$/.exec(target)
  if (!m) return null
  try {
    return { kind: m[1]!, code: decodeURIComponent(m[2]!), operation: decodeURIComponent(m[3]!), status: m[4] ? Number(m[4]) : null }
  } catch {
    return null
  }
}

/** Point the reporter at the ledger as this person; null clears it (sign-out). */
export function installErrorShownSink(userId: string | null | undefined, role: string | null | undefined): void {
  if (!userId) {
    setErrorClassSink(null)
    return
  }
  setErrorClassSink((ev) => recordNavClick(userId, role ?? null, ERROR_SHOWN_CONTROL, errorShownTarget(ev)))
}
