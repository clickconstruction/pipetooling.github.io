import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7758',
  date: '2026-11-18',
  title: 'Pipeline on a phone: what a row’s Next line reads is gathered by a tested piece',
  kind: 'infra',
  roles: ['dev'],
  highlights: [
    'Behind the scenes, the code that gathers what each phone row needs for its Next line lives in its own file, with tests. It had none before.',
    'Nothing changes on screen. Each row shows the same Next line and the same chips.',
  ],
}

export default note
