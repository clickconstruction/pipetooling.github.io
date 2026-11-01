import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6281',
  date: '2026-11-01',
  title: 'The law firm\'s weekly digest reads by matter',
  kind: 'feature',
  highlights: [
    'The weekly digest to the law firm now groups the week under each account: the account is a heading with its stage, who handles it and since when, and the week\'s lines sit under it with a short day, Oct 27, and what happened.',
    'The accounts with news come first, the newest news first. An account the office withdrew during the week keeps its own heading. A quiet account reads Nothing new this week, so the digest still lists every open matter.',
    'Before this, the digest was one list of dates, then what happened, then the account last, which was hard to read across several accounts.',
    'The sample inbox on the portal\'s Notifications tab and the sample on What customers see draw the new shape, since they use the same builder.',
  ],
  roles: ['dev', 'master_technician', 'assistant', 'controller'],
}

export default note
