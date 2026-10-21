import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5699',
  date: '2026-10-21',
  title: 'Messages: Went out keeps the last 7 days, under the day each text went',
  kind: 'feature',
  highlights: [
    'Went out today emptied at midnight: a text sent at 1:33 PM was gone from the page by 12:01 AM, with nothing else on the page to show for it.',
    'The section is now Went out, the texts we sent in the last 7 days, newest first, under Today, Yesterday and the day’s date.',
  ],
}

export default note
