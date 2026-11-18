import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7673',
  date: '2026-11-17',
  title: 'Supply houses: the bill form runs from its own file',
  kind: 'infra',
  highlights: [
    'Nothing changes on screen. Add invoice, Edit invoice, a bill filled from its PDF, Save and Delete work as they did.',
    'Everything the bill form keeps and does moved out of the Supply houses page into a file of its own, with its own tests.',
    'The page is about 460 lines shorter. The form’s window moves next.',
  ],
}

export default note
