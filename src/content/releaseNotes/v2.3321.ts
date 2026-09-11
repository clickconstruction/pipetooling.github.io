import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3321',
  date: '2026-09-11',
  title: 'Cash App reconciliation: the groundwork',
  kind: 'feature',
  highlights: [
    'The app can now keep the Cash App activity export and remember which Cash App name is which person, ready for the reconcile tool on Pay run that lands next.',
    'Person offsets gain an "advance" kind, for pay sent ahead of a report.',
    'Nothing changes on screen yet.',
  ],
}

export default note
