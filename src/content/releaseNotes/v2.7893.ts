import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7893',
  date: '2026-11-18',
  title: 'Lien desk: the Board’s two column headings are grey',
  kind: 'feature',
  roles: ['dev', 'master_technician', 'assistant', 'controller'],
  highlights: [
    'On the Board, the headings Monthly notices and Lien affidavits are now both grey. They were blue and red.',
    'Red on the Board now only means a late day. A red heading no longer reads as a late column.',
    'The same holds on a phone and in the dark theme.',
  ],
}

export default note
