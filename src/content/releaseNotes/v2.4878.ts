import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4878',
  date: '2026-10-07',
  title: 'Map: a new address gets pinned again',
  kind: 'fix',
  roles: ['dev', 'master_technician', 'assistant', 'estimator'],
  highlights: [
    'Since this morning, an address the map had not seen before could not be pinned. The ON THE MAP line in New Job and Edit Job said the map services did not answer, and the Map page could not place new addresses.',
    'Addresses the map already knew still showed, which is why it went unnoticed. Both places pin new addresses again, and the line names the county.',
  ],
}

export default note
