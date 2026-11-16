import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7395',
  date: '2026-11-15',
  title: 'Lien desk: a signature on a notice is the full name',
  kind: 'fix',
  highlights: [
    'A lien notice signed with a signing code now carries the master’s full name, like “Malachi Whites”. It used to carry the short name on his account.',
    'The same holds when he presses Sign under his own sign-in, draws his signature, or the office records his pen signature.',
    'The full name comes from Full name and title on his account, up to the first comma. With that field empty, the paper carries his account name.',
    'The grey signature on the signing line previews the full name before anyone signs.',
  ],
}

export default note
