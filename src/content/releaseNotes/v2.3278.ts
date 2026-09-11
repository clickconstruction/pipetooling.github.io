import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3278',
  date: '2026-09-11',
  title: 'Bids: the flow pill stacks its ticks over the words, and the unfolded strip sits centered',
  kind: 'fix',
  highlights: [
    'The flow pill beside a bid’s name now reads as two lines: the ten ticks across the top, “3 of 10 done · next: Review” underneath — instead of ticks and words side by side.',
    'When you unfold the bid flow from the title row, the ten steps now sit centered in their card instead of hugging the left edge.',
    'The Bid Board’s expanded row, which keeps the strip’s “Where this bid is” header, is unchanged.',
  ],
}

export default note
