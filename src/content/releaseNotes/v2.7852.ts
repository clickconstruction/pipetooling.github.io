import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7852',
  date: '2026-11-18',
  title: 'Lien desk: the affidavits’ To send bin counts what its press sends',
  kind: 'fix',
  roles: ['dev', 'master_technician', 'assistant', 'controller'],
  highlights: [
    'The affidavits’ To send for Master approval bin read 5 beside Send 1 for approval. The press sends only the papers someone has read.',
    'The bin now counts those papers, so its count and its press are one number.',
    'A paper nobody has read still stands in the bin, after the others, with a dashed edge and a ○ mark.',
    'Press a marked chip to open that paper and read it. Once it is read, the send takes it.',
  ],
}

export default note
