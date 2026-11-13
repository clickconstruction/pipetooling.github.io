import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7070',
  date: '2026-11-12',
  title: 'What customers see: the sample notice of claim agrees with its cover letter',
  kind: 'fix',
  highlights: [
    'In Settings, What customers see, Lien letters, the sample notice of claim named a different month from the cover letter in front of it. It now names the same month as every other letter in the group.',
    'The sample notice was dated today. It is now dated the day the sample job’s notice was mailed, the day the lien affidavit swears.',
    'Only the made-up sample changed. No real notice, letter or filing is touched.',
  ],
}

export default note
