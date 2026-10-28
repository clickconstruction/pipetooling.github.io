import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6029',
  date: '2026-10-28',
  title: 'Messages: a push outside your hours waits for you',
  kind: 'feature',
  highlights: [
    'A customer’s reply is no longer pushed to you outside the hours you set under Push me. The push waits, kept as what waited, so a coming update can list it on your Dashboard.',
    'When the person who has a reply is off, the office hears at once: Dana wrote to Luis, who is off until 6 AM, then her words. The reply stays theirs on Messages, and the office can take it.',
    'The office’s push after the wait goes to the office members who are on, and waits for the rest. When the Customers seat alone is named and off, the push widens to the office roles who are on.',
    'The line under Push me now says the hold is real.',
  ],
}

export default note
