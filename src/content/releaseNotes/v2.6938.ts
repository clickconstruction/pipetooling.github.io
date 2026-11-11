import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6938',
  date: '2026-11-11',
  title: 'The case search finds a quoted phrase anywhere in a long document',
  kind: 'fix',
  highlights: [
    'The dev seat’s search across a person’s case missed a quoted phrase in the later part of a long document. The same words without the quotes were found. The phrase is now found wherever it sits.',
    'The same holds for a long file on a record, a long summary and a long document on a matter. It also holds after a word has been used hundreds of times in one section.',
    'A hit’s snippet now shows the phrase itself. It used to start at the first place one of the phrase’s words appeared, which could be far from the phrase.',
    'A word left out with a minus sign now leaves out the section that holds it. It used to drop the whole document.',
  ],
  roles: ['dev'],
}

export default note
