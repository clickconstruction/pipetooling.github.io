import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5592',
  date: '2026-10-16',
  title: 'Training: Start opens the course for the crew',
  kind: 'fix',
  roles: ['helpers', 'subcontractor', 'primary', 'superintendent', 'estimator'],
  highlights: [
    'A helper who pressed Start on the Training card was sent straight back to the top of the Dashboard. The course page was not on the field roles’ list of pages, so the app bounced them home.',
    'The course page is now open to every role. Who must take a course is still the policy in Settings → Training.',
  ],
}

export default note
