import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8735',
  date: '2026-11-27',
  title: 'Lien release: only a leader, a controller or a dev releases before a check clears',
  kind: 'fix',
  highlights: [
    'On the Release of record tab, Release it anyway on a check the bank has not cleared now shows to a leader, a controller or a dev alone.',
    'Anyone else reads a line that says who can release it. The tab still says the day the check clears.',
    'A release with money still open is unchanged. Whoever opens the tab can type its reason.',
  ],
}

export default note
