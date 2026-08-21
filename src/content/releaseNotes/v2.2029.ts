import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2029',
  date: '2026-08-21',
  title: 'Job review: session drill-down + bulk move hours',
  kind: 'feature',
  highlights: [
    'Every job on the Partnerships Job review tab gets a "sessions" dropdown — each clock session with its day, times, hours, and the note the partner left on it.',
    'Check off sessions that landed on the wrong job and move them in one shot: pick the right job, hit Move hours, and the shares recompute immediately.',
    "Sessions already on a generated statement are flagged — pay stays as stamped; the hours move for job costing and review shares. Every move is logged in the partnership's change history.",
  ],
}

export default note
