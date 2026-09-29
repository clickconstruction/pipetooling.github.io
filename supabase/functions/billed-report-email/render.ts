/**
 * The Billed awaiting payment email, bound to this deployment: the renderer
 * lives in `_shared/billedReportEmail.ts` (What the team sees renders it on
 * sample data); this module only supplies the app origin for the deep links.
 */
import { billedReportEmailText as text, renderBilledReportEmail as render, type BilledReportPayload } from '../_shared/billedReportEmail.ts'

export { billedReportEmailSubject, groupBilledRows, type BilledReportPayload, type BilledReportRow } from '../_shared/billedReportEmail.ts'

/** Prod app origin for deep links (invite-user precedent; repo CNAME = pipetooling.com). */
export const APP_URL = (Deno.env.get('APP_ORIGIN')?.trim() || 'https://pipetooling.com').replace(/\/+$/, '') // domain-cutover flip point (docs/DOMAIN_CUTOVER.md)

export function renderBilledReportEmail(p: BilledReportPayload, senderName?: string): string {
  return render(p, APP_URL, senderName)
}

export function billedReportEmailText(p: BilledReportPayload): string {
  return text(p, APP_URL)
}
