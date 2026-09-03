import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2697',
  date: '2026-09-03',
  title: 'Bid room: the signature email names every packet it changed',
  kind: 'fix',
  highlights: [
    'When a GC signs in the bid room, other sent-and-unanswered GCs go Lost automatically — the email you get now names exactly which ones, with a reminder that you can change any of them on the bid.',
    'The "viewed option" activity on estimates and bid rooms is now throttled, so a stuck tab or a mail scanner replaying a link can\'t flood the activity feed. A person\'s real clicks still show.',
  ],
}

export default note
