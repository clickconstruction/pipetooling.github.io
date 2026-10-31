import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6208',
  date: '2026-10-30',
  title: 'The words of an affidavit from the Legal desk, under test (punch list #220, PR 1 of six)',
  kind: 'infra',
  highlights: [
    'The rules for a sworn statement made from the Legal desk are written and tested: who swears it, the day it is about, how it is signed, the county on the venue line, and the three ways to print it.',
    'The notary’s certificate under the lien affidavit and under a desk affidavit now come from one place, so both papers read one jurat.',
    'Nothing on screen changes yet. The window that uses these words comes in the next PRs.',
  ],
  roles: ['dev'],
}

export default note
