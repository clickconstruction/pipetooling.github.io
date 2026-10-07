import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4859',
  date: '2026-10-07',
  title: 'People: the old archived-names lookup is removed',
  kind: 'infra',
  highlights: [
    'Since v2.4671 every People tab asks the roster who is archived. The old lookup it replaced is now removed from the database.',
    'Nothing on screen changes.',
  ],
  roles: ['dev'],
}

export default note
