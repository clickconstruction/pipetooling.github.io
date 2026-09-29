import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4171',
  date: '2026-09-29',
  title: 'Submittals: the vendor files are a list, one line per file',
  kind: 'feature',
  roles: ['dev', 'master_technician', 'assistant', 'estimator', 'controller'],
  highlights: [
    'Each dropped PDF takes one line: an arrow, the name and page count, the house, where it stands — “none on rows yet”, “57 of 75 on rows · 18 not used”, “trimmed · 6 pages kept · Sep 15” — with a small bar, and the actions on the right: Assign pages…, Done with this file once something is on rows, and a quiet Remove.',
    'The arrow folds the page thumbnails out under the line, with the same tap-a-page-then-a-row path, the robot’s chips and Confirm; Show the pages is gone as a button.',
    'A file whose pages name no row says so on its line — “no page names a row · not a vendor submittal?” — the app reads each file against the rows as it lands, and again when you walk it. A page on two rows names itself on the line and turns the bar amber.',
  ],
}

export default note
