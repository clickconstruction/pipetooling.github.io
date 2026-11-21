import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8114',
  date: '2026-11-20',
  title: 'Permits: one Austin builder is one name',
  kind: 'fix',
  roles: ['dev', 'master_technician', 'assistant', 'controller', 'estimator'],
  highlights: [
    'Austin writes a mark after some contractors\' names: the word MAIN between asterisks, or (MAIN). The app now reads the name without it.',
    'A company with the mark and the same company without it were two rows on Builders and on Call this week. They are one row now, with all of its permits.',
    'Companies with a comma in the name and the mark after it were counted together as one builder named MAIN. Each is its own builder again.',
    'The Austin permits already stored are cleaned the same way. Each permit still keeps the city\'s own text.',
  ],
}

export default note
