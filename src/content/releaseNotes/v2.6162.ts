import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6162',
  date: '2026-10-30',
  title: 'A progress bill’s lines beside the contract’s, a prototype to compare (punch list #217, outside-1)',
  kind: 'feature',
  highlights: [
    'A bill that is part of a job can show, beside each scaled line, the contract line with its count and this bill’s share of it, with the bill’s share of the contract said once at the top.',
    'It is a prototype: the paper changes only when its address carries shape=1, and Settings → What customers see’s new Side by side press shows today’s bill over the new one.',
    'Side by side sits beside every sample page on What customers see, for the other prototypes too.',
  ],
  roles: ['dev', 'master_technician', 'controller'],
}

export default note
