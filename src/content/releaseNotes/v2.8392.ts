import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8392',
  date: '2026-11-23',
  title: 'Job cost reads each person\'s pay by the shortest way',
  kind: 'fix',
  highlights: [
    'A job\'s Cost and Labor panels, the crew P&L, bid labor and the Projects board add up the hours each person worked. For each day they now look up the person\'s pay directly instead of reading every pay row to find it.',
    'The hours and the costs are the same as before. They keep their speed as the crew grows.',
  ],
}

export default note
