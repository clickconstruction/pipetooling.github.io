import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7911',
  date: '2026-11-19',
  title: 'Lien desk: voiding a notice’s record puts the notice back',
  kind: 'fix',
  highlights: [
    'A notice’s mailing recorded by mistake can be taken back cleanly. Void its record in the Lien window and the notice returns to the desk by itself, for everyone in the office.',
    'The notice keeps its approval and its signature, so nobody asks the leader again. A notice that had printed stands in Approved · to mail again.',
    'The count of days toward the attorney’s letter stops with the void. Until now it kept running on a notice that was no longer on record.',
    'The Lien window’s Void says where the notice went.',
  ],
}

export default note
