import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7030',
  date: '2026-11-12',
  title: 'Messages: a fold shows what was done with no reply this week',
  kind: 'feature',
  highlights: [
    'Under the lists on Messages, a fold now says how many conversations were done with no reply this week.',
    'Each row names the person and how it was done: a teammate pressed No reply needed, or old mail was filed for the record.',
    'Press a name to open the thread, or Reopen to put the conversation back on Follow up.',
    'The fold stays shut until you press it. It is not a list of work and adds nothing to the badge.',
  ],
}

export default note
