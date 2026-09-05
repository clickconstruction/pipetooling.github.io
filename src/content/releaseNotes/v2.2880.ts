import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2880',
  date: '2026-09-05',
  title: 'Dispatch Mode badge counts open requests only; closing a request now tells the tech',
  kind: 'fix',
  highlights: [
    'The red number on the Dispatch Mode Inbox tab now counts open dispatch and estimator requests only. It used to include every closed request nobody had dismissed yet — "7" over a list that said "3 open" — and since dismissing is per person, each closed row had to be dismissed by everyone in the group to bring it down. Dismiss still tidies your own list; it just no longer moves the badge.',
    'When Dispatch closes (or reopens) a request with a note, the person who sent it gets a push — "Dispatch answered: Handled: <request> — <note>" — and the answer is logged under Settings → Notifications even without push enabled. Until now a note written to the requester reached no one.',
    'Job Mode → Inbox has a new "My requests" list: what you sent to Dispatch that is still waiting, and what the office answered, with the note shown as "Office answered: …". It replaces the push log that used to sit there.',
    'Adding a customer phone number to a job now closes that job\'s red-phone request automatically (photos-folder requests already did this), and the tech who asked is told.',
  ],
}

export default note
