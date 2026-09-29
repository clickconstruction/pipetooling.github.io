import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4137',
  date: '2026-09-29',
  title: 'Job activity: a soft line between the filter pills and the feed',
  kind: 'fix',
  highlights: [
    'The activity feed on Jobs → Pipeline (and everywhere the job activity view opens) now has a thin line under the filter pills, so a row scrolling out of view disappears under a visible edge instead of looking cut off.',
  ],
}

export default note
