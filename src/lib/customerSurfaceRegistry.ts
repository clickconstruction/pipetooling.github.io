/**
 * The registry of every outside-facing surface — each public route in `App.tsx` and each edge
 * function that sends email — and where it appears on Settings → What customers see (v2.3505).
 *
 * The tab drifted for a month because nothing asked "is it on What customers see?" when a room
 * or a sender shipped. `customerSurfaceRegistry.test.ts` reads the real route table and the real
 * functions folder and fails CI when a surface has no entry here, when an entry names a step that
 * does not exist, or when an entry names a route or function that no longer exists. A surface
 * that genuinely does not belong on the tab (sign-in, invites, the office's own reports) is
 * listed with `exempt` and the reason, so the count stays honest.
 *
 * Pure data + pure functions; the test supplies the file contents.
 */
import type { Journey, JourneyId } from './customerJourneys'

export type SurfaceAudience = 'homeowner' | 'gc' | 'sub' | 'house' | 'firm' | 'owner' | 'staff'

export type SurfacePlace = { journeyId: JourneyId; stepId: string }

export type SurfaceEntry = {
  kind: 'route' | 'sender'
  /** A public route path exactly as `App.tsx` spells it, or an edge-function folder name. */
  ref: string
  audience: SurfaceAudience
  /** The journey step(s) the surface appears as. A route may back a live and a done state. */
  steps?: SurfacePlace[]
  /** Why it is not on the tab. Required when `steps` is empty. */
  exempt?: string
}

const H = (stepId: string): SurfacePlace => ({ journeyId: 'homeowner', stepId })
const G = (stepId: string): SurfacePlace => ({ journeyId: 'gc', stepId })
const S = (stepId: string): SurfacePlace => ({ journeyId: 'sub', stepId })
const HS = (stepId: string): SurfacePlace => ({ journeyId: 'house', stepId })
const F = (stepId: string): SurfacePlace => ({ journeyId: 'firm', stepId })

export const CUSTOMER_SURFACES: readonly SurfaceEntry[] = [
  // ---- public routes (App.tsx, outside ProtectedRoute) ----
  { kind: 'route', ref: '/sign-in', audience: 'staff', exempt: 'Staff sign-in.' },
  { kind: 'route', ref: '/dev-login', audience: 'staff', exempt: 'Dev-only password-free login; production redirects it to sign-in.' },
  { kind: 'route', ref: '/reset-password', audience: 'staff', exempt: 'Staff password reset.' },
  { kind: 'route', ref: '/reset-password-confirm', audience: 'staff', exempt: 'Staff password reset, second step.' },
  { kind: 'route', ref: '/accept-invite', audience: 'staff', exempt: 'A new staff account accepting its invite.' },
  { kind: 'route', ref: '/task', audience: 'staff', exempt: 'The iOS home-screen install helper for task-capable staff.' },
  { kind: 'route', ref: '/estimate/accept', audience: 'homeowner', steps: [H('estimate-page'), H('estimate-thankyou')] },
  { kind: 'route', ref: '/estimate/terms', audience: 'homeowner', steps: [H('estimate-terms')] },
  { kind: 'route', ref: '/contract/sign', audience: 'homeowner', steps: [H('job-contract-page'), H('job-contract-signed')] },
  { kind: 'route', ref: '/hazmat-notice', audience: 'homeowner', steps: [H('hazmat-notice')] },
  { kind: 'route', ref: '/portal', audience: 'homeowner', steps: [H('customer-portal'), G('gc-portal')] },
  { kind: 'route', ref: '/p/:slug', audience: 'homeowner', steps: [H('customer-portal'), G('gc-portal')] },
  { kind: 'route', ref: '/bid-room', audience: 'gc', steps: [G('bid-room'), G('bid-room-signed')] },
  { kind: 'route', ref: '/submittal', audience: 'gc', steps: [G('submittal-room'), G('submittal-decided')] },
  { kind: 'route', ref: '/sub', audience: 'sub', steps: [S('sub-portal')] },
  { kind: 'route', ref: '/s/:slug', audience: 'sub', steps: [S('sub-portal')] },
  { kind: 'route', ref: '/contract/accept', audience: 'sub', steps: [S('sub-contract'), S('sub-contract-signed')] },
  { kind: 'route', ref: '/q/:token', audience: 'house', steps: [HS('quote-page'), HS('quote-submitted')] },
  { kind: 'route', ref: '/legal', audience: 'firm', steps: [F('firm-portal')] },

  // ---- email senders (supabase/functions/*/index.ts that call Resend) ----
  { kind: 'sender', ref: 'send-estimate-to-customer', audience: 'homeowner', steps: [H('estimate-email')] },
  { kind: 'sender', ref: 'send-job-contract', audience: 'homeowner', steps: [H('job-contract-email')] },
  { kind: 'sender', ref: 'remind-job-contracts', audience: 'homeowner', steps: [H('job-contract-reminder')] },
  { kind: 'sender', ref: 'sign-job-contract', audience: 'homeowner', steps: [H('job-contract-signed')] },
  { kind: 'sender', ref: 'share-job-contract', audience: 'homeowner', steps: [H('job-contract-signed')] },
  { kind: 'sender', ref: 'send-stripe-invoice', audience: 'homeowner', steps: [H('bill-email')] },
  { kind: 'sender', ref: 'send-physical-invoice-email', audience: 'homeowner', steps: [H('bill-by-email')] },
  { kind: 'sender', ref: 'send-hazmat-notice-email', audience: 'homeowner', steps: [H('hazmat-notice')] },
  { kind: 'sender', ref: 'send-lien-filing-email', audience: 'owner', steps: [H('demand-letter'), G('owner-notice')] },
  { kind: 'sender', ref: 'send-lien-release-email', audience: 'homeowner', steps: [H('lien-release')] },
  { kind: 'sender', ref: 'send-bid-room-link', audience: 'gc', steps: [G('bid-room-email'), G('bid-room-revised-email')] },
  { kind: 'sender', ref: 'sign-bid-room', audience: 'gc', steps: [G('bid-room-signed')] },
  { kind: 'sender', ref: 'send-bid-pricing-package', audience: 'gc', steps: [G('pricing-package-email')] },
  { kind: 'sender', ref: 'send-test-report', audience: 'gc', steps: [G('test-report-email')] },
  { kind: 'sender', ref: 'send-gc-statement-email', audience: 'gc', steps: [G('gc-statement-email')] },
  { kind: 'sender', ref: 'gc-statement-email-dispatch', audience: 'gc', steps: [G('gc-statement-email')] },
  { kind: 'sender', ref: 'send-contract-for-signature', audience: 'sub', steps: [S('sub-contract-email')] },
  { kind: 'sender', ref: 'send-rfq-email', audience: 'house', steps: [HS('quote-email')] },
  { kind: 'sender', ref: 'send-supply-house-job-account', audience: 'house', steps: [HS('job-account-email')] },
  { kind: 'sender', ref: 'legal-notify-dispatch', audience: 'firm', steps: [F('firm-now-email'), F('firm-digest-email')] },
  { kind: 'sender', ref: 'submit-legal-portal', audience: 'firm', steps: [F('firm-confirm-email')] },
  { kind: 'sender', ref: 'submit-portal-request', audience: 'staff', exempt: 'Tells the office a portal request came in; the customer sees the portal\'s own thank-you.' },
  { kind: 'sender', ref: 'billed-report-email', audience: 'staff', exempt: 'The office\'s Billed Awaiting Payment report.' },
  { kind: 'sender', ref: 'crew-day-email-dispatch', audience: 'staff', exempt: 'The crew\'s day email.' },
  { kind: 'sender', ref: 'ct-roster-audit', audience: 'staff', exempt: 'Weekly roster drift audit to every dev.' },
  { kind: 'sender', ref: 'invite-user', audience: 'staff', exempt: 'Staff account invites.' },
  { kind: 'sender', ref: 'money-waiting-email-dispatch', audience: 'staff', exempt: 'The office\'s Money waiting list.' },
  { kind: 'sender', ref: 'payment-forecast-email-dispatch', audience: 'staff', exempt: 'The office\'s Payment forecast.' },
  { kind: 'sender', ref: 'schedule-share-dispatch', audience: 'staff', exempt: 'Schedule shares go to app users.' },
  { kind: 'sender', ref: 'paid-job-email', audience: 'staff', exempt: 'Internal paid-job notice to three staff ids, never the payer.' },
  { kind: 'sender', ref: 'send-scheduled-reminders', audience: 'staff', exempt: 'Reminders to app users.' },
  { kind: 'sender', ref: 'send-report-email', audience: 'staff', exempt: 'Report subscriptions for the office.' },
  { kind: 'sender', ref: 'recurring-job-report-dispatch', audience: 'staff', exempt: 'Recurring job reports to app users.' },
  { kind: 'sender', ref: 'recurring-job-report-test-send', audience: 'staff', exempt: 'A test send of a recurring job report to the signed-in user.' },
  { kind: 'sender', ref: 'schedule-day-email-dispatch', audience: 'staff', exempt: 'The schedule-day email to app users.' },
  { kind: 'sender', ref: 'send-sign-in-email', audience: 'staff', exempt: 'Magic sign-in links for staff.' },
  { kind: 'sender', ref: 'send-workflow-notification', audience: 'staff', exempt: 'Workflow step notifications to app users.' },
  { kind: 'sender', ref: 'statement-round-email-dispatch', audience: 'staff', exempt: 'The office\'s "Your statement round" email.' },
  { kind: 'sender', ref: 'sync-resend-emails', audience: 'staff', exempt: 'Dev tooling: mirrors the Resend log.' },
  { kind: 'sender', ref: 'test-email', audience: 'staff', exempt: 'Settings → Email templates & testing.' },
  { kind: 'sender', ref: 'weekly-movement-email-dispatch', audience: 'staff', exempt: 'The office\'s weekly stage-moves report.' },
  { kind: 'sender', ref: 'weekly-money-email-dispatch', audience: 'staff', exempt: 'The office\'s weekly money report.' },
]

/**
 * The public routes in an `App.tsx` source: every `<Route path="/…">` between `<Routes>` and
 * `</Routes>` whose element is not wrapped in `ProtectedRoute`. Nested routes under the `/`
 * layout have no leading slash and are skipped; the layout route itself is skipped.
 */
export function publicRoutesFromAppSource(src: string): string[] {
  const start = src.indexOf('<Routes>')
  const end = src.indexOf('</Routes>')
  if (start < 0 || end < 0) return []
  const chunks = src.slice(start, end).split(/(?=<Route\b)/).slice(1)
  const out: string[] = []
  for (const c of chunks) {
    const m = c.match(/path="([^"]+)"/)
    if (!m) continue
    const path = m[1]!
    if (!path.startsWith('/') || path === '/') continue
    if (c.includes('ProtectedRoute')) continue
    out.push(path)
  }
  return out
}

/** The edge functions that send email: every `<name>/index.ts` that calls one of the shared Resend helpers, or Resend directly. */
export function resendSendersFromSources(functions: ReadonlyArray<{ name: string; source: string }>): string[] {
  return functions
    .filter((f) => f.source.includes('sendEmailViaResend') || f.source.includes('sendResendHtmlEmail') || f.source.includes('resend.com/emails'))
    .map((f) => f.name)
    .sort()
}

/** Every way the registry, the route table, the functions folder and the journeys can disagree. */
export function surfaceRegistryProblems(input: {
  journeys: Journey[]
  entries: ReadonlyArray<SurfaceEntry>
  publicRoutes: string[]
  senders: string[]
}): string[] {
  const problems: string[] = []
  const stepIds = new Set(input.journeys.flatMap((j) => j.steps.map((s) => `${j.id}/${s.id}`)))
  const routes = new Set(input.entries.filter((e) => e.kind === 'route').map((e) => e.ref))
  const senders = new Set(input.entries.filter((e) => e.kind === 'sender').map((e) => e.ref))

  for (const r of input.publicRoutes) if (!routes.has(r)) problems.push(`public route ${r} has no entry in CUSTOMER_SURFACES — add its journey step, or an exempt reason`)
  for (const s of input.senders) if (!senders.has(s)) problems.push(`email sender ${s} has no entry in CUSTOMER_SURFACES — add its journey step, or an exempt reason`)
  for (const e of input.entries) {
    if (e.kind === 'route' && !input.publicRoutes.includes(e.ref)) problems.push(`registry route ${e.ref} is not a public route in App.tsx any more`)
    if (e.kind === 'sender' && !input.senders.includes(e.ref)) problems.push(`registry sender ${e.ref} is not an email-sending function any more`)
    const placed = (e.steps ?? []).length > 0
    if (!placed && !(e.exempt ?? '').trim()) problems.push(`${e.kind} ${e.ref} has neither a journey step nor an exempt reason`)
    if (placed && e.exempt) problems.push(`${e.kind} ${e.ref} is both placed and exempt — pick one`)
    for (const p of e.steps ?? []) if (!stepIds.has(`${p.journeyId}/${p.stepId}`)) problems.push(`${e.kind} ${e.ref} names step ${p.journeyId}/${p.stepId}, which is not in customerJourneys()`)
  }
  const seen = new Set<string>()
  for (const e of input.entries) {
    const k = `${e.kind}:${e.ref}`
    if (seen.has(k)) problems.push(`${k} is listed twice`)
    seen.add(k)
  }
  return problems
}

export type JourneyCoverage = { audiences: number; steps: number; rendered: number; paper: number; soon: number; external: number }

export function journeyCoverage(journeys: Journey[]): JourneyCoverage {
  const steps = journeys.flatMap((j) => j.steps)
  const count = (k: string) => steps.filter((s) => s.render.kind === k).length
  return {
    audiences: journeys.length,
    steps: steps.length,
    rendered: count('page') + count('email'),
    paper: count('paper'),
    soon: count('soon'),
    external: count('external'),
  }
}

/** "39 steps across 5 audiences · 14 rendered live · 5 open as the PDF · 18 next release · 2 sent by another system" */
export function coverageLine(c: JourneyCoverage): string {
  const parts = [`${c.steps} steps across ${c.audiences} audiences`, `${c.rendered} rendered live`]
  if (c.paper > 0) parts.push(`${c.paper} open as the PDF`)
  if (c.soon > 0) parts.push(`${c.soon} next release`)
  if (c.external > 0) parts.push(`${c.external} sent by another system`)
  return parts.join(' · ')
}
