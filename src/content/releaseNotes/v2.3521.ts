import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3521',
  date: '2026-09-16',
  title: 'The law firm\'s confirm and stop-emails links now land on a readable page',
  kind: 'fix',
  highlights: [
    'When someone at the collections firm clicked Yes, email me, or Stop these emails, the page that came back was the page\'s raw code. Both links now open a plain page in the app that says what happened: You\'re confirmed, or Done, no more emails.',
    'Links in emails already sent still work: they are redirected to the new page with the same key. What they record is unchanged.',
  ],
}

export default note
