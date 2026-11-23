import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8325',
  date: '2026-11-22',
  title: 'Send a paper: a second person at the same company gets their own copy',
  kind: 'fix',
  highlights: [
    'Send a paper now says when a company already has that paper out. It names who has it and the day it went.',
    'You can send it to that person again, or send a second copy to someone else at the company.',
    'A second copy no longer replaces the first person. Their copy and their link stay as they are.',
  ],
}

export default note
