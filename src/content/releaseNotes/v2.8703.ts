import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8703',
  date: '2026-11-27',
  title: 'Recently deleted: a test job’s entry no longer says its Drive folder was left behind',
  kind: 'fix',
  highlights: [
    'A deleted ZZ test job’s entry said its Drive folder was kept, even when deleting the job had already sent the folder to Drive’s trash.',
    'The entry cannot know which, so it now says the job had a Drive folder and to press Open it in Drive to see whether it is still there.',
    'The press that sends the folder to the trash is unchanged. On a folder already in the trash it says so and does nothing more.',
  ],
}

export default note
