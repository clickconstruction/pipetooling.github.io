import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4670',
  date: '2026-10-06',
  title: 'Help: the "it" warning names only the sentences you wrote',
  kind: 'infra',
  roles: ['dev'],
  highlights: [
    'The warning on a guide sentence that opens on "it" or "that" now lists only the lines your change wrote. Older sentences in the same guide are counted in one line, so the ones you wrote stand out.',
    'Run it with --all to see every sentence in the guide.',
  ],
}

export default note
