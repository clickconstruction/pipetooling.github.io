import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3484',
  date: '2026-09-15',
  title: 'A sent bid says what it was sent at, beside what the book prices it at today',
  kind: 'feature',
  highlights: [
    'On a bid that has gone out, one line under the Pricing revenue strip and under the Cover Letter total: "Sent Jul 1 at $379,895.70 · the book prices it at $385,506.07 today (+$5,610.37)".',
    'When the two agree to the cent the line goes quiet and grey; when they differ it is amber, with the difference signed.',
    'The sent number is the value stamped when the bid was marked sent — the one the customer was quoted. The grid and the letter recompute from the price book, and on older bids that copy was frozen after the send, so the two can drift apart.',
    'Nothing is written; unsent bids show nothing.',
  ],
}

export default note
