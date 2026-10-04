import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4480',
  date: '2026-10-03',
  title: 'Submittals: the words follow the revision you are on',
  kind: 'fix',
  highlights: [
    'On Rev 4 the strip and the steps say Rev 4 and Rev 5. They used to say Build Rev 1 and Start Rev 2.',
    'A draft you answered by email and then replaced reads Rev 3 · answered Oct 2. It used to read superseded, and the strip said it was shared.',
    'When no link was ever sent, the Share step reads Not shared from the app. It used to read Room link · not opened yet.',
    'With some rows already answered, the one-entry button reads They approved the other 9…. The thread says the office entered their answers.',
  ],
}

export default note
