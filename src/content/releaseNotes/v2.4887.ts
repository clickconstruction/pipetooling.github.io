import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4887',
  date: '2026-10-07',
  title: 'Pipeline: Statements to send counts the GCs that broke a promise',
  kind: 'fix',
  roles: ['dev', 'master_technician', 'assistant', 'controller'],
  highlights: [
    'The Statements to send card on the Pipeline now says how many of its GCs missed the pay date they gave. A pay date given in an earlier week counts too.',
  ],
}

export default note
