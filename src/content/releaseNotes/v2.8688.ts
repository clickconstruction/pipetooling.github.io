import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8688',
  date: '2026-11-26',
  title: 'Recently deleted: the developer can send a deleted ZZ test job’s Drive folder to the trash',
  kind: 'feature',
  roles: ['dev'],
  highlights: [
    'In Settings → Data & recovery → Recently deleted, a deleted ZZ test job that kept a Drive folder now says so, with a press: Send its Drive folder to the trash…',
    'It is for a test job deleted before the app sent the folder by itself, or deleted by the office. Open it in Drive lets you look first.',
    'The window that asks first has a button that reads Send to Drive’s trash. The folder can be restored in Drive for 30 days.',
    'The entry then says what happened. The folder stays, with the reason, when a bid, another job or a customer still keeps it, or a person added a file to it. A real job has no such press.',
  ],
}

export default note
