import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7839',
  date: '2026-11-18',
  title: 'Materials on site: a watch on one person',
  kind: 'feature',
  highlights: [
    'A dev can turn on a watch for one person from their row in People, under Watch on site. The person sees nothing different.',
    'On a site’s By person look a watched person’s presses outside the process read in red: a count, a part added, a box change, or a take with no note.',
    'A line names the boxes a watched person opened on a screen and pressed nothing on.',
    'A watch is stopped with a reason and stays on record. Alerts are not sent yet.',
  ],
}

export default note
