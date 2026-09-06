import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2934',
  date: '2026-09-06',
  title: 'Robot audits: see whether it miscounted or mispriced',
  kind: 'feature',
  highlights: [
    'A new "Priced differently" list on each robot audit card catches rows where the robot counted right but priced wrong — its rate per foot or per fixture beside ours, biggest dollars first, with the same one-tap verdicts.',
    'A "Where the delta lives" strip splits the headline difference into named dollars — missed rows, added rows, count gaps, rate gaps, and everything else — so one glance says what kind of miss it was.',
    'Until now a row the robot counted right but priced five times too high was hidden inside "rows match — nothing to judge there."',
  ],
}

export default note
