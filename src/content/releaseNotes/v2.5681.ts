import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5681',
  date: '2026-10-20',
  title: 'Estimates: the Tell the customer sheet answers every press',
  kind: 'fix',
  highlights: [
    'Pressing Send on the sheet could do nothing visible: the sheet stayed open, the reason flashed in a toast and was gone, and on one path the email actually went while the sheet still read as if nothing happened.',
    'A send that cannot finish now says why in a band inside the sheet, keeps your typed words, and the button reads Try again.',
    'If the estimate already went, the band says when it went and the button reads Send the link again: a fresh link goes by email and text, and the old link stops working.',
    'A send with no answer after 20 seconds says it may still have gone and tells you to check the thread before pressing again. Closing mid-send answers "Still sending" instead of ignoring you, and the receipt now says when the email itself did not go.',
  ],
}

export default note
