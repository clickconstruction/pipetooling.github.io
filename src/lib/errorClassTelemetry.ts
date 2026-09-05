/**
 * Error-class telemetry (console-only, J18-N1 follow-up hook).
 *
 * Until v2.2836 nothing in the app distinguished "the phone has no signal"
 * from "the server refused this read" — both rendered the offline copy. Now
 * that `DatabaseError` carries a structured `kind`, this reporter writes one
 * `[error-class] <kind> <code> <operation>` line the first time each
 * (kind, code, operation) triple is SHOWN to a user in a session, so a support
 * session's console says which class of failure the person actually hit.
 *
 * Console only, same shape as the row-cap tripwire (v2.2756). The follow-up is
 * a real `error_shown{class, operation}` event into whatever sink the app
 * adopts; the throttle key here is the event's natural identity.
 */

export type ErrorClassEvent = {
  /** `network` (fetch layer never reached the server), `server` (PostgREST/Postgres answered with a code or HTTP status), `unknown` (no structure). */
  kind: 'network' | 'server' | 'unknown'
  /** PostgREST / Postgres code (`22P02`, `42501`, `PGRST116`, …) or `''`. */
  code: string
  /** The `withSupabaseRetry` / `checkSupabaseError` operation name, or `''`. */
  operation: string
  /** HTTP status when known (0 = fetch layer). */
  status?: number
}

export function errorClassKey(ev: ErrorClassEvent): string {
  return `${ev.kind}|${ev.code}|${ev.operation}`
}

/**
 * Factory so tests can assert the once-per-triple throttle. The reporter must
 * never throw — it runs inside the error-rendering path.
 */
export function makeErrorClassReporter(
  log: (line: string, ev: ErrorClassEvent) => void = (line, ev) => console.warn(line, ev),
): (ev: ErrorClassEvent) => void {
  const seen = new Set<string>()
  return (ev) => {
    try {
      const key = errorClassKey(ev)
      if (seen.has(key)) return
      seen.add(key)
      log(`[error-class] ${ev.kind} ${ev.code || '-'} ${ev.operation || '-'}`, ev)
    } catch {
      // Telemetry must never turn an error message into a second error.
    }
  }
}

/** App-wide reporter: one line per (kind, code, operation) per page load. */
export const reportErrorClass = makeErrorClassReporter()
