import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4974',
  date: '2026-10-08',
  title: 'Edit Job: the On the map line works for controllers',
  kind: 'fix',
  roles: ['controller', 'dev'],
  highlights: [
    'A controller opening a job saw the On the map line under the address, but every address read could not place it. The pin service refused the controller while the form showed the line. It answers controllers now, like the assistants it already answered.',
    'The line and the pin service read one rule: whoever may open the Map page. Nothing changes for other roles.',
  ],
}

export default note
