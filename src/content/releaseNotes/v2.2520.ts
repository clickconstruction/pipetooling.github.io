import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2520',
  date: '2026-08-30',
  title: 'Audits tab is cleanly view-only for viewing roles',
  kind: 'fix',
  highlights: [
    'Roles that can see robot audits but not write them (primary, superintendent) now get a clean read-only view — the answer boxes, note composers, and Finish audit button no longer appear just to fail.',
    'Robot accounts viewing the tab get the same read-only treatment.',
  ],
}

export default note
