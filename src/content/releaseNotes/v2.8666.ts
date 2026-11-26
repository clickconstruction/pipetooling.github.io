import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8666',
  date: '2026-11-26',
  title: 'A developer can set a seat\'s role on CountTooling and TakeoffTooling from here',
  kind: 'infra',
  highlights: [
    'The two doors a developer uses to reach CountTooling and TakeoffTooling can now carry a role change.',
    'On CountTooling that is overseer, lead and admin. On TakeoffTooling it is user, admin or dev.',
    'The TakeoffTooling door can also retire a seat and bring it back, as the CountTooling door already could.',
    'Nothing on a screen uses these yet. They are the groundwork for the Sites rows on a person\'s desk.',
  ],
}

export default note
