import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6651',
  date: '2026-11-07',
  title: 'GC mode: the rough schedule draws a template made on the Templates page, and the job’s own work lands in a phase',
  kind: 'feature',
  roles: ['dev', 'master_technician', 'assistant', 'controller', 'estimator'],
  highlights: [
    'While we bid, Start from a template on the rough schedule now draws a template made on the Templates page: every row lands from the start day, the pick says what lands where, and the weeks follow the rows. The rough keeps its own copy, so a later change to the template never moves a bid.',
    'When we win, the first draft draws from that same copy, the way the rough did.',
    'Add an activity on a schedule drawn with phases offers a Phase pick, so the job’s own work lands in its phase on the chart and the list instead of under Not in a phase.',
    'The template save on the Templates page now goes through the typed call.',
  ],
}

export default note
