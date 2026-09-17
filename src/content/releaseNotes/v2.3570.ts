import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3570',
  date: '2026-09-17',
  title: 'Jobs → Reports: one Email reports button, one window, two tabs',
  kind: 'feature',
  highlights: [
    'The two toolbar buttons — Recurring Email Reports and Report email recipients — are one Email reports button. Inside, a sentence names the two kinds and two tabs hold them: Digests (a bundle on a schedule) and Every report (one email per report, as filed).',
    'On Digests the schedules come first; the preview and test-send controls fold under "Preview or send a test". Every report keeps today\'s recipient cards.',
    'The Dashboard\'s Recent Reports mail button opens the same window on Every report. Settings and the help guides say "Email reports" where they said the old names.',
  ],
}

export default note
