/**
 * Display kernels for the Settings → Digital twins fleet console (v2.2433).
 *
 * The twin_runs ledger stores machine notes ("mint via=token:<uuid> redirect=<url>",
 * mission "report:<name>"); the console shows people plain English ("via key “xAI
 * harness” → /bids"). The translation lives here, pure and unit-tested, because the
 * note formats are written by TWO edge functions (twin-login, twin-mcp) and the
 * panel must keep up with both.
 */

export type TwinRunVerb = 'sign-in' | 'report' | 'run'

export type TwinRunDisplay = {
  verb: TwinRunVerb
  /** Mission shown to the operator ("report:" prefix stripped for reports). */
  mission: string
  /** Plain-English remainder ("via key “xAI harness” → /bids", or the report text). */
  detail: string
}

/** Resolve a credential id to its human label; null/undefined → unknown key. */
export type CredLabelLookup = (credentialId: string) => string | null | undefined

export function describeTwinRun(
  mission: string,
  notes: string | null,
  credLabel?: CredLabelLookup,
): TwinRunDisplay {
  const note = (notes ?? '').trim()
  if (mission.startsWith('report:')) {
    return { verb: 'report', mission: mission.slice('report:'.length) || 'unlabeled', detail: note }
  }
  if (note.startsWith('mint ')) {
    const viaMatch = /via=(token:([0-9a-f-]+)|master)/.exec(note)
    let via = 'signed in'
    if (viaMatch?.[1] === 'master') via = 'via master secret'
    else if (viaMatch?.[2]) {
      const id = viaMatch[2]
      const label = credLabel?.(id)
      via = label ? `via key “${label}”` : `via key ${id.slice(0, 8)}…`
    }
    const redirectTarget = /redirect=(\S+)/.exec(note)?.[1]
    const dest = redirectTarget && redirectTarget !== '-' ? ` → ${pathOf(redirectTarget)}` : ''
    return { verb: 'sign-in', mission, detail: `${via}${dest}` }
  }
  return { verb: 'run', mission, detail: note }
}

function pathOf(url: string): string {
  try {
    const u = new URL(url)
    return u.pathname === '/' && !u.search ? u.host : `${u.pathname}${u.search}`
  } catch {
    return url
  }
}

/** "2h ago" / "yesterday" / "3d ago" — falls back to the ISO date beyond two weeks. */
export function relativeTimeFrom(iso: string, nowMs: number): string {
  const t = Date.parse(iso)
  if (Number.isNaN(t)) return iso
  const s = Math.floor((nowMs - t) / 1000)
  if (s < 60) return 'just now'
  if (s < 3600) return `${Math.floor(s / 60)}m ago`
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`
  if (s < 172800) return 'yesterday'
  if (s < 14 * 86400) return `${Math.floor(s / 86400)}d ago`
  return iso.slice(0, 10)
}

/** Next free fleet seat from the emails already minted (gaps are not reused). */
export function nextTwinSeat(emails: string[]): { n: number; email: string } {
  const ns = emails.map((e) => Number(/^twin-estimator-(\d+)@/.exec(e)?.[1] ?? 0))
  const n = Math.max(0, ...ns) + 1
  return { n, email: `twin-estimator-${n}@twins.pipetooling.local` }
}
