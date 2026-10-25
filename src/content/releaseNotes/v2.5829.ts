import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5829',
  date: '2026-10-24',
  title: 'Quickfill checklists: a box keeps its ticks when it is reworded or removed',
  kind: 'fix',
  highlights: [
    'In Edit checklist on Office Arriving, Office Leaving and Assistant Dailys, each box now has a Rename button. It changes the box’s words in place, so the box keeps every tick it has had. Enter saves and Escape leaves it as it was.',
    'Remove takes a box off the list and no longer deletes its past ticks. Before this, rewording a box meant removing it and adding it again, which wiped its history.',
    'History lost before today cannot be brought back, so a station’s Mark history still counts each box from its first tick on record.',
  ],
}

export default note
