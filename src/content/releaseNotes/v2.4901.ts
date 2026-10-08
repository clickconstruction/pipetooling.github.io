import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4901',
  date: '2026-10-07',
  title: 'My Time day editor: the day’s splits load from one place',
  kind: 'infra',
  roles: ['dev'],
  highlights: [
    'Behind the scenes, the code that holds a day’s splits in the time editor moved to its own file. It covers the splits, the merge check and the job you pick when two pieces merge.',
    'Nothing changes on screen. Split, merge and drag work exactly as they did.',
    'New tests cover the splits, the merge check, the job pick and the moving end of an open session.',
  ],
}

export default note
