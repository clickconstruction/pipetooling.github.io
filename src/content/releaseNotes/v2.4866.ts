import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4866',
  date: '2026-10-07',
  title: 'Records for an owner: two fixes from the first walk',
  kind: 'fix',
  roles: ['dev', 'master_technician', 'assistant', 'controller'],
  highlights: [
    'When the job has no address, the acknowledgment now reads I am an owner of this property. Before, the portal showed a sentence that ended at a blank, and the printed copy said the property at this property.',
    'Once an owner signs on their portal, check 1 no longer offers Change. Their signing is the request, the same way check 4 already keeps their signature as it is.',
  ],
}

export default note
