import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.1983',
  date: '2026-08-21',
  title: 'Certify each GC in GC Review — the Wednesday ritual',
  kind: 'feature',
  highlights: [
    'GC Review now tracks a weekly certification, due Wednesday: an amber strip shows "N of M certified · K sent", and every GC group gets a Certify… button.',
    'Certifying is a per-bill checklist — check off each bill, peek at its recent activity with the ▾ chevron, or click the job to open Job Detail on top without losing your place. Certify & send… goes straight into the Email dialog.',
    'If a group changes after sign-off (new bill, payment), its chip flips to "Changed since certified" with the dollar delta and a Re-certify button — a sent statement never silently drifts from what was reviewed.',
  ],
}

export default note
