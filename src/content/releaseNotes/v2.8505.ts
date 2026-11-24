import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8505',
  date: '2026-11-24',
  title: 'The app’s code check reads the app in three parts, so it fits its memory',
  kind: 'infra',
  highlights: [
    'Behind the scenes only. Before each update goes out, a check reads all of the app’s code. Read as one piece, the app needed more memory than the checking machines would have within a week.',
    'The check now reads the app in three parts, one after the other. Every file is still checked, and the largest part needs about two thirds of the memory the whole did.',
    'The step that builds each update now checks the app’s own code alone, which takes about half the time. The tests were already checked before the change went in.',
  ],
}

export default note
