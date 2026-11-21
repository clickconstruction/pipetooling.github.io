import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8192',
  date: '2026-11-21',
  title: 'Document builder: the job list leaves out lost and closed jobs, and one press goes to awarded trades',
  kind: 'fix',
  highlights: [
    'On Insurance requirements for subs, the Job list held every GC project. It now holds the jobs you are bidding, buying out or building.',
    'A lost or closed job stays only when its sheet was published, with lost or closed after its name. Publishing your usual holds it, so its sheet stays as the trades last saw it.',
    'Send to N trades who are ready now counts awarded trades only. A trade that was asked and not awarded is listed as held, and Send it to them on its own row still sends.',
    'A printed sheet is filed under the job its project bills through, when it has one.',
  ],
}

export default note
