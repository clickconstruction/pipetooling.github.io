import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8134',
  date: '2026-11-20',
  title: 'Permits, Market: the count of companies that build says it covers every city',
  kind: 'fix',
  roles: ['dev', 'master_technician', 'assistant', 'controller', 'estimator'],
  highlights: [
    'The third tile on Market now reads companies we bid pulled a permit in the cities we read. It said here, and showed the same number on every city’s page.',
    'The table’s column is now Permits, all cities, 12 mo, and its first chip is Builds. The numbers did not change.',
    'The small words under a company still say which city its permits are in. Press one to open that builder.',
  ],
}

export default note
