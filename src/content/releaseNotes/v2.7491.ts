import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7491',
  date: '2026-11-16',
  title: 'Lien desk: remind the leader of notices that wait on a signature',
  kind: 'feature',
  highlights: [
    'Remind now takes an approved notice that waits on the leader’s signature. Before, the press took only a paper that waited on an approval, so on most days it was not there at all.',
    'The press also stands on the Board, beside the line that counts the notices waiting on a signature. It reminds the leader of everything that waits, to approve and to sign.',
    'The notices to sign go as one message, whatever the count. It names the jobs and the first day to mail by, and its tap opens the approved notices.',
    'A notice signed or printed since the list was drawn is left out, and the desk says how many the leader was reminded of.',
  ],
}

export default note
