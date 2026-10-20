import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5142',
  date: '2026-10-10',
  title: 'GC mode: walk the schedule each week, pull work in, get days back, for a dev',
  kind: 'feature',
  roles: ['dev'],
  highlights: [
    'Update the week on a job we are building goes through each bar that should have moved. Keep it, give it its real days, or move it and say why.',
    'When work finishes early, Pull the work earlier brings in what was right behind it, saved as one move.',
    'A job running late shows a Days back card with each way to bring the finish in, and Call to ask the trade first.',
    'A bar’s form says first when its trade’s papers are not in. The schedule now shows the holds of submittals and RFIs too.',
  ],
}

export default note
