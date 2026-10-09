import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5075',
  date: '2026-10-09',
  title: 'Pipeline: the GC statement cards read the week the way GC Review does',
  kind: 'infra',
  roles: ['dev'],
  highlights: [
    'Behind the scenes, the Pipeline’s two GC statement cards read the week’s checks, marks and account men through the same piece GC Review uses.',
    'Closing GC Review still brings the cards up to date with what was done in it.',
    'New tests cover the cards’ reads, who gets them, and the refresh when GC Review closes.',
  ],
}

export default note
