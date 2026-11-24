import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8487',
  date: '2026-11-24',
  title: 'GC projects and Document builder: three faults a live walk found',
  kind: 'fix',
  highlights: [
    'Document builder: above the one button that sends to everyone ready, a line for each now says who the email goes to. It goes to the first person on the record, and that was not shown before.',
    'Ask for quotes: the line at the bottom counts emails only when Email the invitations now is ticked. With the box empty it reads 1 company is asked, where it read 1 email goes out.',
    'Compare quotes: a quote past the day its number holds now says so under the award button. A window asks first, and its button reads Award on this number.',
  ],
}

export default note
