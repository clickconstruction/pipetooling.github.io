import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7741',
  date: '2026-11-18',
  title: 'Lien desk: a last day set by hand shows its reason',
  kind: 'fix',
  highlights: [
    'On the Lien desk, the line above Months on this job now shows why a last day of work was set by hand, and the day it was set. The Lien window already showed both.',
    'The press under Last work on the timeline opens its window with that reason in it. Before, the window opened with an empty reason over a day already set by hand.',
    'Nothing about the day or its dates changed. The desk now reads what was already saved on the job.',
  ],
}

export default note
