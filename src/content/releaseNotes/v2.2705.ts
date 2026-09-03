import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2705',
  date: '2026-09-03',
  title: 'GC review nudge counts the way the modal does',
  kind: 'fix',
  highlights: [
    'The Dashboard "GC review is still due" card no longer says every GC is certified while the GC Review modal says otherwise: a certification only counts while the group still matches what was signed off, and a GC with nothing outstanding is left out of the count on both sides.',
    'The card\'s number is now how many GCs still need something — certified and sent — instead of dropping to 0 as soon as everything is certified with no statements sent. When every group is certified, the card says so and asks you to send.',
  ],
}

export default note
