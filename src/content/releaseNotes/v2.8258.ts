import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8258',
  date: '2026-11-21',
  title: 'Lien desk: change the last day of work where it sits',
  kind: 'feature',
  highlights: [
    'The Change link on the last day of work line is gone. A day the app worked out is in bold with Set by hand beside it. A day set by hand is underlined, and a press on it opens its date box right there.',
    'Keep saves nothing by itself. It opens the same window as before, which shows the dates that move and asks why. Set the day in that window is still the one save.',
    'A day set by hand has Back to clock hours in its open box.',
    'In a job’s Lien window, the press under Last work now opens that window straight away, with the day to pick inside it.',
  ],
}

export default note
