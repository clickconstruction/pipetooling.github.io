import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8047',
  date: '2026-11-20',
  title: 'Job Mode: a row of named squares that follows your day',
  kind: 'feature',
  roles: ['subcontractor', 'helpers', 'superintendent', 'master_technician', 'dev', 'assistant', 'controller', 'primary', 'estimator'],
  highlights: [
    'In Job Mode the row under the header is equal squares, each with its name. Paint a map is one square, not a card as wide as the screen.',
    'The two squares on the left are for your job. Before a job and on the way they are Directions and Job details. On site the first one is Photo.',
    'With no job left today, the two squares show your hours this week and how many jobs you have tomorrow.',
    'The blue square with no name is now My spend, with a count of the card charges that have no job yet.',
  ],
}

export default note
