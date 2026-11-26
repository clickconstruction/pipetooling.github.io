import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8657',
  date: '2026-11-26',
  title: 'People, Users: a developer sees each person\'s seat on CountTooling and TakeoffTooling',
  kind: 'feature',
  highlights: [
    'People, Users has a fourth view for a developer, Sites. Each row says whether the person has a seat on CountTooling and on TakeoffTooling, and whether that seat is active or retired.',
    'A row also says the role they hold there, a robot\'s seat, and when the site holds a different address for them.',
    'A line above the list counts the accounts on each site that match nobody here.',
    'The view reads only. Making or retiring a seat stays on the person\'s desk.',
  ],
}

export default note
