import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7896',
  date: '2026-11-18',
  title: 'Lien desk: the Board’s tiles say where their press goes',
  kind: 'feature',
  roles: ['dev', 'master_technician', 'assistant', 'controller'],
  highlights: [
    'On the Board, the tile that counts what waits on the leader now says Show them › at its top right. Press it and the list under the Board shows only those rows.',
    'While the list is narrowed that way, the tile says Show every row ›. Press it again and the list is whole.',
    'The tile that counts what is to print and mail now says Open the run ›. Both tiles were presses already. Nothing on them said so.',
    'On a phone the print stands right under the tiles, so the third tile only reads there and has no words.',
  ],
}

export default note
