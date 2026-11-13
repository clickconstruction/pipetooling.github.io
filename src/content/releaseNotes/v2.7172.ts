import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7172',
  date: '2026-11-13',
  title: 'Subs pay: each sheet says when it was paid',
  kind: 'feature',
  highlights: [
    'On Jobs, Subs, Pay, a sheet\'s row now shows the dates of its payments under the Paid amount. One or two payments show each date. More show the count and the last date.',
    'A paid sheet reads "paid in full" with the date, where it used to read "balance is $0". The Paid chip is now a history you can read down by date.',
    'A payment saved with no Date sent shows the day it was recorded, and says "recorded".',
    'On a phone a paid sheet\'s row says the same, and the sheet\'s window shows what was paid and when.',
  ],
}

export default note
