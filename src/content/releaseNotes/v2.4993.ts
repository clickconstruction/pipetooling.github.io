import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4993',
  date: '2026-10-08',
  title: 'Dev login: one sign-in per visit',
  kind: 'infra',
  roles: ['dev'],
  highlights: [
    'Behind the scenes, the developer sign-in page used on a local copy of the app asked for two sign-in links at once. The second cancelled the first, so the console showed an error on many sign-ins.',
    'It now asks once. Nothing changes in the live app.',
  ],
}

export default note
