import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8262',
  date: '2026-11-21',
  title: 'Sub papers: the papers past twelve get their own email, and a failed read draws no sheet as unpaid',
  kind: 'fix',
  highlights: [
    'One email carries 12 papers, and nothing sent the rest. Open the next email now sends the papers that were left, without sending the statement twice.',
    'Two held sheets of one job read alike in the yellow line. Each now names its day.',
    'When the payments or the lines of the sub sheets cannot be read, the page keeps what it last read and says why. It no longer draws every sheet as unpaid.',
    'On a phone every press in the papers window is now tall enough for a thumb.',
  ],
}

export default note
