import type { HazmatIncidentDraft } from '../hazmatFee'

/**
 * Printable Hazmat Fee Notice: the customer-facing / dispute-ready packet —
 * incident summary, photo references, technician testimonials, the ToS §11
 * snapshot, and the fee. Pure HTML-string builder (print docs stay light
 * regardless of app theme, matching the other customer-facing prints).
 */

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export type HazmatNoticeJobInfo = {
  jobNumber: string
  jobName: string
  jobAddress: string
  customerName: string
}

export function buildHazmatFeeNoticeHtml(job: HazmatNoticeJobInfo, draft: HazmatIncidentDraft): string {
  const incidentDate = new Date(draft.incidentAt)
  const dateStr = Number.isNaN(incidentDate.getTime())
    ? draft.incidentAt
    : incidentDate.toLocaleString('en-US', { timeZone: 'America/Chicago' })
  const fee = draft.feeAmount.toLocaleString('en-US', { style: 'currency', currency: 'USD' })
  const photos = draft.photoLinks
    .map((p, i) => `<li><a href="${esc(p)}">Photo ${i + 1}: ${esc(p)}</a></li>`)
    .join('')
  const testimonials = draft.testimonials
    .map(
      (t) =>
        `<div class="stmt"><p class="who">${esc(t.name)} — ${esc(
          new Date(t.givenAt).toLocaleDateString('en-US', { timeZone: 'America/Chicago' }),
        )}</p><p class="body">${esc(t.statement)}</p></div>`,
    )
    .join('')
  return `<!doctype html><html data-theme="light"><head><meta charset="utf-8"><title>Hazmat Fee Notice — Job ${esc(job.jobNumber)}</title>
<style>
  body { font-family: -apple-system, 'Segoe UI', Roboto, sans-serif; color: #111827; margin: 2rem auto; max-width: 720px; line-height: 1.45; }
  h1 { font-size: 1.35rem; margin: 0 0 0.25rem; }
  h2 { font-size: 1rem; margin: 1.4rem 0 0.4rem; border-bottom: 1px solid #d1d5db; padding-bottom: 0.2rem; }
  .meta { color: #4b5563; font-size: 0.9rem; margin: 0; }
  .fee { font-size: 1.15rem; font-weight: 700; margin: 0.75rem 0; }
  .clause { white-space: pre-wrap; background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 6px; padding: 0.75rem; font-size: 0.9rem; }
  .stmt { border-left: 3px solid #d1d5db; padding-left: 0.75rem; margin: 0.75rem 0; }
  .stmt .who { font-weight: 600; margin: 0 0 0.2rem; font-size: 0.9rem; }
  .stmt .body { margin: 0; white-space: pre-wrap; }
  ul { margin: 0.4rem 0; padding-left: 1.25rem; }
  @media print { body { margin: 0.5in; } }
</style></head><body>
<h1>Biohazard Remediation Fee Notice</h1>
<p class="meta">Job ${esc(job.jobNumber)} — ${esc(job.jobName)}<br>${esc(job.jobAddress)}<br>Customer: ${esc(job.customerName)}</p>
<p class="fee">Fee: ${fee}</p>
<h2>Incident</h2>
<p class="meta">Date/time: ${esc(dateStr)}${draft.stageLabel ? ` · Stage: ${esc(draft.stageLabel)}` : ''}${
    draft.exposedPeople.trim() ? `<br>Personnel exposed: ${esc(draft.exposedPeople)}` : ''
  }</p>
<p style="white-space: pre-wrap">${esc(draft.description)}</p>
<h2>Photographic evidence</h2>
<ul>${photos}</ul>
<h2>Technician statements</h2>
${testimonials}
<h2>Contractual basis</h2>
<div class="clause">${esc(draft.tosClauseSnapshot)}</div>
<p class="meta">The clause above is reproduced verbatim from the Click Plumbing and Electrical Terms &amp; Conditions in effect at the time this notice was generated (clickplumbing.com/terms).</p>
</body></html>`
}
