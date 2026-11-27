import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8751',
  date: '2026-11-27',
  title: 'The trade portal on a small phone: a job’s page fits the screen',
  kind: 'fix',
  highlights: [
    'On a small iPhone, every card on a job’s page in a trade partner’s portal ran off the right side. The cut part could not be reached.',
    'The cause was the file picker under Your quote file, which the phone draws wider than its card.',
    'Every card now keeps to the page’s width, and the file picker keeps to its card.',
  ],
}

export default note
