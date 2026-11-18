import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7731',
  date: '2026-11-17',
  title: 'Pipeline: what a row reads is put together in one place',
  kind: 'infra',
  roles: ['dev'],
  highlights: [
    'Behind the scenes, the Pipeline’s tables and phone cards put together what each row reads in one shared piece of code. Each of the four lists had its own copy.',
    'Nothing changes on screen.',
    'New tests cover that piece and how each list uses it.',
  ],
}

export default note
