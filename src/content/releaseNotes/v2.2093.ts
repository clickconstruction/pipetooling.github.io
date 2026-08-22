import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2093',
  date: '2026-08-22',
  kind: 'fix',
  title: 'Floaty screen picker: Bids tabs named as the app names them',
  highlights: [
    'The "Where can Floaty appear?" picker now lists Bids tabs in the tab bar\'s own order with its own names — the four call lenses sit grouped under a Followup heading as "By builder, By status, Why we lost, Waiting to hear" instead of internal names like "Builder Review" and "Submission Followup."',
    '"Working" is now "Unsent/Working," matching the tab.',
    'Nothing re-targets: stored configurations keep working unchanged — only the labels and grouping got honest.',
  ],
}

export default note
