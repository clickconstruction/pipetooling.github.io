import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4564',
  date: '2026-10-05',
  title: 'Lien releases: the unconditional waits for the check and keeps its kind',
  kind: 'fix',
  highlights: [
    'A bill paid by check now waits seven days before Issue unconditional is offered on Bill Customer or on the Dashboard list. The Bill tab, View bill and GC Review already waited.',
    'On the Dashboard list, a conditional final now reads Conditional · final and opens the Unconditional · final form. Before, every row read progress and opened the progress form.',
    'A release still in draft no longer clears a row from the Dashboard list. The row stays until the unconditional is issued.',
  ],
}

export default note
