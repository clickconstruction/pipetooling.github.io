import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7186',
  date: '2026-11-13',
  title: 'A bid with several sent papers links to its Sent by us folder',
  kind: 'feature',
  highlights: [
    'When a dev’s agent files a second sent paper on a bid, the bid’s Submission link now opens the Sent by us folder, where every paper is a click away. Before, the link moved to the newest paper and the older ones were a folder away.',
    'A bid with one sent paper still links straight to that paper.',
    'A Submission link that someone pasted to somewhere else is kept unless the agent says it is replacing it.',
  ],
}

export default note
