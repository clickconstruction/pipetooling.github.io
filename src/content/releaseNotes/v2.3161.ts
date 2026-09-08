import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3161',
  date: '2026-09-08',
  title: 'Needs You watches supply house job accounts for gaps',
  kind: 'feature',
  highlights: [
    'Two new Dashboard cards, both self-clearing: jobs whose job-account packet went out but still carry unpaid invoices that aren’t flagged "On job account", and invoices flagged on a job account for a job that was never shared with a supply house from the app.',
    'Each card opens Materials → Job Accounts on a matching filter — "Packet on file, unflagged" and "Flagged, no packet" — and expanded job rows now show a teal "Job account packet on file" chip plus a one-line hint about what to do.',
    'Nothing shows until there is something to fix, so a clean book keeps the Dashboard quiet.',
  ],
}

export default note
