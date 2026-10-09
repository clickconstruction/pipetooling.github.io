import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5060',
  date: '2026-10-09',
  title: 'GC mode: questions about the plans while we build, for a dev',
  kind: 'feature',
  roles: ['dev'],
  highlights: [
    'A job we are building on GC projects has an RFIs button. Each question shows whose move it is and when its answer is needed.',
    'Ask a question for our superintendent or the trade we awarded. It holds the work it is about, and the lines on its sheets are ticked for you.',
    'Send it to the architect by email, record their answer, and start a change order from a cost answer.',
    'Only a dev sees it while GC mode is built. Starting a change order stays with the money team.',
  ],
}

export default note
