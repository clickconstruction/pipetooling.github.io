import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6687',
  date: '2026-11-08',
  title: 'Your week’s test finishes its no-target job today',
  kind: 'infra',
  roles: ['dev'],
  highlights: [
    'The Your week card’s render test finished one job on a fixed date. When the week rolled over on 2026-11-08 the date fell out of the week and the test failed every pull request’s checks. The job now finishes today, so the test holds whatever the date. Nothing on any screen changes.',
  ],
}

export default note
