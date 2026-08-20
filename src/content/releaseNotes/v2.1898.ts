import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.1898',
  date: '2026-08-20',
  title: 'Faster, safer shipping behind the scenes',
  kind: 'infra',
  highlights: [
    'The internal changelog moved to a new format that lets several improvements ship in parallel without tripping over each other.',
    'Nothing changes in the app itself — Settings → Release notes looks and works exactly as before.',
  ],
}

export default note
