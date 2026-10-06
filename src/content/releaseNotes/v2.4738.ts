import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4738',
  date: '2026-10-06',
  title: 'Edge drift check: it names each function still running old shared code',
  kind: 'infra',
  roles: ['dev'],
  highlights: [
    'The check follows each server function into every file it loads, shared files included. When a shared file changes, it names each function still running the old copy and the commits it is missing.',
    'Before it calls a function out of date, it reads what is deployed. A function deployed from its branch just before the merge matches and passes, so no waiting period hides a real one.',
    'The daily run reads every deployed function. That also catches one deployed from an old copy of the code after the change merged.',
  ],
}

export default note
