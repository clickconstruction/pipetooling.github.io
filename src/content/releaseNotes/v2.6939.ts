import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6939',
  date: '2026-11-11',
  title: 'An agent on the dev seat reads every list of a large HR case whole',
  kind: 'fix',
  highlights: [
    'On a very large HR file, the two reads an agent uses to open a case stopped each list at 200 rows. Only the HR entries were read whole.',
    'Every list is now read whole: the files, the evidence records, the reports, the papers, the licenses, the documents and the theme marks.',
    'An evidence record now shows all its files on a file with more than 200 of them. A theme shows its full count.',
  ],
}

export default note
