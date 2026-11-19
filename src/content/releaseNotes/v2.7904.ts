import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7904',
  date: '2026-11-19',
  title: 'My email: a save of your mail is in your record only, off Needs you',
  kind: 'fix',
  highlights: [
    'When a developer saves a conversation from your mailbox onto a job, the app keeps a notice for you. The Needs you card showed it as a line under “Your mail” for seven days.',
    'That line is gone. It asked for nothing, and it could not be cleared, so it read as something left to do.',
    'The notice is now only in your record. Open Settings, then the Activity logs tab. The row is under Most recent notifications with the badge In the app.',
    'Nothing else changed. The notice is still written, only you can read it, and nothing is sent to your inbox or pushed.',
  ],
}

export default note
