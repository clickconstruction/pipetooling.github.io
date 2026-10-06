import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4720',
  date: '2026-10-06',
  title: 'Counts: an import runs once, and it is fast',
  kind: 'fix',
  highlights: [
    'Pressing Import a second time while an import is still running no longer imports the clipboard twice. The button reads Importing… and waits until the rows land.',
    'An import writes all its rows in one go instead of one at a time, so a thirty-row copy lands in a moment instead of looking stuck.',
    'The paste box and the Import from /Tooling button both hold still while a run is in flight. Cancel waits too.',
  ],
}

export default note
