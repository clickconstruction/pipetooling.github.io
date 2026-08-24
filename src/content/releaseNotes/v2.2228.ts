import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2228',
  date: '2026-08-24',
  title: 'Billed-report email counts every billed line',
  kind: 'fix',
  highlights: [
    'The Billed Awaiting Payment email now includes billed lines on jobs that are still in Working — progressive-billing break-offs were being left out, so the emailed report showed fewer rows than the printed one.',
    'The emailed report and the on-screen board now agree on the same rows and the same grand total.',
  ],
}

export default note
