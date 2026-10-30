import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6066',
  date: '2026-10-29',
  title: 'My Schedule’s Add job says the job joins your crew',
  kind: 'fix',
  highlights: [
    'The Add job window on My Schedule no longer asks Add me to the job crew. Unticking the box never changed anything: every job you put on your schedule joined your crew anyway.',
    'In its place the window says This job joins your crew, so it shows everywhere you look.',
    'The guide add a job to my schedule and move my day around says the same in step 3.',
  ],
}

export default note
