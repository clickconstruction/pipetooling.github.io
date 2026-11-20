import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7964',
  date: '2026-11-19',
  title: 'Lien desk: scan a divider to enter that envelope’s certified mail number',
  kind: 'feature',
  highlights: [
    'Each divider in the copies to mail now carries a code. Scan it with your phone once that envelope is mailed.',
    'It opens Filed liens: copies to mail with the cursor in that envelope’s number box. Nothing to search for and no wrong lien.',
    'The lien’s line says which day its first number will record as mailed, so you can change Mailed on first if it went out another day.',
    'The mail sheet has a code too. It opens the whole list of mail numbers. The five boxes stay for writing the number down.',
  ],
}

export default note
