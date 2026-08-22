import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2068',
  date: '2026-08-22',
  title: 'Combining jobs now explains itself',
  kind: 'feature',
  highlights: [
    'Combining two jobs (or deleting one into another) now posts a note on the surviving job\'s activity — "Combined … into this job — source was Ready to bill at 100%" — under the operator\'s name, so the office and the crew both see where the extra history came from.',
    "Before you confirm a combine, the window now compares both jobs' status and % done and warns when the source was further along — the case where a tech's completion marks would silently vanish.",
    "Status history moved from the deleted job is now tagged, so reports that read a job's timeline can tell its own story from an absorbed job's.",
  ],
}

export default note
