import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2438',
  date: '2026-08-28',
  title: 'CountTooling bridge, part 3: the weekly drift audit',
  kind: 'infra',
  highlights: [
    'Every Monday morning the two apps compare their people rosters and email the result: accounts only on CountTooling, links pointing at vanished accounts, someone retired on one side but active on the other, mismatched flags, changed emails, and easy backfill wins.',
    'The email always arrives — an all-clear note is the heartbeat, so a missing Monday email is itself the alarm.',
  ],
}

export default note
