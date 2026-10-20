import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5558',
  date: '2026-10-15',
  title: 'GC projects: the clock’s weeks run Sunday to Saturday',
  kind: 'feature',
  roles: ['dev', 'master_technician', 'assistant', 'controller', 'estimator'],
  highlights: [
    'On a project’s card, The clock now starts each week on Sunday, the way a wall calendar does. The week’s dates over the squares, the letters over the days and the phone’s small calendar all follow.',
    'A quiet week keeps its one rectangle for Monday to Friday, with Sunday on its left and Saturday on its right. While building, a square a week starts on Sunday too.',
    'The weekly report and the schedule keep their Monday work weeks. Only the clock changed.',
  ],
}

export default note
