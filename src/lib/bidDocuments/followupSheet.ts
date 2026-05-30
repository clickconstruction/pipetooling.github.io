/**
 * Pure builder for the Bids "Followup Sheet" print document (`printFollowupSheet`).
 *
 * The caller (`Bids.tsx`) performs all data gathering (supabase fetch, grouping the latest
 * submission entries per bid) and runs every formatter (dates, currency, contact-info, note
 * author/time), handing this builder fully display-ready data. The builder only escapes,
 * assembles tel:/mailto: links, maps the win/loss outcome label, and lays out the markup.
 * No supabase / window / app-state.
 */

import { escapeHtml } from './htmlDoc'

export interface FollowupSubmissionEntry {
  /** Escaped by the builder. */
  contactMethod: string | null
  /** Escaped by the builder. */
  notes: string | null
  /** Pre-formatted (or '—'); trusted, inserted without escaping. */
  time: string
  /** Raw author by-line; escaped by the builder. */
  author: string
}

export interface FollowupProject {
  /** Escaped by the builder (?? '—'). */
  projectName: string | null
  address: string | null
  /** Resolved upstream ('—' or value); escaped by the builder. */
  builderName: string
  builderAddress: string
  /** Resolved upstream ('—' or value); builder builds a tel:/mailto: link when not '—'. */
  builderPhone: string
  builderEmail: string
  /** Raw gc_contact_name (?? '—' applied by builder). */
  projectContact: string | null
  /** Raw; builder builds a link when truthy and not '—'. */
  projectContactPhone: string | null
  projectContactEmail: string | null
  /** Mapped to a label by the builder. */
  outcome: string | null
  /** Pre-formatted; trusted, inserted without escaping. */
  bidDate: string
  bidDateSent: string
  designDrawingPlanDate: string
  bidValue: string
  agreedValue: string
  distance: string
  /** Escaped by the builder (?? '—'). */
  notes: string | null
  submissionEntries: FollowupSubmissionEntry[]
}

export interface FollowupGroups {
  notYetWonOrLost: FollowupProject[]
  won: FollowupProject[]
}

export type FollowupSheetInput =
  | { mode: 'all'; title: string; managers: Array<{ name: string; groups: FollowupGroups }>; unassigned: FollowupGroups | null }
  | { mode: 'unassigned'; title: string; groups: FollowupGroups }
  | { mode: 'manager'; title: string; name: string; groups: FollowupGroups }

function formatOutcome(outcome: string | null): string {
  if (!outcome) return '—'
  if (outcome === 'won') return 'Won'
  if (outcome === 'lost') return 'Lost'
  if (outcome === 'started_or_complete') return 'Started/Complete'
  return '—'
}

function renderSubmissionEntries(entries: FollowupSubmissionEntry[]): string {
  if (entries.length === 0) return ''
  return `
        <div class="submission-entries">
          <div class="submission-header">Recent Contact Attempts:</div>
          ${entries.map((entry, idx) => `
            <div class="submission-entry">
              <span class="submission-label">${idx + 1}.</span>
              <span class="submission-label">Contact Method:</span> ${escapeHtml(entry.contactMethod ?? '—')}
              <span class="submission-label">Notes:</span> ${escapeHtml(entry.notes ?? '—')}
              <span class="submission-label">Time:</span> ${entry.time}
              <span class="submission-label">Author:</span> ${escapeHtml(entry.author)}
            </div>
          `).join('')}
        </div>
      `
}

function renderProject(p: FollowupProject): string {
  return `<div class="project">
        <div class="project-title">Project: ${escapeHtml(p.projectName ?? '—')}</div>
        <div class="field"><span class="label">Address:</span> ${escapeHtml(p.address ?? '—')}</div>
        <div class="field-indented"><span class="label">Builder:</span> ${escapeHtml(p.builderName)}</div>
        <div class="field-indented"><span class="label">Builder Phone:</span> ${p.builderPhone !== '—' ? `<a href="tel:${p.builderPhone.replace(/[^0-9+]/g, '')}">${escapeHtml(p.builderPhone)}</a>` : '—'}</div>
        <div class="field-indented"><span class="label">Builder Address:</span> ${escapeHtml(p.builderAddress)}</div>
        <div class="field-indented"><span class="label">Builder Email:</span> ${p.builderEmail !== '—' ? `<a href="mailto:${escapeHtml(p.builderEmail)}">${escapeHtml(p.builderEmail)}</a>` : '—'}</div>
        <div class="field"><span class="label">Project Contact:</span> ${escapeHtml(p.projectContact ?? '—')}</div>
        <div class="field"><span class="label">Project Contact Phone:</span> ${p.projectContactPhone && p.projectContactPhone !== '—' ? `<a href="tel:${p.projectContactPhone.replace(/[^0-9+]/g, '')}">${escapeHtml(p.projectContactPhone)}</a>` : '—'}</div>
        <div class="field"><span class="label">Project Contact Email:</span> ${p.projectContactEmail && p.projectContactEmail !== '—' ? `<a href="mailto:${escapeHtml(p.projectContactEmail)}">${escapeHtml(p.projectContactEmail)}</a>` : '—'}</div>
        <div class="field-indented"><span class="label">Win/ Loss:</span> ${formatOutcome(p.outcome)}</div>
        <div class="field-indented"><span class="label">Bid Date:</span> ${p.bidDate}</div>
        <div class="field-indented"><span class="label">Bid Date Sent:</span> ${p.bidDateSent}</div>
        <div class="field-indented"><span class="label">Design Drawing Plan Date:</span> ${p.designDrawingPlanDate}</div>
        <div class="field"><span class="label">Bid Value:</span> ${p.bidValue}</div>
        <div class="field"><span class="label">Agreed Value:</span> ${p.agreedValue}</div>
        <div class="field"><span class="label">Distance to Office:</span> ${p.distance}</div>
        <div class="field"><span class="label">Notes:</span> ${escapeHtml(p.notes ?? '—')}</div>
        ${renderSubmissionEntries(p.submissionEntries)}
      </div>`
}

function renderGroups(groups: FollowupGroups): string {
  let html = '<h2>Not yet won or lost</h2>'
  if (groups.notYetWonOrLost.length === 0) {
    html += '<p class="empty-section">None</p>'
  } else {
    html += groups.notYetWonOrLost.map(renderProject).join('')
  }

  html += '<h2>Won</h2>'
  if (groups.won.length === 0) {
    html += '<p class="empty-section">None</p>'
  } else {
    html += groups.won.map(renderProject).join('')
  }

  return html
}

function docShell(rawTitle: string, body: string): string {
  const title = escapeHtml(rawTitle)
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${title}</title><style>
  body { font-family: sans-serif; margin: 1in; }
  h1 { font-size: 1.3rem; margin-bottom: 0.75rem; }
  h2 { font-size: 1.1rem; margin: 1rem 0 0.4rem; border-bottom: 2px solid #333; padding-bottom: 0.2rem; }
  .project { margin-bottom: 1rem; padding: 0.75rem; border: 1px solid #ddd; border-radius: 4px; page-break-inside: avoid; }
  .project-title { font-weight: bold; font-size: 1rem; margin-bottom: 0.4rem; }
  .field { margin: 0.15rem 0; }
  .field-indented { margin: 0.15rem 0; padding-left: 10ch; }
  .label { font-weight: bold; }
  .empty-section { color: #6b7280; font-style: italic; }
  a { color: #3b82f6; text-decoration: none; }
  a:hover { text-decoration: underline; }
  .submission-entries { margin-top: 0.5rem; padding-top: 0.5rem; border-top: 1px solid #e5e7eb; }
  .submission-header { font-weight: bold; margin-bottom: 0.3rem; font-size: 0.9rem; }
  .submission-entry { margin: 0.2rem 0; font-size: 0.85rem; padding-left: 1rem; }
  .submission-label { font-weight: bold; margin-right: 0.3rem; }
  @media print { 
    body { margin: 0.4in; }
    .project { page-break-inside: avoid; }
  }
</style></head><body>
  ${body}
</body></html>`
}

export function buildFollowupSheetHtml(input: FollowupSheetInput): string {
  if (input.mode === 'all') {
    const allSections: string[] = []
    for (const manager of input.managers) {
      allSections.push(`<div style="page-break-after: always;">
          <h1>Followup Sheet for ${escapeHtml(manager.name)}</h1>
          ${renderGroups(manager.groups)}
        </div>`)
    }
    if (input.unassigned) {
      allSections.push(`<div>
          <h1>Followup Sheet for Unassigned</h1>
          ${renderGroups(input.unassigned)}
        </div>`)
    }
    let bodyContent = allSections.join('')
    if (input.managers.length === 0 && !input.unassigned) {
      bodyContent = '<p class="empty-section">No bids found.</p>'
    }
    return docShell(input.title, bodyContent)
  }

  if (input.mode === 'unassigned') {
    const bodyContent = `<h1>Followup Sheet for Unassigned</h1>
        ${renderGroups(input.groups)}`
    return docShell(input.title, bodyContent)
  }

  const bodyContent = `<h1>Followup Sheet for ${escapeHtml(input.name)}</h1>
        ${renderGroups(input.groups)}`
  return docShell(input.title, bodyContent)
}
