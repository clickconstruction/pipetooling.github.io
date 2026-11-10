import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6835',
  date: '2026-11-10',
  title: 'Permits: Kept, Pursuing and Closed, a hand-off, builders with a mark, and the count',
  kind: 'feature',
  highlights: [
    'A strip across Prospects → Permits counts where every permit is: Skim, Kept, Pursuing and Closed. A kept permit can be handed to a person, from the bar after a keep or from its row. The Dashboard’s Needs you card says when permits wait on a skim: the Leader is asked first, and the rest of the team once one has waited two days.',
    'A kept permit opens with what was done on it and two presses. Pursue asks what for (this job, their next jobs, or both) and who follows up, then makes the lead. Not pursuing takes one tap of why.',
    'Closed holds every pass, every permit a plumber has, and every one dropped after a look. Search a street, a builder or a permit number, and press Put back to send one to the skim again.',
    'Builders lists everyone who pulled a commercial permit in the last year, with how many have no plumber yet, the plumber they use and our bids with them. Mark a builder Good or Avoid with a line of why; the mark shows on the skim card and moves it in the deck.',
  ],
}

export default note
