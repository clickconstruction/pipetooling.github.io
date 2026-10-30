import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6068',
  date: '2026-10-29',
  title: 'A picked chip or a blue press reads in dark mode',
  kind: 'fix',
  roles: ['dev', 'master_technician', 'assistant', 'controller', 'estimator', 'primary', 'superintendent', 'subcontractor', 'helpers'],
  highlights: [
    'In dark mode a picked day on Settings → Phone and texts → Office hours, Jobs → Team’s Board switch, Quickfill’s Roller switch and Round press, People → Feedback’s Try the deck, the Pipeline’s Start the sweep and a few blue Save presses drew white words on a light blue. Their words are now dark on that blue in dark mode, and the picked days and Saves on the Phone and texts cards wear the same blue as every other picked chip, a shade deeper in light mode.',
    'On a phone, People → Users’ swipe-to-More button is a steadier grey, so its word reads in both themes.',
    'Nothing else about these presses changed.',
  ],
}

export default note
