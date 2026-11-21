import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8206',
  date: '2026-11-21',
  title: 'Lien desk: a missed notice that can no longer go stops asking for a month',
  kind: 'fix',
  highlights: [
    'A missed notice whose every window closed, with no late notice left to send, still showed the four gates. It read Can’t go out yet and a red No month picked, over months nobody could tick.',
    'Its gates now fold to one line, as on a sent notice. The line reads the day the window closed, then the owner, the GC, the kind and the months whose window closed.',
    'The line pinned at the top reads Window closed and the month. The Months on this job bar reads the month and closed.',
    'A missed notice that can still go late keeps its four gates, because a notice is still to be sent there.',
  ],
}

export default note
