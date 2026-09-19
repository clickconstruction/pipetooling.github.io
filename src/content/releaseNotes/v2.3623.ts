import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3623',
  date: '2026-09-19',
  title: 'Punch list: the board is rendered at build time, so to-do changes stop colliding',
  kind: 'infra',
  highlights: [
    'The punch list on /punch-list is now rendered from the to-do files when the app is built, instead of from a generated file kept in the repo. The board still shows exactly what is on main.',
    'Two changes to different to-dos no longer conflict with each other in review: there is no shared generated file for them to fight over, and no regenerate-and-recommit step.',
  ],
}

export default note
