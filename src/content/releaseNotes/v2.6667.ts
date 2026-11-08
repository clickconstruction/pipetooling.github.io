import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6667',
  date: '2026-11-07',
  title: 'Messages: a mail too big to copy no longer stops the bids@ reader',
  kind: 'fix',
  highlights: [
    'On November 6 a bid mail with a large file reached bids@, and copying the file stopped the reader. It tried the same mail again every minute for hours, and Gmail then refused to let the app read bids@ at all.',
    'Now the reader notes which mail it is copying first. If a copy stops it, the next try takes that mail into Messages with its files left in Gmail, and the reader moves on.',
    'The reader also copies files with far less memory, so a large plan file is far less likely to stop it.',
    'Settings → Phone and texts → Read bids@ shows the mail by its Gmail id while that happens.',
  ],
}

export default note
