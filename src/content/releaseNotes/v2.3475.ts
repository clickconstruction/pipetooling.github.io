import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3475',
  date: '2026-09-15',
  title: 'Import from /Tooling no longer turns the counts header into a fixture',
  kind: 'fix',
  highlights: [
    'CountTooling now puts a "--- Counts, <project> · every sheet ---" header on every copy; on a project whose name starts with a year it imported as a fixture called "--- Counts" with a count of 2026 and no page.',
    'Framed "--- … ---" lines are read as headings now — dropped silently, not counted as skipped rows — so re-importing a takeoff brings in only the real counts.',
  ],
}

export default note
