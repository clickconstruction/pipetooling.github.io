import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3399',
  date: '2026-09-14',
  title: 'Jobs on a map: crews on the day',
  kind: 'feature',
  highlights: [
    'Tap “Crews” beside the map’s title and every pin where someone clocked in that day wears a violet ring, so the map shows where the trucks went, not just where the jobs are. The rail says how many people were out on how many jobs; a pin’s card says how many clocked in there.',
    'It follows the As-of slider: rewind to a day and the rings show who was where then. The layer is off until you turn it on, and the choice is remembered on this device.',
  ],
}

export default note
