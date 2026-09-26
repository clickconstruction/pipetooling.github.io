import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3848',
  date: '2026-09-26',
  title: 'Moneyfill: the close counts exactly the queues it has',
  kind: 'fix',
  highlights: [
    'A placeholder "Sub sheets" queue that was never built is gone from the weekly-close registry, so nothing can ever count it toward "N of M queues at zero".',
    'The Weekly Money build plan now points at the live pages instead of the August concept mockups.',
  ],
}

export default note
