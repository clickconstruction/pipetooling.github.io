import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8707',
  date: '2026-11-27',
  title: 'The app’s code check leaves out a memory number that could not be trusted',
  kind: 'infra',
  highlights: [
    'Behind the scenes only. The line the code check prints about its memory held two numbers. On most runs one of them read about 30 MB after the check had used 9,000.',
    'The line now leaves that number out when it says nothing, and keeps it where it is true, which is the step that builds each update.',
    'The warning before the check runs out of memory is unchanged. It always read the larger number.',
  ],
}

export default note
