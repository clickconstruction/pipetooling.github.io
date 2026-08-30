import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2505',
  date: '2026-08-30',
  title: 'Doorways are the ruler — per-page scale and pipe tracing for robot takeoffs',
  kind: 'feature',
  highlights: [
    'Robot takeoffs now calibrate scale per page by measuring doorways (always 3 feet) — median of several doors, outliers flagged, no more trusting stated scales on reduced prints.',
    'The placement engine gained the pipe leg: traced runs with per-system feet, a connectivity check (every fixture needs a run within reach), and loud refusal of lines on uncalibrated pages.',
    'The twin\'s LIVSTE takeoff is now measurably scaled: 5.22 px/ft on the piping plan, cross-checked at 5.20 on the underground plan.',
  ],
}

export default note
