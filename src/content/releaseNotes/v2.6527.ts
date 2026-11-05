import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6527',
  date: '2026-11-04',
  title: 'Every screen that says whether someone has a login reads the same fact',
  kind: 'infra',
  roles: ['dev'],
  highlights: [
    'Where a row says login or no login, the code now has to read the fact that says so. A screen that forgot to read it drew a person with no login as a login on the day the model shipped; that cannot compile again.',
    'The pickers that hand someone an app task, a pin or an imitation keep listing only people who can sign in, and a test now holds that rule.',
    'The glossary explains login attached and no login in one place.',
  ],
}

export default note
